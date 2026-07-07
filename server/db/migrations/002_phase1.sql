-- Migration 002 — Phase 1: multi-tenant + game contract.
-- STEP 0 reconciliation:
--   * Skill source stays games.game_type ENUM (memory|attention|speed).
--   * Score storage stays the scores table; we EXTEND it, not rename.
--   * Existing per-child rows in "games" get remapped into a games library
--     + assignments in the seed step (see migrate.js), not in raw SQL,
--     because we need to preserve every foreign key on scores.

-- 1. New tables --------------------------------------------------------------

CREATE TABLE IF NOT EXISTS clients (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  contact    TEXT,
  plan       TEXT NOT NULL DEFAULT 'default',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS parents (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id  INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  email      TEXT UNIQUE,
  pin        TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS parent_child_links (
  parent_id  INTEGER NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  child_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (parent_id, child_id)
);

CREATE TABLE IF NOT EXISTS games_library (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  key           TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  game_type     TEXT NOT NULL CHECK (game_type IN ('memory', 'attention', 'speed')),
  module_url    TEXT NOT NULL,
  config_schema TEXT NOT NULL,        -- JSON schema of accepted config fields
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS assignments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id    INTEGER NOT NULL REFERENCES games_library(id) ON DELETE CASCADE,
  config     TEXT NOT NULL,           -- JSON — the per-child theme pack
  unlocked   INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (child_id, game_id)
);

CREATE INDEX IF NOT EXISTS idx_assignments_child ON assignments(child_id);

CREATE TABLE IF NOT EXISTS limits (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id            INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  daily_seconds_cap   INTEGER,
  max_session_seconds INTEGER,
  allowed_hours       TEXT,           -- JSON: [[startHour,endHour], ...]  null = any
  allowed_days        TEXT,           -- JSON: [0..6]                       null = any
  paused              INTEGER NOT NULL DEFAULT 0,
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Additive column changes -------------------------------------------------
-- SQLite lacks IF NOT EXISTS on ADD COLUMN; migrate.js guards each ALTER.

-- users:  client_id, avatar, access_token   (see migrate.js)
-- scores: level, raw, game_library_id       (see migrate.js)
-- games_library rows + assignments rows for legacy per-child games: seeded in migrate.js
