import { useEffect, useMemo, useRef, useState } from 'react';
import Layout from '../shared/Layout.jsx';
import GameLauncher from '../shell/GameLauncher.jsx';
import { api } from '../../lib/api.js';

const SKILL_ICONS = { memory: '🧩', attention: '🔍', speed: '⚡' };
const SKILL_LABELS = { memory: 'Memory', attention: 'Attention', speed: 'Fast Thinking' };

const GATE_POLL_MS = 45_000;

// The hub renders the assigned games AND enforces parental limits.
// Server /gate is the source of truth (server clock; device clock is never
// trusted). Enforcement logic:
//   • On hub load → GET /gate. If !allowed → LockScreen instead of tiles.
//   • While playing → poll /gate every 45s. If it flips to !allowed →
//     launcher.stop(reason) so the game wraps up gracefully.
//   • Effective in-game cap = min(maxSessionSeconds, secondsRemainingToday).
export default function ChildHub() {
  const [profile, setProfile] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [gate, setGate] = useState(null);
  const [summary, setSummary] = useState({ skills: {}, trend14: [] });
  const [active, setActive] = useState(null);
  const [toast, setToast] = useState(null);
  const [errored, setErrored] = useState(null);

  const refreshGate = async () => {
    try {
      const g = await api('/children/me/gate');
      setGate(g);
      return g;
    } catch (e) {
      // Non-fatal — assume allowed so a temporary API failure doesn't lock the kid out.
      console.warn('gate check failed', e);
      return null;
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [p, a, s] = await Promise.all([
          api('/children/me/profile'),
          api('/children/me/assignments'),
          api('/children/me/summary')
        ]);
        if (!alive) return;
        setProfile(p.child);
        setAssignments(a.assignments || []);
        setSummary(s || { skills: {}, trend14: [] });
        await refreshGate();
      } catch (e) {
        if (!alive) return;
        setErrored(e.message || 'Failed to load hub');
      }
    })();
    return () => { alive = false; };
  }, []);

  // Poll gate on the hub as well so a parent flipping "pause" from another
  // device shows up within one cycle even without a play in progress.
  useEffect(() => {
    const id = setInterval(refreshGate, GATE_POLL_MS);
    return () => clearInterval(id);
  }, []);

  const bestTodayBySkill = useMemo(() => {
    const days = summary && summary.trend14 ? summary.trend14 : [];
    const today = days.length ? days[days.length - 1] : null;
    return today && today.byBest ? today.byBest : {};
  }, [summary]);

  if (errored) return <div className="center-spinner" style={{ color: '#e17055' }}>{errored}</div>;
  if (!profile) return <div className="center-spinner">Loading your hub…</div>;

  const locked = gate && gate.allowed === false;
  const bgGradient = `linear-gradient(135deg, ${themeGradient(profile.theme)})`;

  return (
    <Layout role="child">
      <div className="hub" style={{ background: bgGradient, position: 'relative', minHeight: '100vh' }}>
        <div className="hub-greeting">
          <h1>Hi {profile.child_name}! {profile.avatar || themeEmoji(profile.theme)}</h1>
          {!locked && (
            <p>
              {assignments.length === 0
                ? 'No games yet — ask the grown-up to set you up! 🎈'
                : 'Pick a game to play.'}
            </p>
          )}
        </div>

        {locked ? (
          <LockScreen reason={gate.reason} hint={gate.hint} />
        ) : (
          <>
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

            {gate && gate.secondsRemainingToday != null && (
              <div style={{ textAlign: 'center', color: '#2d3436', fontWeight: 700, marginTop: 18, opacity: 0.6 }}>
                {formatRemaining(gate.secondsRemainingToday)} left today
              </div>
            )}
          </>
        )}

        {active && (
          <PlaySession
            profile={profile}
            assignment={active.assignment}
            gate={gate}
            refreshGate={refreshGate}
            onFinished={({ score, skill, stopReason }) => {
              setActive(null);
              if (stopReason && stopReason !== 'shell' && stopReason !== 'user') {
                // Locked mid-play — reflect the new gate state immediately.
                refreshGate();
              } else if (score != null) {
                setToast({ score, skill });
                setTimeout(() => setToast(null), 2400);
              }
              api('/children/me/summary').then((s) => setSummary(s)).catch(() => {});
              refreshGate();
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

// Reason → kid-friendly copy. Never punitive.
const LOCK_COPY = {
  dailyCap: {
    icon: '🌙',
    title: 'Great playing today!',
    body: 'Come back tomorrow for more.',
    tint: '#5e60ce'
  },
  outsideHours: {
    icon: '⏰',
    title: "It's not game time right now.",
    body: 'See you at the next allowed time!',
    tint: '#0077b6'
  },
  paused: {
    icon: '⏸️',
    title: 'Games are paused.',
    body: 'Ask a grown-up to unpause.',
    tint: '#ff9e00'
  }
};
function LockScreen({ reason, hint }) {
  const copy = LOCK_COPY[reason] || { icon: '🚧', title: 'Not right now', body: 'Try again later.', tint: '#636e72' };
  return (
    <div style={{ padding: 32, maxWidth: 520, margin: '30px auto', textAlign: 'center' }}>
      <div style={{
        background: 'white', borderRadius: 24, padding: 36,
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
        border: `4px solid ${copy.tint}`
      }}>
        <div style={{ fontSize: 80 }}>{copy.icon}</div>
        <h2 style={{ margin: '14px 0 8px', color: copy.tint }}>{copy.title}</h2>
        <p style={{ margin: 0, color: '#636e72', fontSize: 17 }}>{copy.body}</p>
        {hint && (
          <p style={{ marginTop: 12, color: '#636e72', fontSize: 14 }}>
            Next window: {hint}
          </p>
        )}
      </div>
    </div>
  );
}

function PlaySession({ profile, assignment, gate, refreshGate, onFinished, onExit }) {
  const launcherRef = useRef(null);
  const stopReasonRef = useRef('user');
  const pollRef = useRef(null);

  // Effective session cap: the SHORTER of maxSession and today's remaining.
  const effectiveSessionSec = useMemo(() => {
    const maxSess = gate && gate.maxSessionSeconds ? Number(gate.maxSessionSeconds) : 0;
    const remain = gate && gate.secondsRemainingToday != null ? Number(gate.secondsRemainingToday) : Infinity;
    const candidates = [maxSess, remain].filter((n) => Number.isFinite(n) && n > 0);
    return candidates.length ? Math.max(1, Math.min(...candidates)) : 0;
  }, [gate]);

  // Local session timer (mirrors what server-poll would catch, faster).
  useEffect(() => {
    if (effectiveSessionSec <= 0) return;
    const id = setTimeout(() => {
      stopReasonRef.current = 'sessionLimit';
      if (launcherRef.current) launcherRef.current.stop('sessionLimit');
    }, effectiveSessionSec * 1000);
    return () => clearTimeout(id);
  }, [effectiveSessionSec]);

  // Server-authoritative poll: if pause/hours/cap flips mid-play, stop.
  useEffect(() => {
    pollRef.current = setInterval(async () => {
      const g = await refreshGate();
      if (g && g.allowed === false) {
        stopReasonRef.current = g.reason || 'gate';
        if (launcherRef.current) launcherRef.current.stop(g.reason || 'gate');
      }
    }, GATE_POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [refreshGate]);

  const handleSessionComplete = async (payload) => {
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
    onFinished({
      score: payload.score,
      skill: payload.skill,
      stopReason: stopReasonRef.current
    });
  };

  const handleExit = () => {
    stopReasonRef.current = 'user';
    onExit();
  };

  return (
    <div role="dialog" aria-modal="true" style={{
      position: 'fixed', inset: 0, background: '#0f0f14',
      display: 'flex', flexDirection: 'column', zIndex: 20
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', color: 'white', background: 'rgba(255,255,255,0.06)'
      }}>
        <div style={{ fontWeight: 800 }}>{assignment.game.name}</div>
        {effectiveSessionSec > 0 && (
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
            Session cap: {Math.round(effectiveSessionSec / 60)}m
          </div>
        )}
        <button onClick={handleExit} style={{
          background: 'transparent', color: 'white', border: '2px solid rgba(255,255,255,0.4)',
          padding: '6px 12px', borderRadius: 8, fontWeight: 700, cursor: 'pointer'
        }}>✕ Close</button>
      </div>
      <div style={{ flex: 1, background: '#fff' }}>
        <GameLauncher
          ref={launcherRef}
          gameKey={assignment.game.key}
          child={{
            id: profile.id, name: profile.child_name,
            avatar: profile.avatar || '🎈', age: profile.age
          }}
          config={assignment.config || {}}
          limits={{ maxSessionSeconds: effectiveSessionSec }}
          locale="en"
          onSessionComplete={handleSessionComplete}
          onExit={handleExit}
          allowSameOrigin={import.meta.env.DEV}
        />
      </div>
    </div>
  );
}

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
function formatRemaining(sec) {
  if (sec == null) return '';
  if (sec >= 3600) return `${Math.floor(sec / 3600)}h ${Math.round((sec % 3600) / 60)}m`;
  return `${Math.round(sec / 60)} min`;
}
