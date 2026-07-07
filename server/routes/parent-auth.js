const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signParentToken, authRequired } = require('../middleware/auth');

const router = express.Router();

// In-memory rate limiter, keyed by clientId. After 3 wrong PINs the client
// is locked out for 30 seconds. Deliberately per-process — this is a small
// single-node platform; when we scale, move to Redis with the same shape.
const LOCKOUT_WINDOW_MS = 30_000;
const MAX_FAILS = 3;
const state = new Map(); // clientId → { fails, lockedUntil }

function checkLockout(clientId) {
  const s = state.get(clientId);
  if (!s) return { locked: false, retryAfterMs: 0 };
  if (s.lockedUntil && s.lockedUntil > Date.now()) {
    return { locked: true, retryAfterMs: s.lockedUntil - Date.now() };
  }
  // Expired lockout — reset silently on the next attempt.
  if (s.lockedUntil && s.lockedUntil <= Date.now()) {
    state.set(clientId, { fails: 0, lockedUntil: 0 });
  }
  return { locked: false, retryAfterMs: 0 };
}
function recordFail(clientId) {
  const s = state.get(clientId) || { fails: 0, lockedUntil: 0 };
  s.fails += 1;
  if (s.fails >= MAX_FAILS) {
    s.lockedUntil = Date.now() + LOCKOUT_WINDOW_MS;
    s.fails = 0;
  }
  state.set(clientId, s);
}
function recordSuccess(clientId) {
  state.set(clientId, { fails: 0, lockedUntil: 0 });
}

// Resolve the target client from the request body. Accepts either an explicit
// clientId or a childId (the common iPad flow — child is logged in, taps
// "Parent" → we look up the client from the child row).
function resolveClientId(body) {
  if (body.clientId) return Number(body.clientId);
  if (body.childId) {
    const row = db.prepare(`SELECT client_id FROM users WHERE id = ? AND role='child'`).get(body.childId);
    return row ? row.client_id : null;
  }
  return null;
}

// POST /api/parent/login
// body: { childId | clientId, pin }
router.post('/login', (req, res) => {
  const body = req.body || {};
  const pin = String(body.pin || '');
  if (!/^\d{3,8}$/.test(pin)) return res.status(400).json({ error: 'PIN must be 3–8 digits' });

  const clientId = resolveClientId(body);
  if (!clientId) return res.status(400).json({ error: 'childId or clientId required' });

  const lock = checkLockout(clientId);
  if (lock.locked) {
    return res.status(429).json({
      error: 'Too many wrong tries — wait a moment.',
      retry_after_seconds: Math.ceil(lock.retryAfterMs / 1000)
    });
  }

  const parent = db.prepare(`SELECT id, pin FROM parents WHERE client_id = ? LIMIT 1`).get(clientId);
  // Deliberately do a bcrypt compare against a fixed hash if the parent row
  // is missing, so response times don't leak "no parent for this client".
  const compareAgainst = parent ? parent.pin : '$2a$10$abcdefghijklmnopqrstuu9uL7BX2j5Le4z1kkR8dTdWjJj2fFy2kK';
  const ok = bcrypt.compareSync(pin, compareAgainst) && !!parent;

  if (!ok) {
    recordFail(clientId);
    return res.status(401).json({ error: 'Wrong PIN' });
  }
  recordSuccess(clientId);

  const kids = db
    .prepare(
      `SELECT u.id FROM users u
       WHERE u.role='child' AND (
         u.client_id = ?
         OR u.id IN (SELECT child_id FROM parent_child_links WHERE parent_id = ?)
       )`
    )
    .all(clientId, parent.id)
    .map((r) => r.id);

  const token = signParentToken({ clientId, childIds: kids });
  res.json({
    token,
    expires_in_seconds: 30 * 60,
    parent: { clientId, childIds: kids }
  });
});

// GET /api/parent/me — introspect current parent token (for the parent UI).
router.get('/me', authRequired, (req, res) => {
  if (req.user.role !== 'parent') return res.status(403).json({ error: 'Not a parent token' });
  res.json({
    role: 'parent',
    clientId: req.user.clientId,
    childIds: req.user.childIds || []
  });
});

module.exports = router;
