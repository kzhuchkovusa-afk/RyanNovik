// Generic starting configs used when the admin clicks "+ Memory", etc.
// The admin is then expected to edit the JSON to personalize per child.

const PALETTE = {
  default: { primary: '#6c5ce7', secondary: '#fdcb6e', background: '#fffaf0' },
  dinosaurs: { primary: '#2D8B4E', secondary: '#F4A623', background: '#FFF8E7' },
  princesses: { primary: '#fd79a8', secondary: '#ffeaa7', background: '#fff5fa' },
  space: { primary: '#341f97', secondary: '#feca57', background: '#1e1a4f' },
  ocean: { primary: '#0984e3', secondary: '#81ecec', background: '#eaf6ff' }
};

const PACK = {
  dinosaurs: ['🦖', '🦕', '🌋', '🦴', '🥚', '🐾', '🌿', '☄️'],
  princesses: ['👑', '🏰', '🦄', '🌹', '💎', '👗', '🪄', '🐎'],
  space: ['🚀', '🌎', '🌕', '⭐', '🛸', '👽', '☄️', '🪐'],
  ocean: ['🐠', '🐙', '🦀', '🐳', '🦈', '🐚', '⛵', '🏝️'],
  default: ['🍎', '🌟', '🎈', '🎯', '🦋', '🌈', '🍦', '🎁']
};

function packFor(theme) {
  const key = (theme || '').toLowerCase();
  for (const k of Object.keys(PACK)) if (key.includes(k.replace(/s$/, ''))) return { items: PACK[k], colors: PALETTE[k] };
  return { items: PACK.default, colors: PALETTE.default };
}

export function memoryTemplate(child) {
  const { items, colors } = packFor(child.theme);
  return {
    child_name: child.child_name,
    theme: child.theme || 'general',
    cards: items.map((emoji) => ({ name: emoji, emoji })),
    colors,
    difficulty_levels: {
      easy: { pairs: 4, time_limit: null },
      medium: { pairs: 6, time_limit: 60 },
      hard: { pairs: 8, time_limit: 45 }
    }
  };
}

export function attentionTemplate(child) {
  const { items, colors } = packFor(child.theme);
  return {
    child_name: child.child_name,
    theme: child.theme || 'general',
    items: items.map((emoji) => ({ emoji, label: emoji })),
    colors,
    difficulty_levels: {
      easy: { grid: 4, rounds: 5, time_per_round: 8 },
      medium: { grid: 6, rounds: 7, time_per_round: 6 },
      hard: { grid: 9, rounds: 10, time_per_round: 4 }
    }
  };
}

export function speedTemplate(child) {
  const { items, colors } = packFor(child.theme);
  // generic "pick the X" prompts using the theme pack
  const questions = items.slice(0, 4).map((emoji, i) => {
    const options = [emoji, items[(i + 1) % items.length], items[(i + 2) % items.length]];
    // shuffle deterministically per i
    const idx = i % 3;
    const shuffled = [...options];
    [shuffled[0], shuffled[idx]] = [shuffled[idx], shuffled[0]];
    return {
      prompt: `Tap the ${emoji}!`,
      options: shuffled,
      correct: shuffled.indexOf(emoji)
    };
  });
  return {
    child_name: child.child_name,
    theme: child.theme || 'general',
    questions,
    colors,
    difficulty_levels: {
      easy: { rounds: 6, time_per_question: 5 },
      medium: { rounds: 10, time_per_question: 3 },
      hard: { rounds: 14, time_per_question: 2 }
    }
  };
}
