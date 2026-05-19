import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../shared/Layout.jsx';
import { api } from '../../lib/api.js';

const empty = {
  username: '',
  password: '',
  child_name: '',
  age: '',
  theme: '',
  interests: '',
  favorite_colors: '',
  parent_email: ''
};

export default function CreateChild() {
  const nav = useNavigate();
  const [form, setForm] = useState(empty);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const { id } = await api('/children', {
        method: 'POST',
        body: {
          ...form,
          age: form.age ? Number(form.age) : null
        }
      });
      nav(`/admin/child/${id}`);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout role="admin">
      <div className="container" style={{ maxWidth: 640 }}>
        <h2>➕ Create New Child</h2>
        {err && <div className="error">{err}</div>}
        <form onSubmit={submit} className="stat-card">
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
            <div className="field">
              <label>Theme</label>
              <input
                value={form.theme}
                onChange={set('theme')}
                placeholder="dinosaurs, princesses, space…"
              />
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
            <label>Parent email</label>
            <input type="email" value={form.parent_email} onChange={set('parent_email')} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? 'Creating…' : 'Create Child'}
            </button>
            <button className="btn-ghost" type="button" onClick={() => nav('/admin')}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
