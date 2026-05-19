const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();

// Admin: list all children with quick stats
router.get('/', authRequired, requireRole('admin'), (req, res) => {
  const rows = db
    .prepare(
      `SELECT u.id, u.username, u.child_name, u.age, u.theme, u.parent_email, u.created_at,
              (SELECT COUNT(*) FROM games g WHERE g.child_id = u.id AND g.is_active = 1) AS active_games,
              (SELECT COUNT(*) FROM scores s WHERE s.child_id = u.id) AS total_plays,
              (SELECT MAX(played_at) FROM scores s WHERE s.child_id = u.id) AS last_played
       FROM users u
       WHERE u.role = 'child'
       ORDER BY u.created_at DESC`
    )
    .all();
  res.json({ children: rows });
});

// Admin: create child account
router.post('/', authRequired, requireRole('admin'), (req, res) => {
  const {
    username,
    password,
    child_name,
    age,
    theme,
    interests,
    favorite_colors,
    parent_email
  } = req.body || {};

  if (!username || !password || !child_name) {
    return res.status(400).json({ error: 'username, password, and child_name are required' });
  }

  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (exists) return res.status(409).json({ error: 'Username already taken' });

  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare(
      `INSERT INTO users (username, password_hash, role, child_name, age, theme, interests, favorite_colors, parent_email)
       VALUES (?, ?, 'child', ?, ?, ?, ?, ?, ?)`
    )
    .run(
      username,
      hash,
      child_name,
      age || null,
      theme || null,
      interests || null,
      favorite_colors || null,
      parent_email || null
    );
  res.status(201).json({ id: info.lastInsertRowid });
});

// Admin: get one child's profile + games
router.get('/:id', authRequired, requireRole('admin'), (req, res) => {
  const child = db
    .prepare(
      `SELECT id, username, role, child_name, age, theme, interests, favorite_colors, parent_email, created_at
       FROM users WHERE id = ? AND role = 'child'`
    )
    .get(req.params.id);
  if (!child) return res.status(404).json({ error: 'Child not found' });

  const games = db
    .prepare(
      `SELECT id, game_type, game_name, game_config, is_active, created_at
       FROM games WHERE child_id = ? ORDER BY created_at ASC`
    )
    .all(child.id)
    .map((g) => ({ ...g, game_config: JSON.parse(g.game_config) }));

  res.json({ child, games });
});

// Admin: update child profile
router.put('/:id', authRequired, requireRole('admin'), (req, res) => {
  const fields = ['child_name', 'age', 'theme', 'interests', 'favorite_colors', 'parent_email'];
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

// Admin: delete child
router.delete('/:id', authRequired, requireRole('admin'), (req, res) => {
  db.prepare(`DELETE FROM users WHERE id = ? AND role = 'child'`).run(req.params.id);
  res.json({ ok: true });
});

// Self profile (child looking at themselves) — used by /play hub
router.get('/me/profile', authRequired, (req, res) => {
  if (req.user.role !== 'child') return res.status(403).json({ error: 'Forbidden' });
  const child = db
    .prepare(
      `SELECT id, username, child_name, age, theme, interests, favorite_colors
       FROM users WHERE id = ?`
    )
    .get(req.user.id);
  res.json({ child });
});

module.exports = router;
