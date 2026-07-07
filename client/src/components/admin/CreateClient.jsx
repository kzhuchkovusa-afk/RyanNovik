import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../shared/Layout.jsx';
import { api } from '../../lib/api.js';

export default function CreateClient() {
  const nav = useNavigate();
  const [form, setForm] = useState({ name: '', contact: '', plan: 'default' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const { id } = await api('/clients', { method: 'POST', body: form });
      nav(`/admin/client/${id}`);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout role="admin">
      <div className="container" style={{ maxWidth: 520 }}>
        <h2>➕ New Client</h2>
        {err && <div className="error">{err}</div>}
        <form onSubmit={submit} className="stat-card">
          <div className="field">
            <label>Client name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="field">
            <label>Contact (email / phone)</label>
            <input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
          </div>
          <div className="field">
            <label>Plan</label>
            <input value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} />
          </div>
          <p className="muted" style={{ fontSize: 13 }}>
            A parent PIN row is auto-created with the default <code>1234</code>. Rotate it in the
            client page before handing out the child's link.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-primary" type="submit" disabled={busy}>
              {busy ? 'Creating…' : 'Create client'}
            </button>
            <button className="btn-ghost" type="button" onClick={() => nav('/admin')}>Cancel</button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
