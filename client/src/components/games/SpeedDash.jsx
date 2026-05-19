import { useEffect, useMemo, useRef, useState } from 'react';

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function SpeedDash({ config, difficulty, onFinish }) {
  const level = config.difficulty_levels?.[difficulty] || { rounds: 10, time_per_question: 3 };
  const queue = useMemo(() => {
    const qs = config.questions || [];
    if (!qs.length) return [];
    const out = [];
    while (out.length < level.rounds) out.push(...shuffle(qs));
    return out.slice(0, level.rounds);
  }, [config, level.rounds]);

  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(level.time_per_question);
  const [picked, setPicked] = useState(null);
  const startRef = useRef(Date.now());
  const finishedRef = useRef(false);

  useEffect(() => {
    setTimeLeft(level.time_per_question);
    setPicked(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  useEffect(() => {
    if (picked !== null) return;
    if (timeLeft <= 0) {
      pick(-1);
      return;
    }
    const id = setTimeout(() => setTimeLeft((t) => Math.max(0, t - 0.1)), 100);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, picked]);

  const current = queue[round];

  const pick = (i) => {
    if (picked !== null) return;
    setPicked(i);
    const correct = current && i === current.correct;
    if (correct) {
      const speedBonus = Math.round(timeLeft * 30);
      setScore((s) => s + 50 + speedBonus);
    }
    setTimeout(() => {
      if (round + 1 >= level.rounds) finish();
      else setRound((r) => r + 1);
    }, 600);
  };

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const elapsed = Math.round((Date.now() - startRef.current) / 1000);
    onFinish({ score, time_spent_seconds: elapsed });
  };

  if (!current) {
    return <div className="muted">No questions configured.</div>;
  }

  const pct = Math.max(0, (timeLeft / level.time_per_question) * 100);

  return (
    <div style={{ width: '100%' }}>
      <div className="player-header" style={{ marginBottom: 8 }}>
        <div className="score-display">Round {round + 1}/{level.rounds}</div>
        <div className="score-display">⭐ {score}</div>
        <div className="score-display">⚡ {timeLeft.toFixed(1)}s</div>
      </div>
      <div className="timer-bar"><div className="timer-fill" style={{ width: `${pct}%`, background: 'var(--pink)' }} /></div>
      <div className="speed-prompt">{current.prompt}</div>
      <div className="speed-options">
        {current.options.map((opt, i) => {
          let cls = 'speed-opt';
          if (picked !== null) {
            if (i === current.correct) cls += ' correct';
            else if (i === picked) cls += ' wrong';
          }
          return (
            <button key={i} className={cls} onClick={() => pick(i)} disabled={picked !== null}>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
