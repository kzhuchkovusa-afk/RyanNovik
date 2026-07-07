import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Layout from '../shared/Layout.jsx';
import { api } from '../../lib/api.js';

// Per-client console: children under this client + parent PIN reset.
export default function ClientView() {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [pin, setPin] = useState('');
  const [pinMsg, setPinMsg] = useState('');
  const [err, setErr] = useState('');

  const load = async () => {
    try { setData(await api(`/clients/${id}`)); }
    catch (e) { setErr(e.message); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  if (err) return <div className="center-spinner" style={{ color: '#e17055' }}>{err}</div>;
  if (!data) return <div className="center-spinner">Loading…</div>;

  const savePin = async (e) => {
    e.preventDefault();
    setPinMsg('');
    try {
      const res = await api(`/clients/${id}/parent-pin`, { method: 'PUT', body: { pin } });
      setPinMsg(res.pin_is_default ? '⚠️ That is the default PIN.' : 'Saved ✓');
      setPin('');
      load();
    } catch (e2) {
      setPinMsg(e2.message);
    }
  };

  const removeClient = async () => {
    if (!confirm(`Delete client "${data.client.name}"? This removes ALL their children.`)) return;
    await api(`/clients/${id}`, { method: 'DELETE' });
    nav('/admin');
  };

  return (
    <Layout role="admin">
      <div className="container">
        <div className="section-title">
          <div>
            <Link to="/admin" style={{ color: 'var(--muted)', textDecoration: 'none' }}>
              ← All clients
            </Link>
            <h2 style={{ margin: '6px 0 0' }}>{data.client.name}</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              {data.client.contact || 'No contact info'} · plan: {data.client.plan}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link to={`/admin/new?client=${id}`}>
              <button className="btn-primary">+ Add child</button>
            </Link>
            <button className="btn-danger" onClick={removeClient}>Delete client</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="stat-card">
            <h3 style={{ marginTop: 0 }}>Children ({data.children.length})</h3>
            {data.children.length === 0 && <p className="muted">Add a child to start.</p>}
            {data.children.map((c) => (
              <Link
                key={c.id}
                to={`/admin/child/${c.id}`}
                style={{
                  display: 'flex', gap: 12, alignItems: 'center', padding: 12,
                  borderRadius: 12, background: 'var(--bg)', margin: '8px 0',
                  textDecoration: 'none', color: 'inherit'
                }}
              >
                <div style={{ fontSize: 30 }}>{c.avatar || '🎈'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800 }}>{c.child_name}</div>
                  <div className="muted" style={{ fontSize: 13 }}>
                    {c.username} · {c.theme || 'no theme'} · {c.age || '—'}y
                  </div>
                </div>
                <div style={{ color: 'var(--primary)' }}>→</div>
              </Link>
            ))}
          </div>

          <div className="stat-card">
            <h3 style={{ marginTop: 0 }}>Parent PIN</h3>
            {data.parent ? (
              <>
                <div style={{ marginBottom: 12 }}>
                  Status:{' '}
                  {data.parent.pin_is_default ? (
                    <span className="tag inactive">⚠️ default (1234)</span>
                  ) : (
                    <span className="tag active">custom</span>
                  )}
                </div>
                <form onSubmit={savePin}>
                  <div className="field">
                    <label>Set new PIN (4–8 digits)</label>
                    <input
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                      placeholder="e.g. 4271"
                      inputMode="numeric"
                    />
                  </div>
                  <button className="btn-primary" type="submit" disabled={pin.length < 4}>
                    Save PIN
                  </button>
                  {pinMsg && <div style={{ marginTop: 10, color: 'var(--success)' }}>{pinMsg}</div>}
                </form>
                <p className="muted" style={{ fontSize: 13, marginTop: 16 }}>
                  The parent uses this PIN in the Parent area of any child under this client.
                </p>
              </>
            ) : (
              <p className="muted">No parent row (unusual — create one via PIN save above).</p>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
