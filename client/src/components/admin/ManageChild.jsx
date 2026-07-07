import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Layout from '../shared/Layout.jsx';
import { api } from '../../lib/api.js';
import { LinkReveal } from './CreateChild.jsx';

// Single-page admin view for one child: profile · access link + regen ·
// assignments (from games_library) · limits · quick activity.
export default function ManageChild() {
  const { id } = useParams();
  const nav = useNavigate();
  const [child, setChild] = useState(null);
  const [library, setLibrary] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [limits, setLimits] = useState(null);
  const [summary, setSummary] = useState({ skills: {} });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  const load = async () => {
    try {
      const [c, lib, a, l, s] = await Promise.all([
        api(`/children/${id}`),
        api('/games-library'),
        api(`/children/${id}/assignments`),
        api(`/children/${id}/limits`),
        api(`/children/${id}/summary`)
      ]);
      setChild(c.child);
      setLibrary(lib.games || []);
      setAssignments(a.assignments || []);
      setLimits(l.limits);
      setSummary(s);
    } catch (e) {
      setErr(e.message);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  if (err) return <div className="center-spinner" style={{ color: '#e17055' }}>{err}</div>;
  if (!child) return <div className="center-spinner">Loading…</div>;

  const toast = (m) => { setMsg(m); setTimeout(() => setMsg(''), 1600); };

  const regenerate = async () => {
    if (!confirm('Regenerating invalidates the old link. Continue?')) return;
    const { access_token } = await api(`/children/${id}/regenerate-access-token`, { method: 'POST' });
    setChild({ ...child, access_token });
    toast('New link generated ✓');
  };

  const removeChild = async () => {
    if (!confirm(`Delete ${child.child_name}? Wipes their games and scores.`)) return;
    await api(`/children/${id}`, { method: 'DELETE' });
    nav('/admin');
  };

  const magicLink = `${window.location.origin}/enter?token=${child.access_token}`;

  return (
    <Layout role="admin">
      <div className="container">
        <div className="section-title">
          <div>
            <Link to="/admin" style={{ color: 'var(--muted)', textDecoration: 'none' }}>
              ← Console
            </Link>
            <h2 style={{ margin: '6px 0 0' }}>{child.avatar || '🎈'} {child.child_name}</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              Login: <strong>{child.username}</strong>
            </p>
          </div>
          <button className="btn-danger" onClick={removeChild}>Delete child</button>
        </div>
        {msg && <div style={{ color: 'var(--success)', marginBottom: 12 }}>{msg}</div>}

        <div className="stat-card" style={{ marginBottom: 20 }}>
          <h3 style={{ marginTop: 0 }}>🔗 Magic link</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            Send this to the parent — one tap and the child is in on any device.
          </p>
          <LinkReveal link={magicLink} />
          <div style={{ marginTop: 12 }}>
            <button className="btn-ghost" onClick={regenerate}>Regenerate link</button>
          </div>
        </div>

        <ProfileEditor child={child} onSaved={(patch) => { setChild({ ...child, ...patch }); toast('Profile saved ✓'); }} />

        <AssignmentsEditor
          childId={id}
          child={child}
          library={library}
          assignments={assignments}
          onChanged={load}
          onMsg={toast}
        />

        <LimitsEditor childId={id} limits={limits} onSaved={(l) => { setLimits(l); toast('Limits saved ✓'); }} />

        <div className="stat-card">
          <h3 style={{ marginTop: 0 }}>Activity</h3>
          {Object.keys(summary.skills || {}).length === 0 && <p className="muted">No plays yet.</p>}
          {Object.entries(summary.skills || {}).map(([skill, s]) => (
            <div key={skill} style={{ borderBottom: '1px solid var(--border)', padding: '10px 0' }}>
              <strong>{skill}</strong>{' '}
              {s.calibrating
                ? <span className="tag">Calibrating · {s.plays} play{s.plays === 1 ? '' : 's'}</span>
                : (
                  <span>
                    baseline {s.baseline} · current {s.current}
                    {s.improvePct !== 0 && (
                      <span style={{ color: s.improvePct > 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {' '}({s.improvePct > 0 ? '+' : ''}{s.improvePct}%)
                      </span>
                    )}
                  </span>
                )}
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}

// ---------- Profile ----------
function ProfileEditor({ child, onSaved }) {
  const [form, setForm] = useState({
    child_name: child.child_name || '', age: child.age || '',
    theme: child.theme || '', interests: child.interests || '',
    favorite_colors: child.favorite_colors || '', parent_email: child.parent_email || '',
    avatar: child.avatar || '🎈', password: ''
  });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault();
    const body = { ...form, age: form.age ? Number(form.age) : null };
    if (!body.password) delete body.password;
    await api(`/children/${child.id}`, { method: 'PUT', body });
    onSaved(body);
  };
  return (
    <form onSubmit={save} className="stat-card" style={{ marginBottom: 20 }}>
      <h3 style={{ marginTop: 0 }}>Profile</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="field"><label>Name</label><input value={form.child_name} onChange={set('child_name')} /></div>
        <div className="field"><label>Age</label><input type="number" value={form.age} onChange={set('age')} /></div>
        <div className="field"><label>Avatar</label><input value={form.avatar} onChange={set('avatar')} maxLength={4} /></div>
        <div className="field"><label>Theme</label><input value={form.theme} onChange={set('theme')} /></div>
        <div className="field"><label>Interests</label><input value={form.interests} onChange={set('interests')} /></div>
        <div className="field"><label>Favorite colors</label><input value={form.favorite_colors} onChange={set('favorite_colors')} /></div>
        <div className="field"><label>Parent email</label><input type="email" value={form.parent_email} onChange={set('parent_email')} /></div>
        <div className="field"><label>Reset password (blank = keep)</label><input value={form.password} onChange={set('password')} /></div>
      </div>
      <button className="btn-primary" type="submit">Save profile</button>
    </form>
  );
}

// ---------- Assignments ----------
function AssignmentsEditor({ childId, child, library, assignments, onChanged, onMsg }) {
  const [editing, setEditing] = useState(null); // {mode:'new'|'edit', ...draft}

  const startNew = (gameKey) => {
    const game = library.find((g) => g.key === gameKey);
    if (!game) return;
    setEditing({
      mode: 'new',
      game_key: game.key,
      game_id: game.id,
      game_name: game.name,
      unlocked: true,
      config_text: JSON.stringify(defaultConfigFor(game, child), null, 2)
    });
  };
  const startEdit = (a) => {
    setEditing({
      mode: 'edit',
      assignment_id: a.assignment_id,
      game_key: a.game.key,
      game_name: a.game.name,
      unlocked: a.unlocked,
      config_text: JSON.stringify(a.config, null, 2)
    });
  };

  const save = async () => {
    let parsed;
    try { parsed = JSON.parse(editing.config_text); }
    catch (e) { onMsg('Bad JSON: ' + e.message); return; }
    if (editing.mode === 'new') {
      await api('/assignments', {
        method: 'POST',
        body: {
          child_id: Number(childId),
          game_key: editing.game_key,
          config: parsed,
          unlocked: editing.unlocked,
          sort_order: assignments.length + 1
        }
      });
    } else {
      await api(`/assignments/${editing.assignment_id}`, {
        method: 'PUT',
        body: { config: parsed, unlocked: editing.unlocked }
      });
    }
    setEditing(null);
    onChanged();
    onMsg('Assignment saved ✓');
  };

  const remove = async (a) => {
    if (!confirm(`Remove "${a.game.name}" from ${child.child_name}?`)) return;
    await api(`/assignments/${a.assignment_id}`, { method: 'DELETE' });
    onChanged();
  };

  const assignableGames = library.filter((g) => !assignments.some((a) => a.game.key === g.key));

  return (
    <div className="stat-card" style={{ marginBottom: 20 }}>
      <div className="section-title" style={{ margin: 0 }}>
        <h3 style={{ margin: 0 }}>🎮 Assigned games</h3>
        {assignableGames.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {assignableGames.map((g) => (
              <button key={g.key} className="btn-secondary" onClick={() => startNew(g.key)}>
                + {g.name}
              </button>
            ))}
          </div>
        )}
      </div>
      {assignments.length === 0 ? (
        <p className="muted">No games assigned. Add one above.</p>
      ) : (
        <table className="client-table" style={{ marginTop: 12 }}>
          <thead>
            <tr><th>Name</th><th>Skill</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {assignments.map((a) => (
              <tr key={a.assignment_id}>
                <td><strong>{a.game.name}</strong></td>
                <td>{a.game.game_type}</td>
                <td>
                  <span className={`tag ${a.unlocked ? 'active' : 'inactive'}`}>
                    {a.unlocked ? 'Unlocked' : 'Locked'}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn-ghost" style={{ marginRight: 6 }} onClick={() => startEdit(a)}>Edit</button>
                  <button className="btn-danger" onClick={() => remove(a)}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editing && (
        <div style={{ marginTop: 18, border: '2px solid var(--primary)', borderRadius: 12, padding: 16 }}>
          <h4 style={{ marginTop: 0 }}>
            {editing.mode === 'new' ? 'New' : 'Edit'}: {editing.game_name}
          </h4>
          <div className="field">
            <label>
              <input
                type="checkbox" checked={!!editing.unlocked}
                onChange={(e) => setEditing({ ...editing, unlocked: e.target.checked })}
                style={{ width: 'auto', marginRight: 8 }}
              />
              Unlocked (visible on the child's hub)
            </label>
          </div>
          <div className="field">
            <label>Config (JSON)</label>
            <textarea
              className="game-config-editor"
              value={editing.config_text}
              onChange={(e) => setEditing({ ...editing, config_text: e.target.value })}
              rows={16}
            />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-primary" onClick={save}>Save</button>
            <button className="btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Limits ----------
function LimitsEditor({ childId, limits, onSaved }) {
  const [f, setF] = useState({
    daily_seconds_cap: limits.daily_seconds_cap ?? 1800,
    max_session_seconds: limits.max_session_seconds ?? 900,
    paused: !!limits.paused
  });
  useEffect(() => {
    setF({
      daily_seconds_cap: limits.daily_seconds_cap ?? 1800,
      max_session_seconds: limits.max_session_seconds ?? 900,
      paused: !!limits.paused
    });
  }, [limits]);
  const save = async () => {
    const res = await api(`/children/${childId}/limits`, {
      method: 'PUT',
      body: {
        daily_seconds_cap: f.daily_seconds_cap,
        max_session_seconds: f.max_session_seconds,
        paused: f.paused,
        allowed_hours: limits.allowed_hours || null,
        allowed_days: limits.allowed_days || null
      }
    });
    onSaved(res.limits);
  };
  return (
    <div className="stat-card" style={{ marginBottom: 20 }}>
      <h3 style={{ marginTop: 0 }}>Limits</h3>
      <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
        Parents can adjust hours/days themselves; owner sets defaults here.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="field">
          <label>Daily cap (seconds)</label>
          <input type="number" min="0" step="60" value={f.daily_seconds_cap ?? ''}
            onChange={(e) => setF({ ...f, daily_seconds_cap: e.target.value ? Number(e.target.value) : null })} />
        </div>
        <div className="field">
          <label>Max session (seconds)</label>
          <input type="number" min="0" step="60" value={f.max_session_seconds ?? ''}
            onChange={(e) => setF({ ...f, max_session_seconds: e.target.value ? Number(e.target.value) : null })} />
        </div>
        <div className="field">
          <label>
            <input type="checkbox" checked={f.paused}
              onChange={(e) => setF({ ...f, paused: e.target.checked })}
              style={{ width: 'auto', marginRight: 8 }} />
            Paused
          </label>
        </div>
      </div>
      <button className="btn-primary" onClick={save}>Save limits</button>
    </div>
  );
}

// ---------- helpers ----------
function defaultConfigFor(game, child) {
  const theme = (child.theme || 'general').toLowerCase();
  const themePack = pickThemePack(theme);
  if (game.game_type === 'memory') {
    return {
      child_name: child.child_name, theme,
      cards: themePack.items.map((emoji) => ({ name: emoji, emoji })),
      colors: themePack.colors,
      difficulty_levels: { easy: { pairs: 4, time_limit: null }, medium: { pairs: 6, time_limit: 60 }, hard: { pairs: 8, time_limit: 45 } }
    };
  }
  if (game.game_type === 'attention') {
    return {
      child_name: child.child_name, theme,
      items: themePack.items.map((emoji) => ({ emoji, label: emoji })),
      colors: themePack.colors,
      difficulty_levels: { easy: { grid: 4, rounds: 5, time_per_round: 8 }, medium: { grid: 6, rounds: 7, time_per_round: 6 }, hard: { grid: 9, rounds: 10, time_per_round: 4 } }
    };
  }
  return {
    child_name: child.child_name, theme,
    questions: themePack.items.slice(0, 4).map((emoji, i) => ({
      prompt: `Tap the ${emoji}!`,
      options: [emoji, themePack.items[(i + 1) % themePack.items.length], themePack.items[(i + 2) % themePack.items.length]],
      correct: 0
    })),
    colors: themePack.colors,
    difficulty_levels: { easy: { rounds: 6, time_per_question: 5 }, medium: { rounds: 10, time_per_question: 3 }, hard: { rounds: 14, time_per_question: 2 } }
  };
}
function pickThemePack(theme) {
  const packs = {
    dinosaur: { items: ['🦖', '🦕', '🌋', '🦴', '🥚', '🐾', '🌿', '☄️'], colors: { primary: '#2D8B4E', secondary: '#F4A623', background: '#FFF8E7' } },
    princess: { items: ['👑', '🏰', '🦄', '🌹', '💎', '👗', '🪄', '🐎'], colors: { primary: '#fd79a8', secondary: '#ffeaa7', background: '#fff5fa' } },
    space:    { items: ['🚀', '🌎', '🌕', '⭐', '🛸', '👽', '☄️', '🪐'], colors: { primary: '#341f97', secondary: '#feca57', background: '#e6e5ff' } },
    ocean:    { items: ['🐠', '🐙', '🦀', '🐳', '🦈', '🐚', '⛵', '🏝️'], colors: { primary: '#0984e3', secondary: '#81ecec', background: '#eaf6ff' } },
    default:  { items: ['🍎', '🌟', '🎈', '🎯', '🦋', '🌈', '🍦', '🎁'], colors: { primary: '#6c5ce7', secondary: '#fdcb6e', background: '#fffaf0' } }
  };
  for (const k of Object.keys(packs)) if (theme.includes(k)) return packs[k];
  return packs.default;
}
