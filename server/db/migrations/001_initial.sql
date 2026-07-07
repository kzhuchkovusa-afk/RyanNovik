-- Migration 001 — the original single-tenant schema (Phase 0).
-- Idempotent: uses CREATE TABLE IF NOT EXISTS so a fresh DB and an existing
-- one both end up in the same state.

CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  username        TEXT NOT NULL UNIQUE,
  password_hash   TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('child', 'admin')),
  child_name      TEXT,
  age             INTEGER,
  theme           TEXT,
  interests       TEXT,
  favorite_colors TEXT,
  parent_email    TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS games (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_type   TEXT NOT NULL CHECK (game_type IN ('memory', 'attention', 'speed')),
  game_name   TEXT NOT NULL,
  game_config TEXT NOT NULL,
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_games_child ON games(child_id);

CREATE TABLE IF NOT EXISTS scores (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id           INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  score             INTEGER NOT NULL,
  difficulty_level  TEXT NOT NULL,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  played_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_scores_child ON scores(child_id);
CREATE INDEX IF NOT EXISTS idx_scores_game ON scores(game_id);
