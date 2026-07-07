// The static library of game modules the platform ships with.
// Each entry is one row in games_library. `config_schema` is a light JSON
// description of the fields each game accepts — the admin editor uses it
// as the form definition (Phase 2+).

const MEMORY_MATCH = {
  key: 'memory_match',
  name: 'Memory Match',
  game_type: 'memory',
  module_url: '/game-host?key=memory_match',
  config_schema: {
    fields: {
      theme: { type: 'string', example: 'dinosaurs' },
      accent: { type: 'color', example: '#FF6B9D' },       // Phase 4
      // Either `cards: [{name,emoji}]` OR `faces: string[]` accepted.
      cards: {
        type: 'array', min: 4, optional: true,
        item: { name: 'string', emoji: 'string' },
        example: [{ name: 'T-Rex', emoji: '🦖' }]
      },
      faces: {                                              // Phase 4
        type: 'array', min: 4, optional: true,
        item: 'string',
        example: ['🦕', '🦖', '🦴']
      },
      cardBack: { type: 'string', optional: true, example: '🥚' },  // Phase 4
      cheer: { type: 'array', item: 'string', optional: true, example: ['Match! 🦕'] }, // Phase 4
      colors: {
        type: 'object', optional: true,
        shape: { primary: 'color', secondary: 'color', background: 'color' }
      },
      // Either `difficulty_levels` map OR `levels: [{pairs}]` array accepted.
      difficulty_levels: {
        type: 'object', optional: true,
        shape: {
          easy: { pairs: 'int', time_limit: 'int|null' },
          medium: { pairs: 'int', time_limit: 'int|null' },
          hard: { pairs: 'int', time_limit: 'int|null' }
        }
      },
      levels: {                                             // Phase 4
        type: 'array', optional: true,
        item: { pairs: 'int' },
        example: [{ pairs: 4 }, { pairs: 6 }, { pairs: 8 }]
      }
    }
  }
};

const FOCUS_FINDER = {
  key: 'focus_finder',
  name: 'Focus Finder',
  game_type: 'attention',
  module_url: '/game-host?key=focus_finder',
  config_schema: {
    fields: {
      theme: { type: 'string', example: 'dinosaurs' },
      accent: { type: 'color', example: '#4ECDC4' },        // Phase 4
      displayName: { type: 'string', optional: true, example: 'Brick Hunt' },
      // Accept string[] OR [{emoji,label}].
      items: {
        type: 'array', min: 2,
        item: 'string | { emoji: string, label: string }',
        example: ['🧱', '🐷', '🐮']
      },
      oddPairs: {                                           // Phase 4
        type: 'array', optional: true,
        item: 'string[2]',
        example: [['🟦', '🟥'], ['🚗', '🏎️']]
      },
      sceneNames: {                                         // Phase 4
        type: 'array', item: 'string', optional: true,
        example: ['Lego City', 'Minecraft Build']
      },
      winCheer: {                                           // Phase 4
        type: 'array', item: 'string', optional: true,
        example: ['Nice find!', 'Sharp eyes!']
      },
      maxLevel: { type: 'int', optional: true, example: 6 },
      colors: {
        type: 'object', optional: true,
        shape: { primary: 'color', secondary: 'color', background: 'color' }
      },
      difficulty_levels: {
        type: 'object', optional: true,
        shape: {
          easy:   { grid: 'int', rounds: 'int', time_per_round: 'int' },
          medium: { grid: 'int', rounds: 'int', time_per_round: 'int' },
          hard:   { grid: 'int', rounds: 'int', time_per_round: 'int' }
        }
      }
    }
  }
};

const SPEED_DASH = {
  key: 'speed_dash',
  name: 'Speed Dash',
  game_type: 'speed',
  module_url: '/game-host?key=speed_dash',
  config_schema: {
    fields: {
      theme: { type: 'string', example: 'sports' },
      accent: { type: 'color', example: '#FFE66D' },        // Phase 4
      displayName: { type: 'string', optional: true, example: 'Ref Rush' },
      // Accept either a flat `questions` array OR per-topic banks
      // (soccer/racing/sports). Each entry: {prompt|q, options|a, correct}.
      questions: {
        type: 'array', optional: true, min: 1,
        item: { prompt: 'string', options: 'string[]', correct: 'int' }
      },
      soccer: {                                             // Phase 4
        type: 'array', optional: true,
        item: { q: 'string', a: 'string[]', correct: 'int' }
      },
      racing: {                                             // Phase 4
        type: 'array', optional: true,
        item: { q: 'string', a: 'string[]', correct: 'int' }
      },
      cheer: { type: 'array', item: 'string', optional: true },
      // Adaptive timing (Phase 4 / Kirill needs a gentle ramp).
      baseTimeMs: { type: 'int', optional: true, example: 5000 },
      minTimeMs: { type: 'int', optional: true, example: 2200 },
      speedStepMs: { type: 'int', optional: true, example: 300 },
      noFailPracticeRounds: { type: 'int', optional: true, example: 3 },
      maxLevel: { type: 'int', optional: true, example: 6 },
      colors: {
        type: 'object', optional: true,
        shape: { primary: 'color', secondary: 'color', background: 'color' }
      },
      difficulty_levels: {
        type: 'object', optional: true,
        shape: {
          easy:   { rounds: 'int', time_per_question: 'int' },
          medium: { rounds: 'int', time_per_question: 'int' },
          hard:   { rounds: 'int', time_per_question: 'int' }
        }
      }
    }
  }
};

const GAMES_LIBRARY = [MEMORY_MATCH, FOCUS_FINDER, SPEED_DASH];

function seedGamesLibrary(db) {
  const upsert = db.prepare(`
    INSERT INTO games_library (key, name, game_type, module_url, config_schema)
    VALUES (@key, @name, @game_type, @module_url, @config_schema)
    ON CONFLICT (key) DO UPDATE SET
      name = excluded.name,
      game_type = excluded.game_type,
      module_url = excluded.module_url,
      config_schema = excluded.config_schema
  `);
  for (const g of GAMES_LIBRARY) {
    upsert.run({
      key: g.key,
      name: g.name,
      game_type: g.game_type,
      module_url: g.module_url,
      config_schema: JSON.stringify(g.config_schema)
    });
  }
}

module.exports = { GAMES_LIBRARY, seedGamesLibrary };
