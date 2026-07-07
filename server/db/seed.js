// Idempotent bootstrapper: run schema migrations + data migrations + demo seed.
// Safe to run repeatedly — each step guards itself.

const bcrypt = require('bcryptjs');
require('dotenv').config();

const db = require('./index');
const { runAll } = require('./migrate');

runAll();

// --- Admin user (unchanged from Phase 0) ------------------------------------
const adminUsername = process.env.ADMIN_USERNAME || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get(adminUsername);
if (!existingAdmin) {
  const hash = bcrypt.hashSync(adminPassword, 10);
  db.prepare(`INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')`).run(adminUsername, hash);
  console.log(`✔ Created admin user: ${adminUsername} / ${adminPassword}`);
} else {
  console.log(`• Admin user "${adminUsername}" already exists.`);
}

// --- Demo child (only if no child exists) -----------------------------------
// The Phase-1 migration will have moved this child's assignments in the same
// pass, so a fresh install ends up with clients/children/assignments/limits
// all populated.
const anyChild = db.prepare(`SELECT id FROM users WHERE role = 'child' LIMIT 1`).get();
if (!anyChild) {
  const childHash = bcrypt.hashSync('emma123', 10);
  const clientRow = db.prepare(`SELECT id FROM clients WHERE name = ?`).get('KidsBrain (default)');
  const info = db
    .prepare(
      `INSERT INTO users (username, password_hash, role, child_name, age, theme, interests, favorite_colors, parent_email, client_id, avatar)
       VALUES (?, ?, 'child', ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      'emma', childHash,
      'Emma', 7, 'dinosaurs', 'T-Rex, volcanoes, fossils', 'green, orange',
      'parent@example.com',
      clientRow ? clientRow.id : null,
      '🦖'
    );
  const childId = info.lastInsertRowid;

  // Grant Emma a fresh access_token now that column exists.
  db.prepare(`UPDATE users SET access_token = lower(hex(randomblob(16))) WHERE id = ?`).run(childId);

  const memoryConfig = {
    child_name: 'Emma',
    theme: 'dinosaurs',
    cards: [
      { name: 'T-Rex', emoji: '🦖' },
      { name: 'Triceratops', emoji: '🦕' },
      { name: 'Volcano', emoji: '🌋' },
      { name: 'Fossil', emoji: '🦴' },
      { name: 'Egg', emoji: '🥚' },
      { name: 'Footprint', emoji: '🐾' },
      { name: 'Leaf', emoji: '🌿' },
      { name: 'Meteor', emoji: '☄️' }
    ],
    colors: { primary: '#2D8B4E', secondary: '#F4A623', background: '#FFF8E7' },
    difficulty_levels: {
      easy: { pairs: 4, time_limit: null },
      medium: { pairs: 6, time_limit: 60 },
      hard: { pairs: 8, time_limit: 45 }
    }
  };
  const attentionConfig = {
    child_name: 'Emma',
    theme: 'dinosaurs',
    items: [
      { emoji: '🦖', label: 'T-Rex' },
      { emoji: '🦕', label: 'Triceratops' },
      { emoji: '🌋', label: 'Volcano' },
      { emoji: '🦴', label: 'Fossil' },
      { emoji: '🥚', label: 'Egg' },
      { emoji: '🐾', label: 'Footprint' }
    ],
    colors: { primary: '#2D8B4E', secondary: '#F4A623', background: '#FFF8E7' },
    difficulty_levels: {
      easy: { grid: 4, rounds: 5, time_per_round: 8 },
      medium: { grid: 6, rounds: 7, time_per_round: 6 },
      hard: { grid: 9, rounds: 10, time_per_round: 4 }
    }
  };
  const speedConfig = {
    child_name: 'Emma',
    theme: 'dinosaurs',
    questions: [
      { prompt: 'Which one ROARS the loudest?', options: ['🦖', '🥚', '🌿'], correct: 0 },
      { prompt: 'Which one HATCHES?', options: ['🌋', '🥚', '🦴'], correct: 1 },
      { prompt: 'Which one ERUPTS?', options: ['🌿', '🐾', '🌋'], correct: 2 },
      { prompt: 'Which is a FOSSIL?', options: ['🦴', '☄️', '🌿'], correct: 0 },
      { prompt: 'Which one FLIES from space?', options: ['🦕', '☄️', '🦖'], correct: 1 },
      { prompt: 'Which has THREE HORNS?', options: ['🦖', '🌋', '🦕'], correct: 2 }
    ],
    colors: { primary: '#2D8B4E', secondary: '#F4A623', background: '#FFF8E7' },
    difficulty_levels: {
      easy: { rounds: 6, time_per_question: 5 },
      medium: { rounds: 10, time_per_question: 3 },
      hard: { rounds: 14, time_per_question: 2 }
    }
  };

  // Phase-3 (Task 3.3): legacy `games` table is retired; assignments +
  // games_library are the only source of truth.
  const library = db.prepare(`SELECT id, game_type FROM games_library`).all();
  const byType = Object.fromEntries(library.map((r) => [r.game_type, r.id]));
  const insertAssignment = db.prepare(`
    INSERT OR IGNORE INTO assignments (child_id, game_id, config, unlocked, sort_order)
    VALUES (?, ?, ?, 1, ?)
  `);
  insertAssignment.run(childId, byType.memory, JSON.stringify(memoryConfig), 1);
  insertAssignment.run(childId, byType.attention, JSON.stringify(attentionConfig), 2);
  insertAssignment.run(childId, byType.speed, JSON.stringify(speedConfig), 3);

  // Default limits row (nulls = unrestricted).
  db.prepare(`INSERT OR IGNORE INTO limits (child_id) VALUES (?)`).run(childId);

  console.log('✔ Created demo child: emma / emma123 (with 3 dinosaur games)');
} else {
  console.log('• At least one child already exists — skipping demo seed.');
}

console.log('Done.');
