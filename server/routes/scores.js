const express = require('express');
const db = require('../db');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();

// The scores table IS the "sessions" store (PHASE1_README canonical name).
// STEP 0 reconciliation: keep POST /api/scores; accept both the Phase-0 body
// (game_id from the legacy per-child games table + score/difficulty_level)
// AND the Phase-1 body ({childId?, gameKey, score(0-100), level, time_spent_seconds, raw}).
// Skill is DERIVED server-side from games_library.game_type — the client
// never sends it authoritatively.

router.post('/', authRequired, (req, res) => {
  if (req.user.role !== 'child') {
    return res.status(403).json({ error: 'Only children submit scores' });
  }
  const body = req.body || {};
  const childId = req.user.id;

  // Resolve the library game.
  let libRow = null;
  if (body.gameKey) {
    libRow = db.prepare(`SELECT id, game_type FROM games_library WHERE key = ?`).get(body.gameKey);
    if (!libRow) return res.status(400).json({ error: `Unknown gameKey "${body.gameKey}"` });
  } else if (body.game_id) {
    // Phase-0 legacy path: game_id points at the per-child games table.
    const legacy = db.prepare(`SELECT id, child_id, game_type FROM games WHERE id = ?`).get(body.game_id);
    if (!legacy || legacy.child_id !== childId) {
      return res.status(403).json({ error: 'Not your game' });
    }
    libRow = db.prepare(`SELECT id, game_type FROM games_library WHERE game_type = ?`).get(legacy.game_type);
  } else {
    return res.status(400).json({ error: 'gameKey or game_id required' });
  }

  const score = clamp0to100(body.score);
  const level = Number.isFinite(Number(body.level)) ? Number(body.level) : null;
  const timeSpent = Math.max(0, Math.round(Number(body.time_spent_seconds || body.durationSec || 0)));
  const raw = body.raw && typeof body.raw === 'object' ? JSON.stringify(body.raw) : null;
  const difficulty = String(body.difficulty_level || body.difficulty || 'normal');

  const info = db
    .prepare(
      `INSERT INTO scores
       (child_id, game_id, game_library_id, score, difficulty_level, time_spent_seconds, level, raw, played_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    // scores.game_id is legacy-FK to the per-child games table — best-effort:
    // find one that matches this child + game_type; else store 0 (schema-relaxed).
    .run(
      childId,
      resolveLegacyGameId(childId, libRow && libRow.game_type) || 0,
      libRow ? libRow.id : null,
      score,
      difficulty,
      timeSpent,
      level,
      raw
    );
  res.status(201).json({ id: info.lastInsertRowid, score, skill: libRow ? libRow.game_type : null });
});

function clamp0to100(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function resolveLegacyGameId(childId, gameType) {
  if (!gameType) return null;
  const row = db.prepare(`SELECT id FROM games WHERE child_id = ? AND game_type = ? LIMIT 1`).get(childId, gameType);
  return row ? row.id : null;
}

function canAccessChild(user, childId) {
  if (user.role === 'admin') return true;
  if (user.role === 'child' && Number(user.id) === Number(childId)) return true;
  return false;
}

// The Phase-1 per-skill summary lives at /api/children/:id/summary — it's
// exposed from assignments.js (which is mounted at /api). We export the
// builder from here so both files use the same shape.
function buildSummary(childId) {
  // Group all normalized-0-100 scores by skill. Skill = the library game's
  // game_type; scores.game_library_id is the join key. Phase-0 rows that
  // never got a game_library_id (unlikely after migration) are ignored.
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
  // For each of the last 14 calendar days, per skill, best score of the day.
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

// Legacy admin overview — retained for the current AdminDashboard.
router.get('/admin/overview', authRequired, requireRole('admin'), (_req, res) => {
  const totals = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM users WHERE role = 'child') AS total_children,
         (SELECT COUNT(*) FROM assignments) AS total_assignments,
         (SELECT COUNT(*) FROM scores) AS total_plays,
         (SELECT COUNT(DISTINCT child_id) FROM scores WHERE played_at >= datetime('now', '-7 days')) AS active_last_7d`
    )
    .get();
  res.json({
    total_children: totals.total_children,
    total_games: totals.total_assignments, // preserved key name for the current UI
    total_plays: totals.total_plays,
    active_last_7d: totals.active_last_7d
  });
});

// Legacy per-game summary — used by the current ParentDashboard until Task 1.4.
router.get('/mine/summary', authRequired, (req, res) => {
  if (req.user.role !== 'child') return res.status(403).json({ error: 'Forbidden' });
  res.json(buildLegacySummary(req.user.id));
});
router.get('/child/:id/summary', authRequired, requireRole('admin'), (req, res) => {
  res.json(buildLegacySummary(req.params.id));
});

function buildLegacySummary(childId) {
  const games = db.prepare(`SELECT id, game_type, game_name FROM games WHERE child_id = ? ORDER BY created_at ASC`).all(childId);
  const perGame = games.map((g) => {
    const agg = db
      .prepare(
        `SELECT COUNT(*) AS plays, MAX(score) AS best, AVG(score) AS avg,
                SUM(time_spent_seconds) AS total_time, MAX(played_at) AS last_played
         FROM scores WHERE game_id = ?`
      )
      .get(g.id);
    const recent = db
      .prepare(`SELECT score, played_at FROM scores WHERE game_id = ? ORDER BY played_at DESC LIMIT 10`)
      .all(g.id)
      .reverse();
    let trend = 'flat';
    if (recent.length >= 2) {
      const half = Math.floor(recent.length / 2);
      const firstAvg = recent.slice(0, half).reduce((a, b) => a + b.score, 0) / (half || 1);
      const secondAvg = recent.slice(half).reduce((a, b) => a + b.score, 0) / (recent.length - half || 1);
      if (secondAvg > firstAvg + 0.5) trend = 'up';
      else if (secondAvg < firstAvg - 0.5) trend = 'down';
    }
    return {
      game_id: g.id, game_type: g.game_type, game_name: g.game_name,
      plays: agg.plays || 0, best: agg.best || 0,
      avg: agg.avg ? Number(agg.avg.toFixed(1)) : 0,
      total_time: agg.total_time || 0, last_played: agg.last_played, trend,
      recent: recent.map((r) => ({ score: r.score, played_at: r.played_at }))
    };
  });
  return { games: perGame };
}

module.exports = router;
module.exports.buildSummary = buildSummary;
module.exports.canAccessChild = canAccessChild;
