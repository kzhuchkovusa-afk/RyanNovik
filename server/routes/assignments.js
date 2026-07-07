const express = require('express');
const db = require('../db');
const { authRequired, requireRole, requireAdminOrParentOfChild, canAccessChild } = require('../middleware/auth');
const { buildSummary } = require('./scores');

const router = express.Router();

function assignmentOwnerChildId(assignmentId) {
  const row = db.prepare(`SELECT child_id FROM assignments WHERE id = ?`).get(assignmentId);
  return row ? row.child_id : null;
}

// Helper: fetch one child's assignments joined with the games library.
// Returns the exact shape the hub (Task 1.4) and the SDK loader want:
// { game: { key, name, game_type, module_url }, config, unlocked, sort_order }.
function listAssignments(childId) {
  const rows = db
    .prepare(
      `SELECT a.id, a.config, a.unlocked, a.sort_order,
              g.id AS game_library_id, g.key, g.name, g.game_type, g.module_url, g.config_schema
       FROM assignments a
       JOIN games_library g ON g.id = a.game_id
       WHERE a.child_id = ?
       ORDER BY a.sort_order ASC, a.id ASC`
    )
    .all(childId);
  return rows.map((r) => ({
    assignment_id: r.id,
    unlocked: !!r.unlocked,
    sort_order: r.sort_order,
    config: safeJson(r.config, {}),
    game: {
      id: r.game_library_id,
      key: r.key,
      name: r.name,
      game_type: r.game_type,
      module_url: r.module_url,
      config_schema: safeJson(r.config_schema, {})
    }
  }));
}

function safeJson(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

// Convenience alias for the logged-in child (no id needed).
// MUST be declared BEFORE the /:id route or Express matches :id="me".
router.get('/children/me/assignments', authRequired, (req, res) => {
  if (req.user.role !== 'child') return res.status(403).json({ error: 'Forbidden' });
  res.json({ assignments: listAssignments(req.user.id) });
});

// GET /api/children/:id/assignments
router.get('/children/:id/assignments', authRequired, (req, res) => {
  const childId = Number(req.params.id);
  if (!canAccessChild(req.user, childId)) return res.status(403).json({ error: 'Forbidden' });
  const child = db.prepare(`SELECT id, role FROM users WHERE id = ? AND role = 'child'`).get(childId);
  if (!child) return res.status(404).json({ error: 'Child not found' });
  res.json({ assignments: listAssignments(childId) });
});

// Admin: create an assignment. Body: { child_id, game_key, config, unlocked?, sort_order? }
router.post('/assignments', authRequired, requireRole('admin'), (req, res) => {
  const { child_id, game_key, config, unlocked = true, sort_order = 0 } = req.body || {};
  if (!child_id || !game_key || !config) {
    return res.status(400).json({ error: 'child_id, game_key, config required' });
  }
  const game = db.prepare(`SELECT id FROM games_library WHERE key = ?`).get(game_key);
  if (!game) return res.status(400).json({ error: `Unknown game_key "${game_key}"` });
  const configStr = typeof config === 'string' ? config : JSON.stringify(config);
  try { JSON.parse(configStr); } catch { return res.status(400).json({ error: 'config must be JSON' }); }
  try {
    const info = db
      .prepare(
        `INSERT INTO assignments (child_id, game_id, config, unlocked, sort_order)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(child_id, game.id, configStr, unlocked ? 1 : 0, sort_order);
    res.status(201).json({ id: info.lastInsertRowid });
  } catch (e) {
    // Likely UNIQUE(child_id, game_id) collision.
    res.status(409).json({ error: e.message });
  }
});

// Admin OR the assignment's parent can update. In practice parents will only
// flip `unlocked` from the Controls tab; the code accepts config too so an
// owner-admin can edit through the same path.
router.put(
  '/assignments/:id',
  authRequired,
  requireAdminOrParentOfChild((req) => assignmentOwnerChildId(req.params.id)),
  (req, res) => {
  const fields = [];
  const values = [];
  if (req.body.config !== undefined) {
    const configStr = typeof req.body.config === 'string' ? req.body.config : JSON.stringify(req.body.config);
    try { JSON.parse(configStr); } catch { return res.status(400).json({ error: 'config must be JSON' }); }
    fields.push('config = ?'); values.push(configStr);
  }
  if (req.body.unlocked !== undefined) { fields.push('unlocked = ?'); values.push(req.body.unlocked ? 1 : 0); }
  if (req.body.sort_order !== undefined) { fields.push('sort_order = ?'); values.push(Number(req.body.sort_order) || 0); }
  if (!fields.length) return res.json({ ok: true });
  values.push(req.params.id);
  db.prepare(`UPDATE assignments SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  res.json({ ok: true });
  }
);

router.delete('/assignments/:id', authRequired, requireRole('admin'), (req, res) => {
  db.prepare(`DELETE FROM assignments WHERE id = ?`).run(req.params.id);
  res.json({ ok: true });
});

// /me before /:id.
router.get('/children/me/summary', authRequired, (req, res) => {
  if (req.user.role !== 'child') return res.status(403).json({ error: 'Forbidden' });
  res.json(buildSummary(req.user.id));
});

router.get('/children/:id/summary', authRequired, (req, res) => {
  const childId = Number(req.params.id);
  if (!canAccessChild(req.user, childId)) return res.status(403).json({ error: 'Forbidden' });
  res.json(buildSummary(childId));
});

// Admin: list all games in the library (used by the assign-game picker).
router.get('/games-library', authRequired, requireRole('admin'), (_req, res) => {
  const rows = db
    .prepare(`SELECT id, key, name, game_type, module_url, config_schema FROM games_library ORDER BY name ASC`)
    .all()
    .map((r) => ({ ...r, config_schema: safeJson(r.config_schema, {}) }));
  res.json({ games: rows });
});

module.exports = router;
