import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../shared/Layout.jsx';
import { api } from '../../lib/api.js';

export default function AdminDashboard() {
  const [children, setChildren] = useState([]);
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    (async () => {
      const [c, o] = await Promise.all([
        api('/children'),
        api('/scores/admin/overview')
      ]);
      setChildren(c.children);
      setOverview(o);
    })();
  }, []);

  return (
    <Layout role="admin">
      <div className="container">
        <div className="section-title">
          <h2>📊 KidsBrain Admin</h2>
          <Link to="/admin/new">
            <button className="btn-primary">+ New Child</button>
          </Link>
        </div>

        {overview && (
          <div className="stats-grid" style={{ marginBottom: 24 }}>
            <div className="stat-card">
              <h4>Total clients</h4>
              <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--primary)' }}>
                {overview.total_children}
              </div>
            </div>
            <div className="stat-card">
              <h4>Total games deployed</h4>
              <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--primary)' }}>
                {overview.total_games}
              </div>
            </div>
            <div className="stat-card">
              <h4>Total plays</h4>
              <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--primary)' }}>
                {overview.total_plays}
              </div>
            </div>
            <div className="stat-card">
              <h4>Active last 7 days</h4>
              <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--primary)' }}>
                {overview.active_last_7d}
              </div>
            </div>
          </div>
        )}

        <div className="section-title">
          <h2>Clients</h2>
        </div>
        {children.length === 0 ? (
          <p className="muted">No clients yet. Create the first one!</p>
        ) : (
          <table className="client-table">
            <thead>
              <tr>
                <th>Child</th>
                <th>Username</th>
                <th>Theme</th>
                <th>Games</th>
                <th>Plays</th>
                <th>Status</th>
                <th>Last played</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {children.map((c) => {
                const active = c.last_played &&
                  (Date.now() - new Date(c.last_played + 'Z').getTime()) / 86400000 < 7;
                return (
                  <tr key={c.id}>
                    <td><strong>{c.child_name}</strong>{c.age ? ` · ${c.age}y` : ''}</td>
                    <td>{c.username}</td>
                    <td>{c.theme || '—'}</td>
                    <td>{c.active_games}</td>
                    <td>{c.total_plays}</td>
                    <td>
                      <span className={`tag ${active ? 'active' : 'inactive'}`}>
                        {active ? 'Active' : c.last_played ? 'Idle' : 'New'}
                      </span>
                    </td>
                    <td>{c.last_played ? relTime(c.last_played) : 'never'}</td>
                    <td>
                      <Link to={`/admin/child/${c.id}`}>Manage →</Link>
                    </td>
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

function relTime(iso) {
  const t = new Date(iso + 'Z').getTime();
  const diff = (Date.now() - t) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}
