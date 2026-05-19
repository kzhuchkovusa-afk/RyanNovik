import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../shared/Layout.jsx';
import { api } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';

const ICONS = { memory: '🧩', attention: '🔍', speed: '⚡' };

export default function ChildHub() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [games, setGames] = useState([]);
  const [summary, setSummary] = useState({ games: [] });

  useEffect(() => {
    let alive = true;
    (async () => {
      const [p, g, s] = await Promise.all([
        api('/children/me/profile'),
        api('/games/mine'),
        api('/scores/mine/summary')
      ]);
      if (!alive) return;
      setProfile(p.child);
      setGames(g.games);
      setSummary(s);
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!profile) return <div className="center-spinner">Loading your hub…</div>;

  const bestForGame = (gameId) => {
    const row = summary.games.find((s) => s.game_id === gameId);
    return row ? row.best : 0;
  };

  const bgGradient = profile.favorite_colors
    ? `linear-gradient(135deg, ${themeGradient(profile.theme)})`
    : 'linear-gradient(135deg, #ffeaa7, #fab1a0)';

  return (
    <Layout role="child">
      <div className="hub" style={{ background: bgGradient }}>
        <div className="hub-greeting">
          <h1>
            Hi {profile.child_name}! {themeEmoji(profile.theme)}
          </h1>
          <p>Pick a game to play.</p>
        </div>
        <div className="game-grid">
          {games.map((g) => (
            <Link
              key={g.id}
              to={`/play/game/${g.id}`}
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              <div className="game-card">
                <div className="icon">{ICONS[g.game_type] || '🎮'}</div>
                <h3>{g.game_name}</h3>
                <div className="best">🏆 Best: {bestForGame(g.id)}</div>
              </div>
            </Link>
          ))}
          {games.length === 0 && (
            <p className="muted" style={{ gridColumn: '1/-1', textAlign: 'center' }}>
              No games yet — ask the grown-up to set you up! 🎈
            </p>
          )}
        </div>
      </div>
    </Layout>
  );
}

function themeEmoji(theme) {
  const t = (theme || '').toLowerCase();
  if (t.includes('dino')) return '🦖';
  if (t.includes('princess')) return '👑';
  if (t.includes('space')) return '🚀';
  if (t.includes('ocean') || t.includes('sea')) return '🐠';
  if (t.includes('cat')) return '🐱';
  if (t.includes('dog')) return '🐶';
  if (t.includes('car')) return '🚗';
  if (t.includes('unicorn')) return '🦄';
  return '✨';
}

function themeGradient(theme) {
  const t = (theme || '').toLowerCase();
  if (t.includes('dino')) return '#a8e6cf, #ffd3b6';
  if (t.includes('princess')) return '#fab1a0, #ffeaa7';
  if (t.includes('space')) return '#a29bfe, #74b9ff';
  if (t.includes('ocean')) return '#81ecec, #74b9ff';
  if (t.includes('unicorn')) return '#fd79a8, #a29bfe';
  return '#ffeaa7, #fab1a0';
}
