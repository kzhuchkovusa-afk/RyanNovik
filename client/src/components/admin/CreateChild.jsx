import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../shared/Layout.jsx';
import { api } from '../../lib/api.js';

const AVATAR_CHOICES = ['🦖', '🦕', '🚀', '👑', '🐠', '🐱', '🐶', '🦄', '🌈', '⚽', '🎈'];

export default function CreateChild() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({
    username: '', password: '',
    child_name: '', age: '', avatar: '🦖',
    theme: '', interests: '', favorite_colors: '',
    parent_email: '', client_id: ''
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [createdAccessToken, setCreatedAccessToken] = useState(null);
  const [newChildId, setNewChildId] = useState(null);

  useEffect(() => {
    api('/clients').then((r) => {
      setClients(r.clients || []);
      const preselect = params.get('client');
      if (preselect) setForm((f) => ({ ...f, client_id: preselect }));
    }).catch(() => {});
    // eslint-disable-next-line
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const res = await api('/children', {
        method: 'POST',
        body: {
          ...form,
          age: form.age ? Number(form.age) : null,
          client_id: Number(form.client_id)
        }
      });
      setCreatedAccessToken(res.access_token);
      setNewChildId(res.id);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  if (createdAccessToken) {
    const link = `${window.location.origin}/enter?token=${createdAccessToken}`;
    return (
      <Layout role="admin">
        <div className="container" style={{ maxWidth: 640 }}>
          <div className="stat-card">
            <h2>🎉 Child created</h2>
            <p className="muted">Send this magic link to the parent. The child taps it once → in.</p>
            <LinkReveal link={link} />
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn-primary" onClick={() => nav(`/admin/child/${newChildId}`)}>
                Configure games →
              </button>
              <button className="btn-ghost" onClick={() => nav('/admin')}>Back to console</button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout role="admin">
      <div className="container" style={{ maxWidth: 640 }}>
        <h2>➕ New Child</h2>
        {err && <div className="error">{err}</div>}
        <form onSubmit={submit} className="stat-card">
          <div className="field">
            <label>Client *</label>
            {clients.length === 0 ? (
              <p className="muted">No clients yet — <a href="/admin/new-client">create one first</a>.</p>
            ) : (
              <select value={form.client_id} onChange={set('client_id')} required>
                <option value="">Pick a client…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="field">
              <label>Username *</label>
              <input value={form.username} onChange={set('username')} required />
            </div>
            <div className="field">
              <label>Password *</label>
              <input value={form.password} onChange={set('password')} required />
            </div>
            <div className="field">
              <label>Child's name *</label>
              <input value={form.child_name} onChange={set('child_name')} required />
            </div>
            <div className="field">
              <label>Age</label>
              <input type="number" min="2" max="14" value={form.age} onChange={set('age')} />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label>Avatar</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {AVATAR_CHOICES.map((av) => (
                  <button
                    key={av} type="button"
                    onClick={() => setForm({ ...form, avatar: av })}
                    style={{
                      padding: 10, fontSize: 26, minHeight: 0,
                      background: form.avatar === av ? 'var(--primary)' : 'var(--bg)',
                      color: form.avatar === av ? 'white' : 'inherit'
                    }}
                  >
                    {av}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Theme</label>
              <input value={form.theme} onChange={set('theme')} placeholder="dinosaurs, princesses, space…" />
            </div>
            <div className="field">
              <label>Favorite colors</label>
              <input value={form.favorite_colors} onChange={set('favorite_colors')} placeholder="green, orange" />
            </div>
          </div>
          <div className="field">
            <label>Interests</label>
            <input value={form.interests} onChange={set('interests')} placeholder="T-Rex, volcanoes, fossils" />
          </div>
          <div className="field">
            <label>Parent email (optional)</label>
            <input type="email" value={form.parent_email} onChange={set('parent_email')} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-primary" type="submit" disabled={busy || !form.client_id}>
              {busy ? 'Creating…' : 'Create child'}
            </button>
            <button className="btn-ghost" type="button" onClick={() => nav('/admin')}>Cancel</button>
          </div>
        </form>
      </div>
    </Layout>
  );
}

// Reveal + copy the magic link — used both here and inside ManageChild.
export function LinkReveal({ link }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ display: 'flex', gap: 8, background: 'var(--bg)', padding: 12, borderRadius: 10, alignItems: 'center' }}>
      <code style={{ flex: 1, wordBreak: 'break-all', fontSize: 13 }}>{link}</code>
      <button
        className="btn-primary"
        style={{ padding: '8px 12px' }}
        onClick={() => {
          navigator.clipboard.writeText(link).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1400);
          });
        }}
      >
        {copied ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  );
}
