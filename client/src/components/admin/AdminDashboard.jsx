import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../shared/Layout.jsx';
import { api } from '../../lib/api.js';

// Owner console home:
//   • Overview stats (clients / kids / plays / active-last-7d)
//   • Clients list with a warning if any parent PIN is still the default 1234
//   • Children table (across all clients)
export default function AdminDashboard() {
  const [clients, setClients] = useState([]);
  const [children, setChildren] = useState([]);
  const [overview, setOverview] = useState(null);

  const load = async () => {
    const [c, cs, o] = await Promise.all([
      api('/clients'),
      api('/children'),
      api('/scores/admin/overview')
    ]);
    setClients(c.clients || []);
    setChildren(cs.children || []);
    setOverview(o);
  };

  useEffect(() => { load(); }, []);

  const defaultPinCount = clients.filter((c) => c.parent_pin_is_default).length;

  return (
    <Layout role="admin">
      <div className="container">
        <div className="section-title">
          <h2>📊 KidsBrain Owner Console</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link to="/admin/new-client">
              <button className="btn-secondary">+ New Client</button>
            </Link>
            <Link to="/admin/new">
              <button className="btn-primary">+ New Child</button>
            </Link>
          </div>
        </div>

        {defaultPinCount > 0 && (
          <div style={{
            background: '#ffe5dd', color: '#c0392b', border: '2px solid #e17055',
            padding: 14, borderRadius: 12, marginBottom: 18, fontWeight: 700
          }}>
            ⚠️ {defaultPinCount} {defaultPinCount === 1 ? 'client is' : 'clients are'} still using the
            default PIN <code>1234</code>. Rotate before handing links to real parents.
          </div>
        )}

        {overview && (
          <div className="stats-grid" style={{ marginBottom: 24 }}>
            <Stat label="Clients" value={overview.total_clients} />
            <Stat label="Children" value={overview.total_children} />
            <Stat label="Games deployed" value={overview.total_games} />
            <Stat label="Plays (all-time)" value={overview.total_plays} />
            <Stat label="Active last 7 days" value={overview.active_last_7d} />
          </div>
        )}

        <div className="section-title"><h2>Clients</h2></div>
        {clients.length === 0 ? (
          <p className="muted">No clients yet.</p>
        ) : (
          <table className="client-table" style={{ marginBottom: 30 }}>
            <thead>
              <tr>
                <th>Name</th><th>Contact</th><th>Plan</th><th>Kids</th><th>PIN</th><th></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td><Link to={`/admin/client/${c.id}`}><strong>{c.name}</strong></Link></td>
                  <td>{c.contact || '—'}</td>
                  <td>{c.plan}</td>
                  <td>{c.child_count}</td>
                  <td>
                    {c.parent_pin_is_default ? (
                      <span className="tag inactive">⚠️ default</span>
                    ) : (
                      <span className="tag active">custom</span>
                    )}
                  </td>
                  <td><Link to={`/admin/client/${c.id}`}>Open →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="section-title"><h2>All children</h2></div>
        {children.length === 0 ? (
          <p className="muted">No children yet.</p>
        ) : (
          <table className="client-table">
            <thead>
              <tr>
                <th>Child</th><th>Client</th><th>Login</th><th>Theme</th><th>Games</th><th>Plays</th><th>Last played</th><th></th>
              </tr>
            </thead>
            <tbody>
              {children.map((c) => {
                const active = c.last_played &&
                  (Date.now() - new Date(c.last_played + 'Z').getTime()) / 86400000 < 7;
                return (
                  <tr key={c.id}>
                    <td><strong>{c.child_name || c.username}</strong>{c.age ? ` · ${c.age}y` : ''}</td>
                    <td>{c.client_name || '—'}</td>
                    <td>{c.username}</td>
                    <td>{c.theme || '—'}</td>
                    <td>{c.active_games}</td>
                    <td>{c.total_plays}</td>
                    <td>
                      <span className={`tag ${active ? 'active' : 'inactive'}`}>
                        {c.last_played ? relTime(c.last_played) : 'never'}
                      </span>
                    </td>
                    <td><Link to={`/admin/child/${c.id}`}>Manage →</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat-card">
      <h4>{label}</h4>
      <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--primary)' }}>{value}</div>
    </div>
  );
}
function relTime(iso) {
  const t = new Date(iso + 'Z').getTime();
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}
