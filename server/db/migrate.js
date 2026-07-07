// Migration runner. Applies /migrations/*.sql once each, tracked in _migrations,
// then runs the JS data-migration for Phase 1 (Task 1.3).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const db = require('./index');
const { seedGamesLibrary, GAMES_LIBRARY } = require('./games-library');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

function ensureMigrationsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name       TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function appliedMigrations() {
  const rows = db.prepare('SELECT name FROM _migrations').all();
  return new Set(rows.map((r) => r.name));
}

function applySqlMigrations() {
  ensureMigrationsTable();
  const applied = appliedMigrations();
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const f of files) {
    if (applied.has(f)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8');
    const tx = db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(f);
    });
    tx();
    console.log(`  ✔ migration ${f}`);
  }
}

// SQLite ADD COLUMN doesn't accept IF NOT EXISTS — do it defensively.
function hasColumn(table, col) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all();
  return rows.some((r) => r.name === col);
}
function addColumnIfMissing(table, col, decl) {
  if (hasColumn(table, col)) return false;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${decl}`);
  return true;
}

function tableExists(name) {
  return !!db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(name);
}

function randomAccessToken() {
  return crypto.randomBytes(24).toString('base64url');
}

// The Phase-1 JS data migration. Idempotent via _migrations flags:
// each step records itself as _migrations name "phase1_<step>" so re-runs skip.
function runPhase1DataMigration() {
  ensureMigrationsTable();
  const applied = appliedMigrations();
  const stamp = (name, fn) => {
    if (applied.has(name)) return;
    const tx = db.transaction(fn);
    tx();
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(name);
    console.log(`  ✔ ${name}`);
  };

  // Step A — extra columns on existing tables.
  stamp('phase1_alter_users', () => {
    addColumnIfMissing('users', 'client_id', 'INTEGER REFERENCES clients(id)');
    addColumnIfMissing('users', 'avatar', 'TEXT');
    addColumnIfMissing('users', 'access_token', 'TEXT');
  });

  stamp('phase1_alter_scores', () => {
    addColumnIfMissing('scores', 'level', 'INTEGER');
    addColumnIfMissing('scores', 'raw', 'TEXT');
    // Reference to the games_library. Legacy scores.game_id points at the old
    // per-child games table; we keep it for FK integrity but ALSO record the
    // library id, which is what the new /summary endpoint groups by.
    addColumnIfMissing('scores', 'game_library_id', 'INTEGER REFERENCES games_library(id)');
  });

  // Step B — a default client so existing children have somewhere to live.
  stamp('phase1_default_client', () => {
    const existing = db.prepare('SELECT id FROM clients WHERE name = ?').get('KidsBrain (default)');
    if (!existing) {
      db.prepare('INSERT INTO clients (name, contact, plan) VALUES (?, ?, ?)')
        .run('KidsBrain (default)', 'owner@kidsbrain.local', 'default');
    }
  });

  stamp('phase1_backfill_users', () => {
    const client = db.prepare(`SELECT id FROM clients WHERE name = ?`).get('KidsBrain (default)');
    if (!client) return;
    // Every child without a client_id joins the default client.
    db.prepare(`UPDATE users SET client_id = ? WHERE role = 'child' AND client_id IS NULL`).run(client.id);
    // Every child needs an access_token for the future magic-link login.
    const missing = db.prepare(`SELECT id FROM users WHERE role = 'child' AND (access_token IS NULL OR access_token = '')`).all();
    const upd = db.prepare(`UPDATE users SET access_token = ? WHERE id = ?`);
    for (const u of missing) upd.run(randomAccessToken(), u.id);
  });

  // Step C — seed the games library (memory_match / focus_finder / speed_dash).
  stamp('phase1_seed_games_library', () => {
    seedGamesLibrary(db);
  });

  // Step D — migrate legacy per-child rows in "games" into "assignments".
  // The old "games" table is left in place (nothing else in the DB depends on
  // its non-FK columns) so scores.game_id still resolves; new writes use
  // scores.game_library_id.
  stamp('phase1_migrate_games_to_assignments', () => {
    if (!tableExists('games')) return;
    const legacy = db.prepare(`
      SELECT id, child_id, game_type, game_name, game_config, is_active, created_at
      FROM games ORDER BY child_id, id
    `).all();
    const byType = Object.fromEntries(
      db.prepare(`SELECT id, game_type FROM games_library`).all().map((r) => [r.game_type, r.id])
    );
    let orderCounter = {};
    const insertAssignment = db.prepare(`
      INSERT OR IGNORE INTO assignments (child_id, game_id, config, unlocked, sort_order, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const backfillScore = db.prepare(`
      UPDATE scores SET game_library_id = ? WHERE game_id = ? AND game_library_id IS NULL
    `);
    for (const row of legacy) {
      const libId = byType[row.game_type];
      if (!libId) continue;
      orderCounter[row.child_id] = (orderCounter[row.child_id] || 0) + 1;
      insertAssignment.run(
        row.child_id,
        libId,
        row.game_config,
        row.is_active ? 1 : 0,
        orderCounter[row.child_id],
        row.created_at
      );
      backfillScore.run(libId, row.id);
    }
  });

  // Step E — every child gets a limits row (defaults null → no restriction).
  stamp('phase1_seed_limits', () => {
    const kids = db.prepare(`SELECT id FROM users WHERE role = 'child'`).all();
    const ins = db.prepare(`
      INSERT OR IGNORE INTO limits (child_id, daily_seconds_cap, max_session_seconds, paused)
      VALUES (?, NULL, NULL, 0)
    `);
    for (const k of kids) ins.run(k.id);
  });
}

function runAll() {
  applySqlMigrations();
  runPhase1DataMigration();
}

module.exports = { runAll };
