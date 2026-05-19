import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../shared/Layout.jsx';
import { api } from '../../lib/api.js';
import {
  memoryTemplate,
  attentionTemplate,
  speedTemplate
} from '../../lib/gameTemplates.js';

const TYPE_LABELS = { memory: '🧩 Memory Match', attention: '🔍 Focus Finder', speed: '⚡ Speed Dash' };

export default function ManageGames() {
  const { id } = useParams();
  const [child, setChild] = useState(null);
  const [games, setGames] = useState([]);
  const [selected, setSelected] = useState(null); // game id or 'new'
  const [draft, setDraft] = useState(null);
  const [msg, setMsg] = useState('');

  const load = async () => {
    const d = await api(`/children/${id}`);
    setChild(d.child);
    setGames(d.games);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!child) return <div className="center-spinner">Loading…</div>;

  const editGame = (g) => {
    setSelected(g.id);
    setDraft({
      game_name: g.game_name,
      game_type: g.game_type,
      is_active: g.is_active,
      config_text: JSON.stringify(g.game_config, null, 2)
    });
  };

  const newGame = (type) => {
    const template =
      type === 'memory' ? memoryTemplate(child) :
      type === 'attention' ? attentionTemplate(child) :
      speedTemplate(child);
    setSelected('new');
    setDraft({
      game_name: defaultName(type, child.theme),
      game_type: type,
      is_active: 1,
      config_text: JSON.stringify(template, null, 2)
    });
  };

  const save = async () => {
    setMsg('');
    let parsed;
    try {
      parsed = JSON.parse(draft.config_text);
    } catch (e) {
      setMsg('Invalid JSON: ' + e.message);
      return;
    }
    if (selected === 'new') {
      await api('/games', {
        method: 'POST',
        body: {
          child_id: Number(id),
          game_type: draft.game_type,
          game_name: draft.game_name,
          game_config: parsed
        }
      });
    } else {
      await api(`/games/${selected}`, {
        method: 'PUT',
        body: {
          game_name: draft.game_name,
          game_config: parsed,
          is_active: draft.is_active ? 1 : 0
        }
      });
    }
    setSelected(null);
    setDraft(null);
    load();
  };

  const remove = async (g) => {
    if (!confirm(`Delete game "${g.game_name}"?`)) return;
    await api(`/games/${g.id}`, { method: 'DELETE' });
    load();
  };

  return (
    <Layout role="admin">
      <div className="container">
        <div className="section-title">
          <div>
            <Link to={`/admin/child/${id}`} style={{ color: 'var(--muted)', textDecoration: 'none' }}>
              ← {child.child_name}
            </Link>
            <h2 style={{ margin: '6px 0 0' }}>🎮 Games for {child.child_name}</h2>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn-secondary" onClick={() => newGame('memory')}>+ Memory</button>
            <button className="btn-secondary" onClick={() => newGame('attention')}>+ Attention</button>
            <button className="btn-secondary" onClick={() => newGame('speed')}>+ Speed</button>
          </div>
        </div>

        {games.length === 0 ? (
          <p className="muted">No games yet. Add one above.</p>
        ) : (
          <table className="client-table" style={{ marginBottom: 24 }}>
            <thead>
              <tr><th>Name</th><th>Type</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {games.map((g) => (
                <tr key={g.id}>
                  <td><strong>{g.game_name}</strong></td>
                  <td>{TYPE_LABELS[g.game_type]}</td>
                  <td>
                    <span className={`tag ${g.is_active ? 'active' : 'inactive'}`}>
                      {g.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn-ghost" onClick={() => editGame(g)} style={{ marginRight: 6 }}>Edit</button>
                    <button className="btn-danger" onClick={() => remove(g)}>×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {draft && (
          <div className="stat-card">
            <h3 style={{ marginTop: 0 }}>
              {selected === 'new' ? 'New' : 'Edit'} {TYPE_LABELS[draft.game_type]}
            </h3>
            {msg && <div className="error">{msg}</div>}
            <div className="field">
              <label>Game name</label>
              <input value={draft.game_name} onChange={(e) => setDraft({ ...draft, game_name: e.target.value })} />
            </div>
            {selected !== 'new' && (
              <div className="field">
                <label>
                  <input
                    type="checkbox"
                    checked={!!draft.is_active}
                    onChange={(e) => setDraft({ ...draft, is_active: e.target.checked ? 1 : 0 })}
                    style={{ width: 'auto', marginRight: 8 }}
                  />
                  Active (visible to child)
                </label>
              </div>
            )}
            <div className="field">
              <label>Config (JSON)</label>
              <textarea
                className="game-config-editor"
                value={draft.config_text}
                onChange={(e) => setDraft({ ...draft, config_text: e.target.value })}
                rows={18}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-primary" onClick={save}>Save</button>
              <button className="btn-ghost" onClick={() => { setDraft(null); setSelected(null); }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

function defaultName(type, theme) {
  const t = theme ? theme[0].toUpperCase() + theme.slice(1) : 'My';
  if (type === 'memory') return `${t} Memory Match`;
  if (type === 'attention') return `${t} Focus Finder`;
  return `${t} Speed Dash`;
}
