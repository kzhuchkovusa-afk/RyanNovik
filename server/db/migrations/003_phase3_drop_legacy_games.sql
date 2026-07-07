-- Migration 003 — Phase 3, Task 3.3: retire the legacy per-child `games`
-- table. Nothing on the server writes to it anymore (children.js and
-- scores.js were rewritten to use assignments + games_library) and the
-- admin panel now targets those tables directly.
--
-- SQLite doesn't allow dropping a FK-referenced table without rebuilding
-- the referencing table, so we:
--   1. Rename `games` → `games_legacy_backup` (data preserved for one
--      release cycle; can be dropped once the owner confirms nothing needs it).
--   2. Rewrite `scores` without the FK to the legacy table. game_id is
--      still stored (as a nullable integer, no FK) so historical rows are
--      preserved; new writes leave it 0 (see scores.js).
--
-- The order here matters: we copy scores to a new table with fewer FKs
-- before renaming, so foreign_keys=ON doesn't fight us.
-- NOTE: the migration runner (migrate.js) already wraps each file in a
-- transaction; do NOT add BEGIN/COMMIT here.

-- Step 1 — new scores table without the legacy games FK.
CREATE TABLE IF NOT EXISTS scores_new (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id            INTEGER,                                          -- legacy pointer, no FK
  game_library_id    INTEGER REFERENCES games_library(id) ON DELETE SET NULL,
  score              INTEGER NOT NULL,
  difficulty_level   TEXT NOT NULL,
  time_spent_seconds INTEGER NOT NULL DEFAULT 0,
  level              INTEGER,
  raw                TEXT,
  played_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO scores_new
  (id, child_id, game_id, game_library_id, score, difficulty_level,
   time_spent_seconds, level, raw, played_at)
SELECT
  id, child_id, game_id, game_library_id, score, difficulty_level,
  time_spent_seconds, level, raw, played_at
FROM scores;

-- Step 2 — swap tables.
DROP TABLE scores;
ALTER TABLE scores_new RENAME TO scores;
CREATE INDEX IF NOT EXISTS idx_scores_child ON scores(child_id);
CREATE INDEX IF NOT EXISTS idx_scores_lib   ON scores(game_library_id);

-- Step 3 — rename legacy games table to its backup name. Kept for one
-- release cycle so we can restore assignments-config if a migration went
-- sideways. Owner can drop it via `DROP TABLE games_legacy_backup;` once
-- happy.
ALTER TABLE games RENAME TO games_legacy_backup;
