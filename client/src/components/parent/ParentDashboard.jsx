import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';

const SKILL_LABELS = { memory: '🧩 Memory', attention: '🔍 Attention', speed: '⚡ Fast thinking' };

// Progress tab of the parent area. Reads the Phase-1 /children/me/summary
// (baseline / current / improvement / recent scores by skill) — the legacy
// per-game shape used in Phase 0 is retired in Task 3.3.
export default function ParentDashboard({ onExit }) {
  const [profile, setProfile] = useState(null);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    (async () => {
      const [p, s] = await Promise.all([
        api('/children/me/profile'),
        api('/children/me/summary')
      ]);
      setProfile(p.child);
      setSummary(s);
    })();
  }, []);

  if (!profile || !summary) return <div className="center-spinner">Loading…</div>;

  const skills = summary.skills || {};
  const totalPlays = Object.values(skills).reduce((a, s) => a + (s.plays || 0), 0);
  const growth = growthLine(profile.child_name, skills, totalPlays);

  return (
    <div className="container">
      <div className="section-title">
        <div>
          <h2 style={{ margin: 0 }}>👨‍👩‍👧 Progress — {profile.child_name}</h2>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            Theme: {profile.theme || '—'} · Age: {profile.age || '—'}
          </p>
        </div>
        {onExit && <button className="btn-ghost" onClick={onExit}>Exit parent area</button>}
      </div>

      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <h4>Total plays</h4>
          <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--primary)' }}>{totalPlays}</div>
        </div>
        <div className="stat-card">
          <h4>Skills trained</h4>
          <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--primary)' }}>
            {Object.keys(skills).length}
          </div>
        </div>
      </div>

      <div className="section-title"><h2>By skill</h2></div>
      {Object.keys(skills).length === 0 && (
        <p className="muted">No plays yet. Progress will appear here after the first game.</p>
      )}
      <div className="stats-grid">
        {Object.entries(skills).map(([skillKey, s]) => (
          <SkillCard key={skillKey} skill={skillKey} data={s} />
        ))}
      </div>

      <div
        className="stat-card"
        style={{ marginTop: 24, background: 'linear-gradient(135deg, #a29bfe22, #fd79a822)' }}
      >
        <h4>🌱 How {profile.child_name} is growing</h4>
        <p style={{ margin: 0 }}>{growth}</p>
      </div>
    </div>
  );
}

function SkillCard({ skill, data }) {
  const label = SKILL_LABELS[skill] || skill;
  if (data.calibrating) {
    return (
      <div className="stat-card">
        <h4>{label}</h4>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--muted)' }}>Calibrating…</div>
        <div className="muted" style={{ fontSize: 13 }}>
          {data.plays} play{data.plays === 1 ? '' : 's'} · need 3 to start scoring progress.
        </div>
      </div>
    );
  }
  const trend = data.improvePct > 0 ? 'up' : data.improvePct < 0 ? 'down' : 'flat';
  return (
    <div className="stat-card">
      <h4>{label}</h4>
      <div className="stat-row"><span className="label">Plays</span><span className="value">{data.plays}</span></div>
      <div className="stat-row"><span className="label">Baseline</span><span className="value">{data.baseline}</span></div>
      <div className="stat-row">
        <span className="label">Current</span>
        <span className="value">
          {data.current} <TrendArrow t={trend} />
          {data.improvePct !== 0 && (
            <span style={{ marginLeft: 6, color: trend === 'up' ? 'var(--success)' : 'var(--danger)' }}>
              ({data.improvePct > 0 ? '+' : ''}{data.improvePct}%)
            </span>
          )}
        </span>
      </div>
      {data.recent && data.recent.length > 1 && (
        <>
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>Recent scores</div>
          <Sparkline scores={data.recent.map((r) => r.score)} />
        </>
      )}
    </div>
  );
}

function TrendArrow({ t }) {
  if (t === 'up') return <span className="trend up">▲</span>;
  if (t === 'down') return <span className="trend down">▼</span>;
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

function growthLine(name, skills, totalPlays) {
  if (totalPlays === 0) return `${name} hasn't played yet.`;
  const active = Object.values(skills).filter((s) => !s.calibrating);
  const ups = active.filter((s) => s.improvePct > 0).length;
  const downs = active.filter((s) => s.improvePct < 0).length;
  if (!active.length) return `${name} is still calibrating — a few more plays and progress kicks in.`;
  if (ups > downs) return `${name} is improving on ${ups} of ${active.length} skill${active.length === 1 ? '' : 's'} — great work! 🚀`;
  if (downs > ups) return `${name}'s scores dipped recently. Try a shorter session or a different theme.`;
  return `${name}'s scores are steady. Ready for a harder difficulty?`;
}
