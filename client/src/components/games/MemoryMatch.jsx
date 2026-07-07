import { useEffect, useMemo, useRef, useState } from 'react';

// Memory Match — pluggable via the KidsBrain Game Contract.
// Props are injected by SDKGameFrame in game-host/GameHost.jsx:
//   child, config, limits, locale, stopSignal, sdk
//
// config shape (see games-library.js config_schema):
//   { theme, cards[{name,emoji}], colors{primary,secondary,background},
//     difficulty_levels: { easy|medium|hard: { pairs, time_limit } },
//     difficulty?  // optional pre-selected level; default "easy" }
//
// Score normalization (see TASK_1.2 §"SCORE NORMALIZATION"):
//   eff    = perfectMoves / actualMoves     (perfectMoves = pairs)
//   gridF  = pairsCleared / maxPairs
//   score  = round(100 * (0.60*eff + 0.40*gridF))    →  0..100

// Kirill's Phase-4 config uses `faces: string[]`; older configs use
// `cards: [{name, emoji}]`. Both must load without editing game code.
function normalizeCards(config) {
  if (Array.isArray(config.cards) && config.cards.length) return config.cards;
  if (Array.isArray(config.faces) && config.faces.length) {
    return config.faces.map((emoji) => ({ name: emoji, emoji }));
  }
  return null;
}

// Kirill's `levels: [{pairs: 4}, {pairs: 6}, ...]` array vs older
// `difficulty_levels: {easy, medium, hard}` map. Difficulty strings map
// to array indexes 0..N-1.
function resolveLevel(config, difficulty) {
  if (config.difficulty_levels && config.difficulty_levels[difficulty]) {
    return config.difficulty_levels[difficulty];
  }
  if (Array.isArray(config.levels) && config.levels.length) {
    const idx = { easy: 0, medium: 1, hard: 2 }[difficulty] ?? 0;
    return config.levels[Math.min(idx, config.levels.length - 1)];
  }
  return null;
}

const DEFAULTS = {
  cards: [
    { name: 'Red', emoji: '🔴' }, { name: 'Blue', emoji: '🔵' },
    { name: 'Green', emoji: '🟢' }, { name: 'Yellow', emoji: '🟡' }
  ],
  colors: { primary: '#6c5ce7', secondary: '#fdcb6e', background: '#fffaf0' },
  difficulty_levels: {
    easy: { pairs: 4, time_limit: null },
    medium: { pairs: 6, time_limit: 60 },
    hard: { pairs: 8, time_limit: 45 }
  }
};

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function MemoryMatch({ config = {}, limits = {}, stopSignal, sdk }) {
  // Accept both card shapes: Kirill's Phase-4 config uses `faces:string[]`,
  // older configs use `cards:[{name,emoji}]`.
  const cards = normalizeCards(config) || DEFAULTS.cards;
  const colors = {
    ...DEFAULTS.colors,
    ...(config.colors || {}),
    ...(config.accent ? { primary: config.accent } : {})
  };
  const difficulty = config.difficulty || 'easy';
  // Accept two difficulty shapes: Kirill's Phase-4 `levels: [{pairs}]`
  // array (index 0 = easy) OR the older `difficulty_levels: {easy,medium,hard}` map.
  const level = resolveLevel(config, difficulty) || DEFAULTS.difficulty_levels[difficulty] || DEFAULTS.difficulty_levels.easy;
  const targetPairs = Math.max(1, Math.min(cards.length, level.pairs || 4));
  const cardBack = typeof config.cardBack === 'string' && config.cardBack ? config.cardBack : '❓';
  const cheerBank = Array.isArray(config.cheer) && config.cheer.length ? config.cheer : ['Match!', 'Great!', 'Nice one!'];

  const deck = useMemo(() => {
    const pool = cards.slice(0, targetPairs);
    const pairs = pool.flatMap((c, i) => [
      { id: `${i}-a`, key: c.name, emoji: c.emoji },
      { id: `${i}-b`, key: c.name, emoji: c.emoji }
    ]);
    return shuffle(pairs);
  }, [cards, targetPairs]);

  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState(new Set());
  const [moves, setMoves] = useState(0);
  const [timeLeft, setTimeLeft] = useState(level.time_limit);
  const [cheer, setCheer] = useState(null);
  const startRef = useRef(Date.now());
  const finishedRef = useRef(false);

  // Score computed from the metrics ratios, not accumulated during play.
  const finish = (reason = 'complete') => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const pairsCleared = matched.size / 2;
    const perfectMoves = targetPairs;                       // one flip-pair per pair
    const actualMoves = Math.max(moves, perfectMoves);      // no free wins
    const eff = perfectMoves / actualMoves;
    const gridF = pairsCleared / targetPairs;
    const score = Math.round(100 * (0.60 * eff + 0.40 * gridF));
    const durationSec = Math.round((Date.now() - startRef.current) / 1000);
    sdk.complete({
      skill: 'memory',
      score,
      level: targetPairs,
      durationSec,
      raw: {
        pairs: targetPairs,
        pairsCleared,
        actualMoves,
        perfectMoves,
        efficiency: Number(eff.toFixed(3)),
        gridFraction: Number(gridF.toFixed(3)),
        finishReason: reason
      }
    });
  };

  // Countdown timer (only if the difficulty has a time_limit).
  useEffect(() => {
    if (level.time_limit == null) return;
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t == null) return t;
        if (t <= 1) {
          clearInterval(id);
          finish('timeout');
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Win when all matched.
  useEffect(() => {
    if (matched.size === targetPairs * 2 && targetPairs > 0) {
      finish('cleared');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matched, targetPairs]);

  // Report live progress on every match.
  useEffect(() => {
    const pct = Math.round((matched.size / (targetPairs * 2)) * 100);
    if (pct > 0 && sdk.progress) sdk.progress(pct);
  }, [matched, targetPairs, sdk]);

  // Shell asked us to stop.
  useEffect(() => {
    if (!stopSignal) return;
    finish('stopped:' + (stopSignal.reason || 'shell'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopSignal]);

  const flip = (card) => {
    if (finishedRef.current) return;
    if (matched.has(card.id) || flipped.find((c) => c.id === card.id)) return;
    if (flipped.length === 2) return;
    const next = [...flipped, card];
    setFlipped(next);
    if (next.length === 2) {
      setMoves((m) => m + 1);
      if (next[0].key === next[1].key) {
        setCheer(cheerBank[Math.floor(Math.random() * cheerBank.length)]);
        setTimeout(() => {
          setMatched((m) => new Set([...m, next[0].id, next[1].id]));
          setFlipped([]);
        }, 400);
        setTimeout(() => setCheer(null), 1100);
      } else {
        setTimeout(() => setFlipped([]), 800);
      }
    }
  };

  const cols = Math.min(4, Math.ceil(Math.sqrt(deck.length)));
  return (
    <div style={{ minHeight: '100vh', background: colors.background, padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', maxWidth: 700, margin: '0 auto 16px' }}>
        <div style={{ fontWeight: 800, color: colors.primary }}>Moves: {moves}</div>
        <div style={{ fontWeight: 800, color: colors.primary }}>Matched: {matched.size / 2}/{targetPairs}</div>
        {level.time_limit != null && <div style={{ fontWeight: 800, color: colors.primary }}>⏱ {timeLeft}s</div>}
      </div>
      {cheer && (
        <div style={{ textAlign: 'center', color: '#00b894', fontWeight: 800, marginBottom: 10 }}>{cheer}</div>
      )}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, minmax(60px, 110px))`,
        gap: 10,
        maxWidth: cols * 120,
        margin: '0 auto'
      }}>
        {deck.map((c) => {
          const isFlipped = flipped.find((f) => f.id === c.id) || matched.has(c.id);
          const isMatched = matched.has(c.id);
          const bg = isMatched ? '#00b894' : isFlipped ? '#ffffff' : colors.primary;
          const color = isFlipped && !isMatched ? '#2d3436' : 'white';
          const border = isFlipped && !isMatched ? `3px solid ${colors.primary}` : 'none';
          return (
            <div
              key={c.id}
              onClick={() => flip(c)}
              style={{
                aspectRatio: '1',
                borderRadius: 14,
                background: bg,
                color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 44, cursor: 'pointer', userSelect: 'none', border,
                boxShadow: '0 4px 0 rgba(0,0,0,0.15)'
              }}
            >
              {isFlipped ? c.emoji : cardBack}
            </div>
          );
        })}
      </div>
      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <button
          onClick={() => sdk.exit()}
          style={{ background: 'transparent', color: colors.primary, border: `2px solid ${colors.primary}`, padding: '8px 16px', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}
        >
          Exit
        </button>
      </div>
    </div>
  );
}
