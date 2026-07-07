const express = require('express');
const db = require('../db');
const { authRequired, canAccessChild } = require('../middleware/auth');

const router = express.Router();

// Weekday key aligned with the Controls-UI serialization (Task 2.2).
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function safeJson(s, fallback) {
  if (s == null) return fallback;
  try { return JSON.parse(s); } catch { return fallback; }
}

function readLimits(childId) {
  const row = db.prepare(`SELECT * FROM limits WHERE child_id = ?`).get(childId);
  if (!row) return null;
  return {
    child_id: row.child_id,
    daily_seconds_cap: row.daily_seconds_cap,
    max_session_seconds: row.max_session_seconds,
    allowed_hours: safeJson(row.allowed_hours, null),
    allowed_days: safeJson(row.allowed_days, null),
    paused: !!row.paused
  };
}

// Sum today's time_spent_seconds for a child. SQLite date('now') uses UTC
// server date; that's the source-of-truth per TASK_2.3 tamper-resistance
// note — the client's clock never enters the math.
function secondsUsedToday(childId) {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(time_spent_seconds), 0) AS used
       FROM scores WHERE child_id = ? AND date(played_at) = date('now')`
    )
    .get(childId);
  return row ? Number(row.used || 0) : 0;
}

// Return current server "wall clock" in HH:MM for the hours check.
function serverHHMM() {
  const d = new Date();
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function isTimeInWindow(now, from, to) {
  if (!from || !to) return true;
  // Handle windows that don't wrap midnight (from < to) and ones that do.
  if (from <= to) return now >= from && now <= to;
  return now >= from || now <= to;
}

function todaysDayKey() {
  return DAY_KEYS[new Date().getUTCDay()];
}

// Human-friendly next-window hint for the UI (best-effort; not authoritative).
function nextAllowedHint(limits) {
  if (!limits) return null;
  const parts = [];
  if (limits.allowed_hours && limits.allowed_hours.from) {
    parts.push(`from ${limits.allowed_hours.from}`);
  }
  if (Array.isArray(limits.allowed_days) && limits.allowed_days.length) {
    parts.push(`on ${limits.allowed_days.map((d) => d[0].toUpperCase() + d.slice(1)).join(', ')}`);
  }
  return parts.length ? parts.join(' ') : null;
}

function computeGate(childId) {
  const limits = readLimits(childId) || {
    daily_seconds_cap: null, max_session_seconds: null,
    allowed_hours: null, allowed_days: null, paused: false
  };

  // 1. Pause is instant-final.
  if (limits.paused) {
    return {
      allowed: false, reason: 'paused',
      secondsRemainingToday: 0,
      maxSessionSeconds: limits.max_session_seconds || 0,
      hint: null
    };
  }

  // 2. Allowed days.
  if (Array.isArray(limits.allowed_days) && limits.allowed_days.length) {
    if (!limits.allowed_days.includes(todaysDayKey())) {
      return {
        allowed: false, reason: 'outsideHours',
        secondsRemainingToday: 0,
        maxSessionSeconds: limits.max_session_seconds || 0,
        hint: nextAllowedHint(limits)
      };
    }
  }

  // 3. Allowed hours.
  if (limits.allowed_hours && (limits.allowed_hours.from || limits.allowed_hours.to)) {
    if (!isTimeInWindow(serverHHMM(), limits.allowed_hours.from, limits.allowed_hours.to)) {
      return {
        allowed: false, reason: 'outsideHours',
        secondsRemainingToday: 0,
        maxSessionSeconds: limits.max_session_seconds || 0,
        hint: nextAllowedHint(limits)
      };
    }
  }

  // 4. Daily cap.
  const cap = Number(limits.daily_seconds_cap);
  if (Number.isFinite(cap) && cap > 0) {
    const used = secondsUsedToday(childId);
    const remaining = Math.max(0, cap - used);
    if (remaining <= 0) {
      return {
        allowed: false, reason: 'dailyCap',
        secondsRemainingToday: 0,
        maxSessionSeconds: limits.max_session_seconds || 0,
        hint: null
      };
    }
    return {
      allowed: true, reason: null,
      secondsRemainingToday: remaining,
      maxSessionSeconds: limits.max_session_seconds || 0,
      hint: null
    };
  }

  // No cap set — unlimited (but max_session_seconds still applies per session).
  return {
    allowed: true, reason: null,
    secondsRemainingToday: null,          // null = no cap; treat as unlimited on the client
    maxSessionSeconds: limits.max_session_seconds || 0,
    hint: null
  };
}

// /me must come BEFORE /:id or Express matches :id="me".
router.get('/children/me/gate', authRequired, (req, res) => {
  if (req.user.role !== 'child') return res.status(403).json({ error: 'Forbidden' });
  res.json(computeGate(req.user.id));
});

// GET /api/children/:id/gate
router.get('/children/:id/gate', authRequired, (req, res) => {
  const childId = Number(req.params.id);
  if (!canAccessChild(req.user, childId)) return res.status(403).json({ error: 'Forbidden' });
  res.json(computeGate(childId));
});

module.exports = router;
module.exports.computeGate = computeGate;
