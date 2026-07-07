const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();

function randomAccessToken() {
  return crypto.randomBytes(24).toString('base64url');
}

// Admin: list all children with quick stats (Phase-3: uses assignments +
// scores, not the legacy games table).
router.get('/', authRequired, requireRole('admin'), (_req, res) => {
  const rows = db
    .prepare(
      `SELECT u.id, u.username, u.child_name, u.age, u.theme, u.parent_email, u.avatar,
              u.client_id, u.created_at,
              (SELECT COUNT(*) FROM assignments a WHERE a.child_id = u.id AND a.unlocked = 1) AS active_games,
              (SELECT COUNT(*) FROM scores s WHERE s.child_id = u.id) AS total_plays,
              (SELECT MAX(played_at) FROM scores s WHERE s.child_id = u.id) AS last_played,
              (SELECT c.name FROM clients c WHERE c.id = u.client_id) AS client_name
       FROM users u
       WHERE u.role = 'child'
       ORDER BY u.created_at DESC`
    )
    .all();
  res.json({ children: rows });
});

// Admin: create child account. Auto-generates access_token and requires a
// client_id (owner picks the client in the console before creating).
router.post('/', authRequired, requireRole('admin'), (req, res) => {
  const {
    username, password, child_name, age, theme, interests,
    favorite_colors, parent_email, client_id, avatar
  } = req.body || {};

  if (!username || !password || !child_name) {
    return res.status(400).json({ error: 'username, password, and child_name are required' });
  }
  if (!client_id) {
    return res.status(400).json({ error: 'client_id is required (create a client first)' });
  }
  const client = db.prepare(`SELECT id FROM clients WHERE id = ?`).get(client_id);
  if (!client) return res.status(400).json({ error: 'Unknown client_id' });

  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(409).json({ error: 'Username already taken' });

  const hash = bcrypt.hashSync(password, 10);
  const token = randomAccessToken();
  const info = db
    .prepare(
      `INSERT INTO users
       (username, password_hash, role, child_name, age, theme, interests, favorite_colors,
        parent_email, client_id, avatar, access_token)
       VALUES (?, ?, 'child', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      username, hash, child_name, age || null,
      theme || null, interests || null, favorite_colors || null,
      parent_email || null, client_id, avatar || null, token
    );

  // Link this child to the client's parent(s) so PIN login works.
  const parent = db.prepare(`SELECT id FROM parents WHERE client_id = ? LIMIT 1`).get(client_id);
  if (parent) {
    db.prepare(`INSERT OR IGNORE INTO parent_child_links (parent_id, child_id) VALUES (?, ?)`)
      .run(parent.id, info.lastInsertRowid);
  }

  // Seed a limits row with sensible defaults (Phase-2 spec: 30m daily / 15m session).
  db.prepare(
    `INSERT OR IGNORE INTO limits (child_id, daily_seconds_cap, max_session_seconds)
     VALUES (?, 1800, 900)`
  ).run(info.lastInsertRowid);

  res.status(201).json({ id: info.lastInsertRowid, access_token: token });
});

// Admin: get one child's profile (no games — Phase-3 uses /assignments).
router.get('/:id', authRequired, requireRole('admin'), (req, res) => {
  const child = db
    .prepare(
      `SELECT id, username, role, child_name, age, theme, interests, favorite_colors,
              parent_email, avatar, client_id, access_token, created_at
       FROM users WHERE id = ? AND role = 'child'`
    )
    .get(req.params.id);
  if (!child) return res.status(404).json({ error: 'Child not found' });
  res.json({ child });
});

// Admin: update child profile.
router.put('/:id', authRequired, requireRole('admin'), (req, res) => {
  const fields = ['child_name', 'age', 'theme', 'interests', 'favorite_colors',
                  'parent_email', 'avatar', 'client_id'];
  const updates = [];
  const values = [];
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      updates.push(`${f} = ?`);
      values.push(req.body[f]);
    }
  }
  if (req.body.password) {
    updates.push('password_hash = ?');
    values.push(bcrypt.hashSync(req.body.password, 10));
  }
  if (!updates.length) return res.json({ ok: true });
  values.push(req.params.id);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ? AND role = 'child'`).run(...values);
  res.json({ ok: true });
});

// Admin: delete child (cascades to assignments/scores/limits via FKs).
router.delete('/:id', authRequired, requireRole('admin'), (req, res) => {
  db.prepare(`DELETE FROM users WHERE id = ? AND role = 'child'`).run(req.params.id);
  res.json({ ok: true });
});

// Self profile (child looking at themselves) — used by /play hub.
router.get('/me/profile', authRequired, (req, res) => {
  if (req.user.role !== 'child') return res.status(403).json({ error: 'Forbidden' });
  const child = db
    .prepare(
      `SELECT id, username, child_name, age, theme, interests, favorite_colors, avatar
       FROM users WHERE id = ?`
    )
    .get(req.user.id);
  res.json({ child });
});

module.exports = router;
