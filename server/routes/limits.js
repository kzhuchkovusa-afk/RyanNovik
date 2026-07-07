const express = require('express');
const db = require('../db');
const { authRequired, requireRole, requireAdminOrParentOfChild } = require('../middleware/auth');

const router = express.Router();

function canAccessChild(user, childId) {
  if (user.role === 'admin') return true;
  if (user.role === 'child' && Number(user.id) === Number(childId)) return true;
  return false;
}

function safeJson(str, fallback) {
  if (str == null) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}

function readLimits(childId) {
  const row = db.prepare(`SELECT * FROM limits WHERE child_id = ?`).get(childId);
  if (!row) {
    // Auto-create defaults on first read so callers always get a shape.
    db.prepare(`INSERT OR IGNORE INTO limits (child_id) VALUES (?)`).run(childId);
    return {
      child_id: childId,
      daily_seconds_cap: null,
      max_session_seconds: null,
      allowed_hours: null,
      allowed_days: null,
      paused: false
    };
  }
  return {
    child_id: row.child_id,
    daily_seconds_cap: row.daily_seconds_cap,
    max_session_seconds: row.max_session_seconds,
    allowed_hours: safeJson(row.allowed_hours, null),
    allowed_days: safeJson(row.allowed_days, null),
    paused: !!row.paused,
    updated_at: row.updated_at
  };
}

// /me MUST come first so Express doesn't match :id="me".
router.get('/children/me/limits', authRequired, (req, res) => {
  if (req.user.role !== 'child') return res.status(403).json({ error: 'Forbidden' });
  res.json({ limits: readLimits(req.user.id) });
});

router.get('/children/:id/limits', authRequired, (req, res) => {
  const childId = Number(req.params.id);
  if (!canAccessChild(req.user, childId)) return res.status(403).json({ error: 'Forbidden' });
  res.json({ limits: readLimits(childId) });
});

// Admin OR the child's parent (Task 2.1 scope) can write limits. The child's
// own token cannot — kids cannot lift their own restrictions.
router.put(
  '/children/:id/limits',
  authRequired,
  requireAdminOrParentOfChild((req) => req.params.id),
  (req, res) => {
  const childId = Number(req.params.id);
  const b = req.body || {};

  const daily = numOrNull(b.daily_seconds_cap);
  const maxSess = numOrNull(b.max_session_seconds);
  const allowedHours = jsonOrNull(b.allowed_hours);
  const allowedDays = jsonOrNull(b.allowed_days);
  const paused = b.paused ? 1 : 0;

  db.prepare(`INSERT OR IGNORE INTO limits (child_id) VALUES (?)`).run(childId);
  db
    .prepare(
      `UPDATE limits
       SET daily_seconds_cap = ?, max_session_seconds = ?, allowed_hours = ?,
           allowed_days = ?, paused = ?, updated_at = datetime('now')
       WHERE child_id = ?`
    )
    .run(daily, maxSess, allowedHours, allowedDays, paused, childId);
  res.json({ limits: readLimits(childId) });
  }
);

function numOrNull(x) {
  if (x == null || x === '') return null;
  const n = Number(x);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}
function jsonOrNull(x) {
  if (x == null) return null;
  try {
    if (typeof x === 'string') { JSON.parse(x); return x; }
    return JSON.stringify(x);
  } catch { return null; }
}

module.exports = router;
