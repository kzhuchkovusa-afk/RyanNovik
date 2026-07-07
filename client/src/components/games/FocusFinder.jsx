import { useEffect, useRef, useState } from 'react';

// Focus Finder — spot the odd one out.
// Score normalization:
//   acc         = correct / total
//   distResist  = 1 - (wrongTaps / max(taps,1))
//   levelF      = level / maxLevel   (level == final round reached)
//   score       = round(100 * (0.40*acc + 0.30*distResist + 0.30*levelF))

// Kirill's Phase-4 config uses `items` as a flat string[] of emojis.
// The Emma/default configs use `items: [{emoji, label}]`. Both must
// load without editing game code (per PHASE4 STEP-0).
function normalizeItems(items) {
  if (!Array.isArray(items) || !items.length) return null;
  return items.map((x) =>
    typeof x === 'string' ? { emoji: x, label: x } : x
  ).filter((x) => x && typeof x.emoji === 'string');
}

const DEFAULTS = {
  items: [
    { emoji: '🍎', label: 'apple' }, { emoji: '🍊', label: 'orange' },
    { emoji: '🍋', label: 'lemon' }, { emoji: '🍇', label: 'grapes' }
  ],
  colors: { primary: '#6c5ce7', secondary: '#fdcb6e', background: '#fffaf0' },
  difficulty_levels: {
    easy: { grid: 4, rounds: 5, time_per_round: 8 },
    medium: { grid: 6, rounds: 7, time_per_round: 6 },
    hard: { grid: 9, rounds: 10, time_per_round: 4 }
  }
};

export default function FocusFinder({ config = {}, stopSignal, sdk }) {
  // Kirill's Phase-4 config uses items:string[] + accent + sceneNames +
  // winCheer + oddPairs; older configs use items:[{emoji,label}] +
  // difficulty_levels. Normalize both shapes to the internal one.
  const items = normalizeItems(config.items) || DEFAULTS.items;
  const colors = {
    ...DEFAULTS.colors,
    ...(config.colors || {}),
    ...(config.accent ? { primary: config.accent } : {})
  };
  const difficulty = config.difficulty || 'easy';
  const level = (config.difficulty_levels && config.difficulty_levels[difficulty]) || DEFAULTS.difficulty_levels[difficulty] || DEFAULTS.difficulty_levels.easy;
  const totalRounds = Math.max(1, Math.min(config.maxLevel ? config.maxLevel * 2 : Infinity, level.rounds || 5));
  const sceneNames = Array.isArray(config.sceneNames) && config.sceneNames.length ? config.sceneNames : null;
  const oddPairs = Array.isArray(config.oddPairs) && config.oddPairs.length ? config.oddPairs : null;
  const winCheer = Array.isArray(config.winCheer) && config.winCheer.length ? config.winCheer : ['Great!', 'Sharp eyes!', 'Found it!'];

  const [round, setRound] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [wrongTaps, setWrongTaps] = useState(0);
  const [taps, setTaps] = useState(0);
  const [timeLeft, setTimeLeft] = useState(level.time_per_round);
  const [cells, setCells] = useState([]);
  const [oddIndex, setOddIndex] = useState(-1);
  const [feedback, setFeedback] = useState(null);
  const [cheer, setCheer] = useState(null);
  const startRef = useRef(Date.now());
  const finishedRef = useRef(false);
  const currentScene = sceneNames ? sceneNames[round % sceneNames.length] : null;

  const finish = (reason = 'complete') => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const total = Math.max(1, round + (feedback ? 1 : 0));
    const acc = correct / total;
    const distResist = 1 - (wrongTaps / Math.max(taps, 1));
    const reachedLevel = round + (feedback ? 1 : 0);
    const levelF = reachedLevel / totalRounds;
    const score = Math.max(0, Math.min(100, Math.round(100 * (0.40 * acc + 0.30 * distResist + 0.30 * levelF))));
    const durationSec = Math.round((Date.now() - startRef.current) / 1000);
    sdk.complete({
      skill: 'attention',
      score,
      level: reachedLevel,
      durationSec,
      raw: {
        rounds: totalRounds,
        completedRounds: reachedLevel,
        correct,
        total,
        wrongTaps,
        taps,
        accuracy: Number(acc.toFixed(3)),
        distractorResistance: Number(distResist.toFixed(3)),
        finishReason: reason
      }
    });
  };

  useEffect(() => {
    setupRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  useEffect(() => {
    if (feedback) return;
    if (timeLeft <= 0) { handleAnswer(-1); return; }
    const id = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, feedback]);

  useEffect(() => {
    if (!stopSignal) return;
    finish('stopped:' + (stopSignal.reason || 'shell'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopSignal]);

  const setupRound = () => {
    if (items.length < 2) return;
    // Prefer a hand-picked oddPair (Phase-4 config) when provided — falls
    // back to a random pair from `items` when none apply.
    let mainEmoji, oddEmoji;
    if (oddPairs && Math.random() < 0.7) {
      const pair = oddPairs[Math.floor(Math.random() * oddPairs.length)];
      mainEmoji = pair[0]; oddEmoji = pair[1];
    } else {
      const main = items[Math.floor(Math.random() * items.length)];
      let odd;
      do { odd = items[Math.floor(Math.random() * items.length)]; } while (odd.emoji === main.emoji);
      mainEmoji = main.emoji; oddEmoji = odd.emoji;
    }
    const size = Math.max(4, level.grid || 6);
    const arr = Array(size).fill(mainEmoji);
    const idx = Math.floor(Math.random() * size);
    arr[idx] = oddEmoji;
    setCells(arr);
    setOddIndex(idx);
    setTimeLeft(level.time_per_round);
    setFeedback(null);
    setCheer(null);
  };

  const handleAnswer = (i) => {
    if (feedback) return;
    const isCorrect = i === oddIndex;
    setTaps((t) => t + 1);
    if (i === -1) {
      // timeout counts as an incorrect round with no tap
    } else if (isCorrect) {
      setCorrect((c) => c + 1);
      setCheer(winCheer[Math.floor(Math.random() * winCheer.length)]);
    } else {
      setWrongTaps((w) => w + 1);
    }
    setFeedback({ index: i, correct: isCorrect });
    sdk.progress && sdk.progress(Math.round(((round + 1) / totalRounds) * 100));
    setTimeout(() => {
      if (round + 1 >= totalRounds) finish('complete');
      else setRound((r) => r + 1);
    }, 600);
  };

  const cols = Math.ceil(Math.sqrt(level.grid || 6));
  const pct = (timeLeft / (level.time_per_round || 1)) * 100;

  return (
    <div style={{ minHeight: '100vh', background: colors.background, padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', maxWidth: 700, margin: '0 auto 8px' }}>
        <div style={{ fontWeight: 800, color: colors.primary }}>Round {round + 1}/{totalRounds}</div>
        <div style={{ fontWeight: 800, color: colors.primary }}>✓ {correct}</div>
        <div style={{ fontWeight: 800, color: colors.primary }}>⏱ {timeLeft}s</div>
      </div>
      <div style={{ maxWidth: 700, margin: '0 auto 14px', height: 10, background: 'rgba(0,0,0,0.08)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: colors.primary, transition: 'width .1s linear' }} />
      </div>
      <p style={{ textAlign: 'center', fontWeight: 700, fontSize: 20, color: colors.primary }}>
        🔍 Tap the one that's DIFFERENT!
      </p>
      {currentScene && (
        <p style={{ textAlign: 'center', fontSize: 14, color: colors.primary, opacity: 0.7, marginTop: -6 }}>
          {currentScene}
        </p>
      )}
      {cheer && (
        <p style={{ textAlign: 'center', fontWeight: 800, color: '#00b894', fontSize: 18 }}>{cheer}</p>
      )}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, minmax(60px, 110px))`,
        gap: 12,
        maxWidth: cols * 120,
        margin: '18px auto'
      }}>
        {cells.map((emoji, i) => {
          let bg = '#f7f7f7', border = '3px solid rgba(0,0,0,0.06)';
          if (feedback && feedback.index === i) {
            if (feedback.correct) { bg = '#d1f7e8'; border = '3px solid #00b894'; }
            else { bg = '#ffe5dd'; border = '3px solid #e17055'; }
          } else if (feedback && !feedback.correct && i === oddIndex) {
            bg = '#d1f7e8'; border = '3px solid #00b894';
          }
          return (
            <div
              key={i}
              onClick={() => handleAnswer(i)}
              style={{
                aspectRatio: '1', borderRadius: 14, background: bg, border,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 48, cursor: 'pointer'
              }}
            >
              {emoji}
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
