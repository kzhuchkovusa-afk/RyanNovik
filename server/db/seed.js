const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const db = require('./index');

const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schemaSql);

const adminUsername = process.env.ADMIN_USERNAME || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(adminUsername);
if (!existing) {
  const hash = bcrypt.hashSync(adminPassword, 10);
  db.prepare(
    `INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')`
  ).run(adminUsername, hash);
  console.log(`✔ Created admin user: ${adminUsername} / ${adminPassword}`);
} else {
  console.log(`• Admin user "${adminUsername}" already exists.`);
}

// Demo child (only if no children yet)
const anyChild = db.prepare(`SELECT id FROM users WHERE role = 'child' LIMIT 1`).get();
if (!anyChild) {
  const childHash = bcrypt.hashSync('emma123', 10);
  const info = db
    .prepare(
      `INSERT INTO users (username, password_hash, role, child_name, age, theme, interests, favorite_colors, parent_email)
       VALUES (?, ?, 'child', ?, ?, ?, ?, ?, ?)`
    )
    .run('emma', childHash, 'Emma', 7, 'dinosaurs', 'T-Rex, volcanoes, fossils', 'green, orange', 'parent@example.com');
  const childId = info.lastInsertRowid;

  const memoryConfig = {
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

  const insertGame = db.prepare(
    `INSERT INTO games (child_id, game_type, game_name, game_config) VALUES (?, ?, ?, ?)`
  );
  insertGame.run(childId, 'memory', 'Dino Memory Match', JSON.stringify(memoryConfig));
  insertGame.run(childId, 'attention', 'Dino Focus Finder', JSON.stringify(attentionConfig));
  insertGame.run(childId, 'speed', 'Dino Speed Dash', JSON.stringify(speedConfig));

  console.log('✔ Created demo child: emma / emma123 (with 3 dinosaur games)');
} else {
  console.log('• At least one child already exists — skipping demo seed.');
}

console.log('Done.');
