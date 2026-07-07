import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Layout from '../shared/Layout.jsx';
import GameLauncher from '../shell/GameLauncher.jsx';
import { api } from '../../lib/api.js';

// Post-Task-1.2 GamePlayer: the game is loaded through the SDK/iframe
// contract, not by direct React import. A one-off difficulty picker still
// lives here so the child can choose easy/medium/hard; the picked value is
// injected into the config passed to the game via init.
//
// This component is a stopgap until Task 1.4 rewires the hub to launch
// games directly from assignments — but the shell↔game path is already
// the Contract, so Task 1.4 will just replace THIS component's data
// source (assignment row) without changing the loader.

const GAME_KEY_BY_TYPE = {
  memory: 'memory_match',
  attention: 'focus_finder',
  speed: 'speed_dash'
};

export default function GamePlayer() {
  const { id } = useParams();
  const nav = useNavigate();
  const [profile, setProfile] = useState(null);
  const [game, setGame] = useState(null);
  const [difficulty, setDifficulty] = useState('easy');
  const [phase, setPhase] = useState('select'); // 'select' | 'playing' | 'result'
  const [result, setResult] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [p, g] = await Promise.all([
        api('/children/me/profile'),
        api(`/games/${id}`)
      ]);
      setProfile(p.child);
      setGame(g.game);
    })();
  }, [id]);

  if (!game || !profile) return <div className="center-spinner">Loading game…</div>;

  const gameKey = GAME_KEY_BY_TYPE[game.game_type];
  const levels = game.game_config.difficulty_levels || {};
  const difficultyKeys = Object.keys(levels).length ? Object.keys(levels) : ['easy', 'medium', 'hard'];

  const start = () => {
    setResult(null);
    setPhase('playing');
  };

  const onSessionComplete = async (payload) => {
    setResult(payload);
    setPhase('result');
    setSaving(true);
    try {
      await api('/scores', {
        method: 'POST',
        body: {
          gameKey,
          score: payload.score,
          level: payload.level,
          time_spent_seconds: payload.durationSec,
          difficulty_level: difficulty,
          raw: payload.raw
        }
      });
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const enrichedConfig = { ...game.game_config, difficulty };

  return (
    <Layout role="child">
      <div className="player-shell">
        <div className="player-header">
          <button className="btn-ghost" onClick={() => nav('/play')}>← Back to hub</button>
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
              <button className="btn-primary" onClick={start} style={{ fontSize: 20 }}>▶ Start</button>
            </div>
          </>
        )}

        {phase === 'playing' && (
          <div style={{ background: 'white', borderRadius: 20, boxShadow: '0 8px 24px rgba(0,0,0,0.06)', height: '75vh', overflow: 'hidden' }}>
            <GameLauncher
              gameKey={gameKey}
              child={{ id: profile.id, name: profile.child_name, avatar: profile.avatar || '🎈', age: profile.age }}
              config={enrichedConfig}
              limits={{ maxSessionSeconds: 900 }}
              locale="en"
              onSessionComplete={onSessionComplete}
              onExit={() => nav('/play')}
              /* Dev-mode allowSameOrigin lets Vite's iframe HMR work without breaking
                 the Contract — the shell still validates origins strictly. */
              allowSameOrigin={import.meta.env.DEV}
            />
          </div>
        )}

        {phase === 'result' && result && (
          <div className="game-stage result-screen">
            <h2>🎉 Great job!</h2>
            <div className="big-score">{result.score}</div>
            <p className="muted">Time: {result.durationSec}s · {difficulty}</p>
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
