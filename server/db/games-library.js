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
      cards: {
        type: 'array', min: 4,
        item: { name: 'string', emoji: 'string' },
        example: [
          { name: 'T-Rex', emoji: '🦖' },
          { name: 'Triceratops', emoji: '🦕' }
        ]
      },
      colors: {
        type: 'object',
        shape: { primary: 'color', secondary: 'color', background: 'color' }
      },
      difficulty_levels: {
        type: 'object',
        shape: {
          easy: { pairs: 'int', time_limit: 'int|null' },
          medium: { pairs: 'int', time_limit: 'int|null' },
          hard: { pairs: 'int', time_limit: 'int|null' }
        }
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
      items: {
        type: 'array', min: 2,
        item: { emoji: 'string', label: 'string' },
        example: [{ emoji: '🦖', label: 'T-Rex' }, { emoji: '🦕', label: 'Triceratops' }]
      },
      colors: {
        type: 'object',
        shape: { primary: 'color', secondary: 'color', background: 'color' }
      },
      difficulty_levels: {
        type: 'object',
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
      theme: { type: 'string', example: 'dinosaurs' },
      questions: {
        type: 'array', min: 1,
        item: { prompt: 'string', options: 'string[]', correct: 'int' },
        example: [{ prompt: 'Tap the 🦖!', options: ['🦖', '🥚', '🌿'], correct: 0 }]
      },
      colors: {
        type: 'object',
        shape: { primary: 'color', secondary: 'color', background: 'color' }
      },
      difficulty_levels: {
        type: 'object',
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
