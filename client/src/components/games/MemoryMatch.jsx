import { useEffect, useMemo, useRef, useState } from 'react';

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function MemoryMatch({ config, difficulty, onFinish }) {
  const level = config.difficulty_levels?.[difficulty] || { pairs: 6, time_limit: null };
  const colors = config.colors || {};

  const deck = useMemo(() => {
    const pool = (config.cards || []).slice(0, level.pairs);
    const pairs = pool.flatMap((c, i) => [
      { id: `${i}-a`, key: c.name, emoji: c.emoji },
      { id: `${i}-b`, key: c.name, emoji: c.emoji }
    ]);
    return shuffle(pairs);
  }, [config, level.pairs]);

  const [flipped, setFlipped] = useState([]); // ids currently shown
  const [matched, setMatched] = useState(new Set());
  const [moves, setMoves] = useState(0);
  const [timeLeft, setTimeLeft] = useState(level.time_limit);
  const startRef = useRef(Date.now());
  const finishedRef = useRef(false);

  // timer
  useEffect(() => {
    if (level.time_limit == null) return;
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t == null) return t;
        if (t <= 1) {
          clearInterval(id);
          finish(false);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // win detection
  useEffect(() => {
    if (matched.size === level.pairs * 2 && level.pairs > 0) {
      finish(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matched]);

  const finish = (won) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const elapsed = Math.round((Date.now() - startRef.current) / 1000);
    const base = level.pairs * 100;
    const movePenalty = Math.max(0, (moves - level.pairs) * 5);
    const timeBonus = level.time_limit ? (timeLeft ?? 0) * 5 : Math.max(0, 200 - elapsed * 2);
    const score = won ? Math.max(0, base - movePenalty + timeBonus) : Math.round(matched.size / 2) * 50;
    onFinish({ score, time_spent_seconds: elapsed });
  };

  const flip = (card) => {
    if (matched.has(card.id) || flipped.find((c) => c.id === card.id)) return;
    if (flipped.length === 2) return;
    const next = [...flipped, card];
    setFlipped(next);
    if (next.length === 2) {
      setMoves((m) => m + 1);
      if (next[0].key === next[1].key) {
        setTimeout(() => {
          setMatched((m) => new Set([...m, next[0].id, next[1].id]));
          setFlipped([]);
        }, 400);
      } else {
        setTimeout(() => setFlipped([]), 800);
      }
    }
  };

  const cols = Math.min(4, Math.ceil(Math.sqrt(deck.length)));

  return (
    <div style={{ width: '100%' }}>
      <div className="player-header" style={{ marginBottom: 12 }}>
        <div className="score-display">Moves: {moves}</div>
        <div className="score-display">Matched: {matched.size / 2}/{level.pairs}</div>
        {level.time_limit != null && <div className="score-display">⏱ {timeLeft}s</div>}
      </div>
      <div
        className="memory-grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(60px, 110px))`,
          maxWidth: cols * 120
        }}
      >
        {deck.map((c) => {
          const isFlipped = flipped.find((f) => f.id === c.id) || matched.has(c.id);
          const isMatched = matched.has(c.id);
          return (
            <div
              key={c.id}
              className={`mem-card ${isFlipped ? 'flipped' : ''} ${isMatched ? 'matched' : ''}`}
              style={isFlipped && !isMatched && colors.primary ? { borderColor: colors.primary } : undefined}
              onClick={() => flip(c)}
            >
              {isFlipped ? c.emoji : '❓'}
            </div>
          );
        })}
      </div>
    </div>
  );
}
