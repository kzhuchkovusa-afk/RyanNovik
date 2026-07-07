import { useEffect, useState } from 'react';
import Layout from '../shared/Layout.jsx';
import { api } from '../../lib/api.js';

const TYPE_LABELS = { memory: 'Memory', attention: 'Attention', speed: 'Speed' };
const TYPE_ICONS = { memory: '🧩', attention: '🔍', speed: '⚡' };

export default function ParentDashboard({ onExit }) {
  const [profile, setProfile] = useState(null);
  const [summary, setSummary] = useState({ games: [] });

  useEffect(() => {
    (async () => {
      const [p, s] = await Promise.all([
        api('/children/me/profile'),
        api('/scores/mine/summary')
      ]);
      setProfile(p.child);
      setSummary(s);
    })();
  }, []);

  if (!profile) return <div className="center-spinner">Loading…</div>;

  const totalPlays = summary.games.reduce((a, b) => a + b.plays, 0);
  const totalTime = summary.games.reduce((a, b) => a + b.total_time, 0);

  return (
    <Layout role="child">
      <div className="container">
        <div className="section-title">
          <div>
            <h2 style={{ margin: 0 }}>👨‍👩‍👧 Parent View — {profile.child_name}</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              Theme: {profile.theme || '—'} · Age: {profile.age || '—'}
            </p>
          </div>
          {onExit && (
            <button className="btn-ghost" onClick={onExit}>Exit parent area</button>
          )}
        </div>

        <div className="stats-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card">
            <h4>Total plays</h4>
            <div className="big-score" style={{ fontSize: 36, color: 'var(--primary)' }}>
              {totalPlays}
            </div>
          </div>
          <div className="stat-card">
            <h4>Time spent learning</h4>
            <div className="big-score" style={{ fontSize: 36, color: 'var(--primary)' }}>
              {formatTime(totalTime)}
            </div>
          </div>
          <div className="stat-card">
            <h4>Active games</h4>
            <div className="big-score" style={{ fontSize: 36, color: 'var(--primary)' }}>
              {summary.games.length}
            </div>
          </div>
        </div>

        <div className="section-title">
          <h2>Per game</h2>
        </div>
        <div className="stats-grid">
          {summary.games.map((g) => (
            <div key={g.game_id} className="stat-card">
              <h4>
                {TYPE_ICONS[g.game_type]} {g.game_name}{' '}
                <span className="tag">{TYPE_LABELS[g.game_type]}</span>
              </h4>
              <div className="stat-row">
                <span className="label">Times played</span>
                <span className="value">{g.plays}</span>
              </div>
              <div className="stat-row">
                <span className="label">Best score</span>
                <span className="value">🏆 {g.best}</span>
              </div>
              <div className="stat-row">
                <span className="label">Average</span>
                <span className="value">
                  {g.avg} <TrendArrow trend={g.trend} />
                </span>
              </div>
              <div className="stat-row">
                <span className="label">Total time</span>
                <span className="value">{formatTime(g.total_time)}</span>
              </div>
              <div className="stat-row">
                <span className="label">Last played</span>
                <span className="value">{relativeTime(g.last_played)}</span>
              </div>
              {g.recent.length > 1 && (
                <>
                  <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>
                    Recent scores
                  </div>
                  <Sparkline scores={g.recent.map((r) => r.score)} />
                </>
              )}
            </div>
          ))}
        </div>

        <div
          className="stat-card"
          style={{ marginTop: 24, background: 'linear-gradient(135deg, #a29bfe22, #fd79a822)' }}
        >
          <h4>🌱 How {profile.child_name} is growing</h4>
          <p style={{ margin: 0 }}>{growthSummary(profile.child_name, summary.games, totalPlays)}</p>
        </div>
      </div>
    </Layout>
  );
}

function TrendArrow({ trend }) {
  if (trend === 'up') return <span className="trend up">▲</span>;
  if (trend === 'down') return <span className="trend down">▼</span>;
  return <span className="trend flat">━</span>;
}

function Sparkline({ scores }) {
  const max = Math.max(...scores, 1);
  return (
    <div className="spark">
      {scores.map((s, i) => (
        <div key={i} className="bar" style={{ height: `${(s / max) * 100}%` }} />
      ))}
    </div>
  );
}

function formatTime(sec) {
  if (!sec) return '0m';
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function relativeTime(iso) {
  if (!iso) return 'never';
  const t = new Date(iso + 'Z').getTime();
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function growthSummary(name, games, total) {
  if (total === 0) return `${name} hasn't played yet. Encourage them to give the first game a try!`;
  const ups = games.filter((g) => g.trend === 'up').length;
  const downs = games.filter((g) => g.trend === 'down').length;
  if (ups > downs) return `${name} is improving across ${ups} of ${games.length} games — keep it up! 🚀`;
  if (downs > ups) return `${name}'s scores have dipped recently. A short break or a difficulty adjustment might help.`;
  return `${name}'s scores are steady. Consider trying a harder difficulty to push further.`;
}
