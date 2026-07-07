const express = require('express');
const db = require('../db');
const { authRequired, requireRole, canAccessChild } = require('../middleware/auth');

const router = express.Router();

// POST /api/scores — Phase-1 shape only (Phase-0 legacy body retired in
// Task 3.3). Body:
//   { gameKey, score(0-100), level?, time_spent_seconds, difficulty_level?, raw? }
// Skill is derived server-side from games_library.game_type.
router.post('/', authRequired, (req, res) => {
  if (req.user.role !== 'child') {
    return res.status(403).json({ error: 'Only children submit scores' });
  }
  const body = req.body || {};
  if (!body.gameKey) return res.status(400).json({ error: 'gameKey required' });

  const libRow = db
    .prepare(`SELECT id, game_type FROM games_library WHERE key = ?`)
    .get(body.gameKey);
  if (!libRow) return res.status(400).json({ error: `Unknown gameKey "${body.gameKey}"` });

  const childId = req.user.id;
  const score = clamp0to100(body.score);
  const level = Number.isFinite(Number(body.level)) ? Number(body.level) : null;
  const timeSpent = Math.max(0, Math.round(Number(body.time_spent_seconds || body.durationSec || 0)));
  const raw = body.raw && typeof body.raw === 'object' ? JSON.stringify(body.raw) : null;
  const difficulty = String(body.difficulty_level || body.difficulty || 'normal');

  const info = db
    .prepare(
      `INSERT INTO scores
       (child_id, game_id, game_library_id, score, difficulty_level, time_spent_seconds, level, raw, played_at)
       VALUES (?, 0, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    // scores.game_id is a legacy FK column (see Phase-1 migration). We
    // write 0 here since the legacy games table is being retired; the
    // authoritative link is game_library_id.
    .run(childId, libRow.id, score, difficulty, timeSpent, level, raw);

  res.status(201).json({ id: info.lastInsertRowid, score, skill: libRow.game_type });
});

function clamp0to100(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

// The Phase-1 per-skill summary lives at /api/children/:id/summary — it's
// exposed from assignments.js (which is mounted at /api). We export the
// builder from here so both files use the same shape.
function buildSummary(childId) {
  const rows = db
    .prepare(
      `SELECT s.id, s.score, s.time_spent_seconds, s.played_at, s.level,
              g.game_type AS skill
       FROM scores s
       JOIN games_library g ON g.id = s.game_library_id
       WHERE s.child_id = ?
       ORDER BY s.played_at ASC`
    )
    .all(childId);

  const bySkill = {};
  for (const r of rows) {
    if (!bySkill[r.skill]) bySkill[r.skill] = [];
    bySkill[r.skill].push(r);
  }

  const CALIBRATION_THRESHOLD = 3;
  const skills = {};
  for (const skill of Object.keys(bySkill)) {
    const list = bySkill[skill];
    if (list.length < CALIBRATION_THRESHOLD) {
      skills[skill] = { calibrating: true, plays: list.length };
      continue;
    }
    const first = list.slice(0, 3).map((x) => x.score);
    const last = list.slice(-3).map((x) => x.score);
    const baseline = avg(first);
    const current = avg(last);
    const improvePct = baseline > 0 ? Math.round(((current - baseline) / baseline) * 1000) / 10 : 0;
    skills[skill] = {
      calibrating: false,
      plays: list.length,
      baseline: Math.round(baseline),
      current: Math.round(current),
      improvePct,
      recent: list.slice(-7).map((x) => ({ score: x.score, played_at: x.played_at }))
    };
  }

  return { skills, trend14: build14dayTrend(rows) };
}

function avg(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }

function build14dayTrend(rows) {
  const now = new Date();
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, byBest: {} });
  }
  const idxByDate = Object.fromEntries(days.map((d, i) => [d.date, i]));
  for (const r of rows) {
    const date = String(r.played_at || '').slice(0, 10);
    const i = idxByDate[date];
    if (i == null) continue;
    const skill = r.skill;
    const prev = days[i].byBest[skill];
    if (prev == null || r.score > prev) days[i].byBest[skill] = r.score;
  }
  return days;
}

// Owner overview (Phase-3 uses assignments, not the legacy games table).
router.get('/admin/overview', authRequired, requireRole('admin'), (_req, res) => {
  const totals = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM clients) AS total_clients,
         (SELECT COUNT(*) FROM users WHERE role = 'child') AS total_children,
         (SELECT COUNT(*) FROM assignments) AS total_assignments,
         (SELECT COUNT(*) FROM scores) AS total_plays,
         (SELECT COUNT(DISTINCT child_id) FROM scores WHERE played_at >= datetime('now', '-7 days')) AS active_last_7d`
    )
    .get();
  res.json({
    total_clients: totals.total_clients,
    total_children: totals.total_children,
    total_games: totals.total_assignments,
    total_plays: totals.total_plays,
    active_last_7d: totals.active_last_7d
  });
});

module.exports = router;
module.exports.buildSummary = buildSummary;
