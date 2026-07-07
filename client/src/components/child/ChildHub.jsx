import { useEffect, useMemo, useRef, useState } from 'react';
import Layout from '../shared/Layout.jsx';
import GameLauncher from '../shell/GameLauncher.jsx';
import { api } from '../../lib/api.js';

const SKILL_ICONS = { memory: '🧩', attention: '🔍', speed: '⚡' };
const SKILL_LABELS = { memory: 'Memory', attention: 'Attention', speed: 'Fast Thinking' };

// The hub: fetches whatever games are ASSIGNED to this child and renders one
// tile per assignment, respecting sort_order + unlocked. Tapping a tile mounts
// the game inline through GameLauncher (sandboxed iframe, SDK contract).
//
// Task 1.4 side-effects the hub can trigger without touching game code:
//   • Add/remove a row in assignments → hub reflects it on next load.
//   • Toggle unlocked=false → tile shows a lock and is non-tappable.
//   • Set limits.max_session_seconds → the timer here calls handle.stop() at cap.
export default function ChildHub() {
  const [profile, setProfile] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [limits, setLimits] = useState({});
  const [summary, setSummary] = useState({ skills: {}, trend14: [] });
  const [active, setActive] = useState(null);        // { assignment, sessionId }
  const [toast, setToast] = useState(null);          // { score, skill }
  const [errored, setErrored] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [p, a, l, s] = await Promise.all([
          api('/children/me/profile'),
          api('/children/me/assignments'),
          api('/children/me/limits'),
          api('/children/me/summary')
        ]);
        if (!alive) return;
        setProfile(p.child);
        setAssignments(a.assignments || []);
        setLimits(l.limits || {});
        setSummary(s || { skills: {}, trend14: [] });
      } catch (e) {
        if (!alive) return;
        setErrored(e.message || 'Failed to load hub');
      }
    })();
    return () => { alive = false; };
  }, []);

  // "Best today" per skill: look at trend14's LAST bucket (today) → byBest[skill].
  const bestTodayBySkill = useMemo(() => {
    const days = summary && summary.trend14 ? summary.trend14 : [];
    const today = days.length ? days[days.length - 1] : null;
    return today && today.byBest ? today.byBest : {};
  }, [summary]);

  if (errored) return <div className="center-spinner" style={{ color: '#e17055' }}>{errored}</div>;
  if (!profile) return <div className="center-spinner">Loading your hub…</div>;

  const bgGradient = `linear-gradient(135deg, ${themeGradient(profile.theme)})`;

  return (
    <Layout role="child">
      <div className="hub" style={{ background: bgGradient, position: 'relative', minHeight: '100vh' }}>
        <div className="hub-greeting">
          <h1>Hi {profile.child_name}! {profile.avatar || themeEmoji(profile.theme)}</h1>
          <p>
            {assignments.length === 0
              ? 'No games yet — ask the grown-up to set you up! 🎈'
              : 'Pick a game to play.'}
          </p>
        </div>

        <div className="game-grid">
          {assignments.map((a) => (
            <AssignmentTile
              key={a.assignment_id}
              assignment={a}
              bestToday={bestTodayBySkill[a.game.game_type]}
              onLaunch={() => setActive({ assignment: a })}
            />
          ))}
        </div>

        {active && (
          <PlaySession
            profile={profile}
            assignment={active.assignment}
            limits={limits}
            onFinished={({ score, skill }) => {
              setToast({ score, skill });
              setActive(null);
              // Refresh summary so the "Best today" pills update.
              api('/children/me/summary').then((s) => setSummary(s)).catch(() => {});
              setTimeout(() => setToast(null), 2400);
            }}
            onExit={() => setActive(null)}
          />
        )}

        {toast && (
          <div style={{
            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
            background: '#2d3436', color: 'white', padding: '14px 22px', borderRadius: 14,
            boxShadow: '0 12px 30px rgba(0,0,0,0.25)', zIndex: 30, fontWeight: 700, fontSize: 18
          }}>
            +{toast.score} · nice! ⭐
          </div>
        )}
      </div>
    </Layout>
  );
}

function AssignmentTile({ assignment, bestToday, onLaunch }) {
  const { game, config, unlocked } = assignment;
  const accent = pickAccent(config);
  const disabled = !unlocked;
  return (
    <button
      onClick={disabled ? undefined : onLaunch}
      disabled={disabled}
      aria-disabled={disabled}
      className="game-card"
      style={{
        border: `3px solid ${disabled ? 'rgba(0,0,0,0.05)' : accent}`,
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        textAlign: 'center',
        minHeight: 200
      }}
    >
      <div className="icon" style={{ fontSize: 64, position: 'relative' }}>
        {SKILL_ICONS[game.game_type] || '🎮'}
        {disabled && (
          <span style={{
            position: 'absolute', top: -6, right: -6, background: '#e17055',
            color: 'white', padding: '4px 8px', borderRadius: 999, fontSize: 20
          }}>🔒</span>
        )}
      </div>
      <h3 style={{ margin: '10px 0 4px' }}>{game.name}</h3>
      <div style={{ color: '#636e72', fontSize: 13 }}>
        {SKILL_LABELS[game.game_type] || game.game_type}
      </div>
      <div style={{ marginTop: 10, fontSize: 14, color: accent, fontWeight: 700 }}>
        {bestToday != null ? `🏆 Best today: ${bestToday}` : disabled ? 'Locked' : 'Ready'}
      </div>
    </button>
  );
}

function PlaySession({ profile, assignment, limits, onFinished, onExit }) {
  const launcherRef = useRef(null);
  const timerRef = useRef(null);
  const capReached = useRef(false);

  useEffect(() => {
    // Wire the session-limit hook per Task 1.4 (UI is Phase 2 — this is the
    // enforcement path that already needs to exist).
    const cap = Number(limits && limits.max_session_seconds);
    if (!Number.isFinite(cap) || cap <= 0) return;
    timerRef.current = setTimeout(() => {
      capReached.current = true;
      if (launcherRef.current) launcherRef.current.stop('sessionLimit');
    }, cap * 1000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [limits]);

  const handleSessionComplete = async (payload) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    try {
      await api('/scores', {
        method: 'POST',
        body: {
          gameKey: assignment.game.key,
          score: payload.score,
          level: payload.level,
          time_spent_seconds: payload.durationSec,
          difficulty_level: (assignment.config && assignment.config.difficulty) || 'normal',
          raw: payload.raw
        }
      });
    } catch (e) {
      console.error('Failed to save score', e);
    }
    onFinished({ score: payload.score, skill: payload.skill });
  };

  const handleExit = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    onExit();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, background: '#0f0f14',
        display: 'flex', flexDirection: 'column', zIndex: 20
      }}
    >
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', color: 'white', background: 'rgba(255,255,255,0.06)'
      }}>
        <div style={{ fontWeight: 800 }}>{assignment.game.name}</div>
        <button
          onClick={handleExit}
          style={{ background: 'transparent', color: 'white', border: '2px solid rgba(255,255,255,0.4)', padding: '6px 12px', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}
        >
          ✕ Close
        </button>
      </div>
      <div style={{ flex: 1, background: '#fff' }}>
        <GameLauncher
          ref={launcherRef}
          gameKey={assignment.game.key}
          child={{
            id: profile.id,
            name: profile.child_name,
            avatar: profile.avatar || '🎈',
            age: profile.age
          }}
          config={assignment.config || {}}
          limits={{ maxSessionSeconds: (limits && limits.max_session_seconds) || 0 }}
          locale="en"
          onSessionComplete={handleSessionComplete}
          onExit={handleExit}
          // Dev-only: let Vite HMR reach into the iframe without breaking the
          // Contract (origin check still enforced in the SDK).
          allowSameOrigin={import.meta.env.DEV}
        />
      </div>
    </div>
  );
}

// Prefer an explicit accent set by the owner; fall back to the theme's
// primary color; fall back to a safe default.
function pickAccent(config) {
  if (!config) return '#6c5ce7';
  if (typeof config.accent === 'string' && config.accent) return config.accent;
  if (config.colors && typeof config.colors.primary === 'string' && config.colors.primary) return config.colors.primary;
  return '#6c5ce7';
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
