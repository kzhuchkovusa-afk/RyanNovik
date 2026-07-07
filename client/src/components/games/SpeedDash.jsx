import { useEffect, useMemo, useRef, useState } from 'react';

// Speed Dash — tap the correct answer fast.
// Score normalization:
//   acc      = correct / total
//   speed    = clamp((1500 - avgReactionMs) / 1500, 0, 1)
//   streakF  = clamp(bestStreak / 10, 0, 1)
//   score    = round(100 * (0.50*acc + 0.35*speed + 0.15*streakF))

// Accept both shapes: Kirill's Phase-4 config uses per-topic banks
// (`soccer: [...], racing: [...]`) with `{q, a, correct}`; the older
// configs use a flat `questions: [{prompt, options, correct}]`.
function normalizeQuestions(config) {
  const from = (item) => {
    if (!item) return null;
    const prompt = item.prompt ?? item.q ?? '';
    const options = item.options ?? item.a ?? [];
    const correct = Number(item.correct) || 0;
    if (!prompt || !Array.isArray(options) || !options.length) return null;
    return { prompt, options, correct };
  };
  const out = [];
  if (Array.isArray(config.questions)) out.push(...config.questions.map(from).filter(Boolean));
  for (const bankKey of ['soccer', 'racing', 'sports']) {
    if (Array.isArray(config[bankKey])) out.push(...config[bankKey].map(from).filter(Boolean));
  }
  return out.length ? out : null;
}

const DEFAULTS = {
  questions: [
    { prompt: 'Tap the 🍎', options: ['🍎', '🍊', '🍋'], correct: 0 },
    { prompt: 'Tap the 🐶', options: ['🐱', '🐶', '🐰'], correct: 1 },
    { prompt: 'Tap the ⭐', options: ['🌙', '☀️', '⭐'], correct: 2 }
  ],
  colors: { primary: '#6c5ce7', secondary: '#fdcb6e', background: '#fffaf0' },
  difficulty_levels: {
    easy: { rounds: 6, time_per_question: 5 },
    medium: { rounds: 10, time_per_question: 3 },
    hard: { rounds: 14, time_per_question: 2 }
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

export default function SpeedDash({ config = {}, stopSignal, sdk }) {
  // Kirill's Phase-4 config splits questions into `soccer` + `racing`
  // banks with `{q, a, correct}`; older configs use a flat `questions`
  // array with `{prompt, options, correct}`. Normalize.
  const src = normalizeQuestions(config) || DEFAULTS.questions;
  const colors = {
    ...DEFAULTS.colors,
    ...(config.colors || {}),
    ...(config.accent ? { primary: config.accent } : {})
  };
  const difficulty = config.difficulty || 'easy';
  const level = (config.difficulty_levels && config.difficulty_levels[difficulty]) || DEFAULTS.difficulty_levels[difficulty] || DEFAULTS.difficulty_levels.easy;
  const totalRounds = Math.max(1, Math.min(config.maxLevel ? config.maxLevel * 2 : Infinity, level.rounds || 6));
  const cheerBank = Array.isArray(config.cheer) && config.cheer.length ? config.cheer : ['Fast!', 'Nice!', 'Sharp!'];

  // Adaptive timing (Phase-4): baseTimeMs shrinks toward minTimeMs by
  // speedStepMs per round after the no-fail practice window.
  const baseMs = Number(config.baseTimeMs) || (level.time_per_question * 1000) || 5000;
  const minMs = Number(config.minTimeMs) || 2000;
  const stepMs = Number(config.speedStepMs) || 0;
  const noFailRounds = Math.max(0, Number(config.noFailPracticeRounds) || 0);
  const secondsForRound = (r) => {
    if (r < noFailRounds) return baseMs / 1000;
    const stepped = Math.max(minMs, baseMs - stepMs * (r - noFailRounds));
    return stepped / 1000;
  };

  const queue = useMemo(() => {
    if (!src.length) return [];
    const out = [];
    while (out.length < totalRounds) out.push(...shuffle(src));
    return out.slice(0, totalRounds);
  }, [src, totalRounds]);

  const [round, setRound] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(secondsForRound(0));
  const [cheer, setCheer] = useState(null);
  const [picked, setPicked] = useState(null);
  const reactionsRef = useRef([]);  // ms per correct answer
  const streakRef = useRef({ current: 0, best: 0 });
  const roundStartRef = useRef(null);
  const startRef = useRef(Date.now());
  const finishedRef = useRef(false);

  useEffect(() => {
    setTimeLeft(secondsForRound(round));
    setPicked(null);
    setCheer(null);
    roundStartRef.current = Date.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  useEffect(() => {
    if (picked !== null) return;
    if (timeLeft <= 0) { pick(-1); return; }
    const id = setTimeout(() => setTimeLeft((t) => Math.max(0, t - 0.1)), 100);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, picked]);

  useEffect(() => {
    if (!stopSignal) return;
    finish('stopped:' + (stopSignal.reason || 'shell'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopSignal]);

  const finish = (reason = 'complete') => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const total = Math.max(1, round + (picked !== null ? 1 : 0));
    const acc = correctCount / total;
    const avgReactionMs = reactionsRef.current.length
      ? reactionsRef.current.reduce((a, b) => a + b, 0) / reactionsRef.current.length
      : 1500;
    const speed = Math.max(0, Math.min(1, (1500 - avgReactionMs) / 1500));
    const streakF = Math.max(0, Math.min(1, streakRef.current.best / 10));
    const score = Math.max(0, Math.min(100, Math.round(100 * (0.50 * acc + 0.35 * speed + 0.15 * streakF))));
    const durationSec = Math.round((Date.now() - startRef.current) / 1000);
    sdk.complete({
      skill: 'speed',
      score,
      level: round + (picked !== null ? 1 : 0),
      durationSec,
      raw: {
        rounds: totalRounds,
        completedRounds: round + (picked !== null ? 1 : 0),
        correct: correctCount,
        total,
        accuracy: Number(acc.toFixed(3)),
        avgReactionMs: Math.round(avgReactionMs),
        bestStreak: streakRef.current.best,
        finishReason: reason
      }
    });
  };

  const pick = (i) => {
    if (picked !== null) return;
    setPicked(i);
    const q = queue[round];
    const isCorrect = q && i === q.correct;
    if (isCorrect) {
      setCorrectCount((c) => c + 1);
      setCheer(cheerBank[Math.floor(Math.random() * cheerBank.length)]);
      const rt = Date.now() - (roundStartRef.current || Date.now());
      reactionsRef.current.push(rt);
      streakRef.current.current += 1;
      if (streakRef.current.current > streakRef.current.best) streakRef.current.best = streakRef.current.current;
    } else {
      streakRef.current.current = 0;
    }
    sdk.progress && sdk.progress(Math.round(((round + 1) / totalRounds) * 100));
    setTimeout(() => {
      if (round + 1 >= totalRounds) finish('complete');
      else setRound((r) => r + 1);
    }, 500);
  };

  const q = queue[round];
  if (!q) return <div style={{ padding: 24 }}>No questions configured.</div>;
  const pct = Math.max(0, (timeLeft / secondsForRound(round)) * 100);
  const isPractice = round < noFailRounds;

  return (
    <div style={{ minHeight: '100vh', background: colors.background, padding: 16, fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', maxWidth: 700, margin: '0 auto 8px' }}>
        <div style={{ fontWeight: 800, color: colors.primary }}>Round {round + 1}/{totalRounds}</div>
        <div style={{ fontWeight: 800, color: colors.primary }}>✓ {correctCount}</div>
        <div style={{ fontWeight: 800, color: colors.primary }}>⚡ {timeLeft.toFixed(1)}s</div>
      </div>
      <div style={{ maxWidth: 700, margin: '0 auto 14px', height: 10, background: 'rgba(0,0,0,0.08)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: colors.secondary || colors.primary, transition: 'width .1s linear' }} />
      </div>
      {isPractice && (
        <div style={{ textAlign: 'center', color: '#00b894', fontWeight: 700, fontSize: 13 }}>
          ✨ Practice round — no rush!
        </div>
      )}
      <div style={{ textAlign: 'center', fontSize: 26, fontWeight: 700, margin: '16px 0', color: colors.primary }}>
        {q.prompt}
      </div>
      {cheer && (
        <p style={{ textAlign: 'center', color: '#00b894', fontWeight: 800, fontSize: 18, marginTop: -8 }}>{cheer}</p>
      )}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: 14, maxWidth: 600, margin: '0 auto'
      }}>
        {q.options.map((opt, i) => {
          let bg = colors.secondary || '#fdcb6e';
          let color = '#2d3436';
          if (picked !== null) {
            if (i === q.correct) { bg = '#00b894'; color = 'white'; }
            else if (i === picked) { bg = '#e17055'; color = 'white'; }
          }
          return (
            <button
              key={i}
              onClick={() => pick(i)}
              disabled={picked !== null}
              style={{
                aspectRatio: '1', borderRadius: 16, background: bg, color,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 56, cursor: picked === null ? 'pointer' : 'default',
                border: 0, fontWeight: 700
              }}
            >
              {opt}
            </button>
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
