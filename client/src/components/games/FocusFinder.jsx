import { useEffect, useRef, useState } from 'react';

// Spot the odd one out: grid filled with one item, plus exactly one different item.
export default function FocusFinder({ config, difficulty, onFinish }) {
  const level = config.difficulty_levels?.[difficulty] || { grid: 6, rounds: 7, time_per_round: 6 };
  const items = config.items || [];

  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(level.time_per_round);
  const [cells, setCells] = useState([]);
  const [oddIndex, setOddIndex] = useState(-1);
  const [feedback, setFeedback] = useState(null); // { index, correct }
  const startRef = useRef(Date.now());
  const finishedRef = useRef(false);

  useEffect(() => {
    setupRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  useEffect(() => {
    if (feedback) return;
    if (timeLeft <= 0) {
      handleAnswer(-1); // timeout
      return;
    }
    const id = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, feedback]);

  const setupRound = () => {
    if (items.length < 2) return;
    const main = items[Math.floor(Math.random() * items.length)];
    let odd;
    do {
      odd = items[Math.floor(Math.random() * items.length)];
    } while (odd.emoji === main.emoji);
    const size = level.grid;
    const arr = Array(size).fill(main.emoji);
    const idx = Math.floor(Math.random() * size);
    arr[idx] = odd.emoji;
    setCells(arr);
    setOddIndex(idx);
    setTimeLeft(level.time_per_round);
    setFeedback(null);
  };

  const handleAnswer = (i) => {
    if (feedback) return;
    const correct = i === oddIndex;
    setFeedback({ index: i, correct });
    if (correct) {
      const bonus = Math.max(1, timeLeft) * 10;
      setScore((s) => s + 50 + bonus);
    }
    setTimeout(() => {
      if (round + 1 >= level.rounds) {
        finish();
      } else {
        setRound((r) => r + 1);
      }
    }, 700);
  };

  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    const elapsed = Math.round((Date.now() - startRef.current) / 1000);
    onFinish({ score, time_spent_seconds: elapsed });
  };

  const cols = Math.ceil(Math.sqrt(level.grid));
  const pct = (timeLeft / level.time_per_round) * 100;

  return (
    <div style={{ width: '100%' }}>
      <div className="player-header" style={{ marginBottom: 8 }}>
        <div className="score-display">Round {round + 1}/{level.rounds}</div>
        <div className="score-display">⭐ {score}</div>
        <div className="score-display">⏱ {timeLeft}s</div>
      </div>
      <div className="timer-bar"><div className="timer-fill" style={{ width: `${pct}%` }} /></div>
      <p style={{ textAlign: 'center', fontWeight: 700, fontSize: 20 }}>
        🔍 Tap the one that's DIFFERENT!
      </p>
      <div
        className="focus-grid"
        style={{
          gridTemplateColumns: `repeat(${cols}, minmax(60px, 110px))`,
          maxWidth: cols * 120
        }}
      >
        {cells.map((emoji, i) => {
          let cls = 'focus-item';
          if (feedback && feedback.index === i) cls += feedback.correct ? ' right' : ' wrong';
          else if (feedback && !feedback.correct && i === oddIndex) cls += ' right';
          return (
            <div key={i} className={cls} onClick={() => handleAnswer(i)}>
              {emoji}
            </div>
          );
        })}
      </div>
    </div>
  );
}
