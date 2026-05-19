import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Layout from '../shared/Layout.jsx';
import { api } from '../../lib/api.js';

export default function ManageChild() {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [summary, setSummary] = useState({ games: [] });
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState('');

  const load = async () => {
    const [d, s] = await Promise.all([
      api(`/children/${id}`),
      api(`/scores/child/${id}/summary`)
    ]);
    setData(d);
    setSummary(s);
    setForm({
      child_name: d.child.child_name || '',
      age: d.child.age || '',
      theme: d.child.theme || '',
      interests: d.child.interests || '',
      favorite_colors: d.child.favorite_colors || '',
      parent_email: d.child.parent_email || '',
      password: ''
    });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!data || !form) return <div className="center-spinner">Loading…</div>;

  const save = async (e) => {
    e.preventDefault();
    setMsg('');
    const body = { ...form, age: form.age ? Number(form.age) : null };
    if (!body.password) delete body.password;
    await api(`/children/${id}`, { method: 'PUT', body });
    setMsg('Saved ✔');
    setTimeout(() => setMsg(''), 1500);
    load();
  };

  const remove = async () => {
    if (!confirm(`Delete ${data.child.child_name}? This removes their games and scores.`)) return;
    await api(`/children/${id}`, { method: 'DELETE' });
    nav('/admin');
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <Layout role="admin">
      <div className="container">
        <div className="section-title">
          <div>
            <Link to="/admin" style={{ color: 'var(--muted)', textDecoration: 'none' }}>
              ← All clients
            </Link>
            <h2 style={{ margin: '6px 0 0' }}>👤 {data.child.child_name}</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              Login: <strong>{data.child.username}</strong>
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link to={`/admin/child/${id}/games`}>
              <button className="btn-secondary">🎮 Manage games</button>
            </Link>
            <button className="btn-danger" onClick={remove}>Delete</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <form onSubmit={save} className="stat-card">
            <h3 style={{ marginTop: 0 }}>Profile</h3>
            {msg && <div style={{ color: 'var(--success)', marginBottom: 10 }}>{msg}</div>}
            <div className="field"><label>Child's name</label>
              <input value={form.child_name} onChange={set('child_name')} /></div>
            <div className="field"><label>Age</label>
              <input type="number" value={form.age} onChange={set('age')} /></div>
            <div className="field"><label>Theme</label>
              <input value={form.theme} onChange={set('theme')} /></div>
            <div className="field"><label>Interests</label>
              <input value={form.interests} onChange={set('interests')} /></div>
            <div className="field"><label>Favorite colors</label>
              <input value={form.favorite_colors} onChange={set('favorite_colors')} /></div>
            <div className="field"><label>Parent email</label>
              <input type="email" value={form.parent_email} onChange={set('parent_email')} /></div>
            <div className="field"><label>Reset password (leave blank to keep)</label>
              <input value={form.password} onChange={set('password')} placeholder="New password" /></div>
            <button className="btn-primary" type="submit">Save</button>
          </form>

          <div className="stat-card">
            <h3 style={{ marginTop: 0 }}>Activity</h3>
            {summary.games.length === 0 && <p className="muted">No games yet.</p>}
            {summary.games.map((g) => (
              <div key={g.game_id} style={{ borderBottom: '1px solid var(--border)', padding: '10px 0' }}>
                <strong>{g.game_name}</strong>
                <div className="stat-row"><span className="label">Plays</span><span className="value">{g.plays}</span></div>
                <div className="stat-row"><span className="label">Best</span><span className="value">{g.best}</span></div>
                <div className="stat-row"><span className="label">Avg</span><span className="value">{g.avg}</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
