const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { signToken, authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();

function randomToken() {
  return crypto.randomBytes(24).toString('base64url');
}

// POST /api/access/exchange { token }
// Public — but only accepts a token that matches EXACTLY one child row.
// Returns a normal child JWT (same shape as /api/auth/login) so the rest of
// the app doesn't need to know this path exists.
router.post('/exchange', (req, res) => {
  const token = String((req.body && req.body.token) || '').trim();
  if (!token || token.length < 16) {
    return res.status(400).json({ error: 'Missing or invalid token' });
  }
  const user = db
    .prepare(
      `SELECT id, username, role, child_name, avatar
       FROM users
       WHERE access_token = ? AND role = 'child'
       LIMIT 1`
    )
    .get(token);
  if (!user) {
    return res.status(401).json({ error: 'Unknown or revoked token' });
  }
  const jwt = signToken(user);
  res.json({
    token: jwt,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      child_name: user.child_name,
      avatar: user.avatar
    }
  });
});

// POST /api/children/:id/regenerate-access-token   (admin)
// Rotates the child's access token — the previous /enter link is dead the
// moment this returns. Response includes the new token so the owner can
// copy it straight into an SMS to the parent.
router.post(
  '/children/:id/regenerate-access-token',
  authRequired, requireRole('admin'),
  (req, res) => {
    const childId = Number(req.params.id);
    const child = db.prepare(`SELECT id FROM users WHERE id = ? AND role='child'`).get(childId);
    if (!child) return res.status(404).json({ error: 'Child not found' });
    const token = randomToken();
    db.prepare(`UPDATE users SET access_token = ? WHERE id = ?`).run(token, childId);
    res.json({ access_token: token });
  }
);

// GET /api/children/:id/access-token   (admin — reveal current token)
router.get(
  '/children/:id/access-token',
  authRequired, requireRole('admin'),
  (req, res) => {
    const row = db
      .prepare(`SELECT access_token FROM users WHERE id = ? AND role='child'`)
      .get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Child not found' });
    res.json({ access_token: row.access_token });
  }
);

module.exports = router;
