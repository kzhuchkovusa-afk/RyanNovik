const express = require('express');
const db = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();

// Child: submit a score
router.post('/', authRequired, (req, res) => {
  if (req.user.role !== 'child') return res.status(403).json({ error: 'Only children submit scores' });
  const { game_id, score, difficulty_level, time_spent_seconds } = req.body || {};
  if (game_id == null || score == null || !difficulty_level) {
    return res.status(400).json({ error: 'game_id, score, difficulty_level required' });
  }

  const game = db.prepare('SELECT id, child_id FROM games WHERE id = ?').get(game_id);
  if (!game || game.child_id !== req.user.id) {
    return res.status(403).json({ error: 'Not your game' });
  }

  const info = db
    .prepare(
      `INSERT INTO scores (child_id, game_id, score, difficulty_level, time_spent_seconds)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(req.user.id, game_id, score, difficulty_level, time_spent_seconds || 0);
  res.status(201).json({ id: info.lastInsertRowid });
});

// Parent/Child: stats for current child (whoever owns the account)
router.get('/mine/summary', authRequired, (req, res) => {
  if (req.user.role !== 'child') return res.status(403).json({ error: 'Forbidden' });
  res.json(buildSummary(req.user.id));
});

// Admin: stats for a specific child
router.get('/child/:id/summary', authRequired, requireRole('admin'), (req, res) => {
  res.json(buildSummary(req.params.id));
});

// Admin: overview across all clients
router.get('/admin/overview', authRequired, requireRole('admin'), (req, res) => {
  const totals = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM users WHERE role = 'child') AS total_children,
         (SELECT COUNT(*) FROM games) AS total_games,
         (SELECT COUNT(*) FROM scores) AS total_plays,
         (SELECT COUNT(DISTINCT child_id) FROM scores WHERE played_at >= datetime('now', '-7 days')) AS active_last_7d`
    )
    .get();
  res.json(totals);
});

function buildSummary(childId) {
  const games = db
    .prepare(
      `SELECT id, game_type, game_name FROM games WHERE child_id = ? ORDER BY created_at ASC`
    )
    .all(childId);

  const perGame = games.map((g) => {
    const agg = db
      .prepare(
        `SELECT COUNT(*) AS plays, MAX(score) AS best, AVG(score) AS avg,
                SUM(time_spent_seconds) AS total_time, MAX(played_at) AS last_played
         FROM scores WHERE game_id = ?`
      )
      .get(g.id);

    // last 5 scores chronologically to compute trend
    const recent = db
      .prepare(
        `SELECT score, played_at FROM scores WHERE game_id = ? ORDER BY played_at DESC LIMIT 10`
      )
      .all(g.id)
      .reverse();

    let trend = 'flat';
    if (recent.length >= 2) {
      const half = Math.floor(recent.length / 2);
      const firstHalfAvg = recent.slice(0, half).reduce((a, b) => a + b.score, 0) / (half || 1);
      const secondHalfAvg =
        recent.slice(half).reduce((a, b) => a + b.score, 0) / (recent.length - half || 1);
      if (secondHalfAvg > firstHalfAvg + 0.5) trend = 'up';
      else if (secondHalfAvg < firstHalfAvg - 0.5) trend = 'down';
    }

    return {
      game_id: g.id,
      game_type: g.game_type,
      game_name: g.game_name,
      plays: agg.plays || 0,
      best: agg.best || 0,
      avg: agg.avg ? Number(agg.avg.toFixed(1)) : 0,
      total_time: agg.total_time || 0,
      last_played: agg.last_played,
      trend,
      recent: recent.map((r) => ({ score: r.score, played_at: r.played_at }))
    };
  });

  return { games: perGame };
}

module.exports = router;
