const express = require('express');
const db = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();

const VALID_TYPES = new Set(['memory', 'attention', 'speed']);

// Child: get my games
router.get('/mine', authRequired, (req, res) => {
  if (req.user.role !== 'child') return res.status(403).json({ error: 'Forbidden' });
  const games = db
    .prepare(
      `SELECT id, game_type, game_name, game_config, is_active
       FROM games WHERE child_id = ? AND is_active = 1 ORDER BY created_at ASC`
    )
    .all(req.user.id)
    .map((g) => ({ ...g, game_config: JSON.parse(g.game_config) }));
  res.json({ games });
});

// Child: get a single game (if mine)
router.get('/:id', authRequired, (req, res) => {
  const game = db
    .prepare(
      `SELECT id, child_id, game_type, game_name, game_config, is_active
       FROM games WHERE id = ?`
    )
    .get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'child' && game.child_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  game.game_config = JSON.parse(game.game_config);
  res.json({ game });
});

// Admin: create game
router.post('/', authRequired, requireRole('admin'), (req, res) => {
  const { child_id, game_type, game_name, game_config } = req.body || {};
  if (!child_id || !game_type || !game_name || !game_config) {
    return res.status(400).json({ error: 'child_id, game_type, game_name, game_config required' });
  }
  if (!VALID_TYPES.has(game_type)) {
    return res.status(400).json({ error: 'Invalid game_type' });
  }
  const configStr = typeof game_config === 'string' ? game_config : JSON.stringify(game_config);
  try {
    JSON.parse(configStr);
  } catch {
    return res.status(400).json({ error: 'game_config must be valid JSON' });
  }
  const info = db
    .prepare(
      `INSERT INTO games (child_id, game_type, game_name, game_config) VALUES (?, ?, ?, ?)`
    )
    .run(child_id, game_type, game_name, configStr);
  res.status(201).json({ id: info.lastInsertRowid });
});

// Admin: update game (name, config, active)
router.put('/:id', authRequired, requireRole('admin'), (req, res) => {
  const updates = [];
  const values = [];
  if (req.body.game_name !== undefined) {
    updates.push('game_name = ?');
    values.push(req.body.game_name);
  }
  if (req.body.game_config !== undefined) {
    const configStr =
      typeof req.body.game_config === 'string'
        ? req.body.game_config
        : JSON.stringify(req.body.game_config);
    try {
      JSON.parse(configStr);
    } catch {
      return res.status(400).json({ error: 'game_config must be valid JSON' });
    }
    updates.push('game_config = ?');
    values.push(configStr);
  }
  if (req.body.is_active !== undefined) {
    updates.push('is_active = ?');
    values.push(req.body.is_active ? 1 : 0);
  }
  if (!updates.length) return res.json({ ok: true });
  values.push(req.params.id);
  db.prepare(`UPDATE games SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  res.json({ ok: true });
});

// Admin: delete game
router.delete('/:id', authRequired, requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM games WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
