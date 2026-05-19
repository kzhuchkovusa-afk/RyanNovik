import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../shared/Layout.jsx';
import { api } from '../../lib/api.js';
import MemoryMatch from '../games/MemoryMatch.jsx';
import FocusFinder from '../games/FocusFinder.jsx';
import SpeedDash from '../games/SpeedDash.jsx';

export default function GamePlayer() {
  const { id } = useParams();
  const nav = useNavigate();
  const [game, setGame] = useState(null);
  const [difficulty, setDifficulty] = useState('easy');
  const [phase, setPhase] = useState('select'); // 'select' | 'playing' | 'result'
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { game } = await api(`/games/${id}`);
      setGame(game);
    })();
  }, [id]);

  if (!game) return <div className="center-spinner">Loading game…</div>;

  const levels = game.game_config.difficulty_levels || {};
  const difficultyKeys = Object.keys(levels).length ? Object.keys(levels) : ['easy', 'medium', 'hard'];

  const finish = async ({ score, time_spent_seconds }) => {
    setResult({ score, time_spent_seconds });
    setPhase('result');
    setSaving(true);
    try {
      await api('/scores', {
        method: 'POST',
        body: {
          game_id: game.id,
          score,
          difficulty_level: difficulty,
          time_spent_seconds
        }
      });
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const start = () => {
    setResult(null);
    setPhase('playing');
  };

  return (
    <Layout role="child">
      <div className="player-shell">
        <div className="player-header">
          <div>
            <button className="btn-ghost" onClick={() => nav('/play')}>← Back to hub</button>
          </div>
          <h2 style={{ margin: 0 }}>{game.game_name}</h2>
          <div style={{ width: 80 }} />
        </div>

        {phase === 'select' && (
          <>
            <p>Choose difficulty:</p>
            <div className="difficulty-row">
              {difficultyKeys.map((k) => (
                <button
                  key={k}
                  className={`diff-btn ${difficulty === k ? 'active' : ''}`}
                  onClick={() => setDifficulty(k)}
                >
                  {k.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="game-stage">
              <h2 style={{ marginTop: 0 }}>Ready to play?</h2>
              <p className="muted">Difficulty: {difficulty}</p>
              <button className="btn-primary" onClick={start} style={{ fontSize: 20 }}>
                ▶ Start
              </button>
            </div>
          </>
        )}

        {phase === 'playing' && (
          <div className="game-stage">
            {game.game_type === 'memory' && (
              <MemoryMatch config={game.game_config} difficulty={difficulty} onFinish={finish} />
            )}
            {game.game_type === 'attention' && (
              <FocusFinder config={game.game_config} difficulty={difficulty} onFinish={finish} />
            )}
            {game.game_type === 'speed' && (
              <SpeedDash config={game.game_config} difficulty={difficulty} onFinish={finish} />
            )}
          </div>
        )}

        {phase === 'result' && result && (
          <div className="game-stage result-screen">
            <h2>🎉 Great job!</h2>
            <div className="big-score">{result.score}</div>
            <p className="muted">Time: {result.time_spent_seconds}s · {difficulty}</p>
            {saving && <p className="muted">Saving your score…</p>}
            <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="btn-primary" onClick={() => setPhase('select')}>Play again</button>
              <button className="btn-ghost" onClick={() => nav('/play')}>Back to hub</button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
