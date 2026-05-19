import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../../lib/auth.jsx';

export default function Layout({ children, role }) {
  const { user, logout } = useAuth();
  return (
    <div className="layout">
      <div className="topbar">
        <Link to={user?.role === 'admin' ? '/admin' : '/play'} className="brand">
          🧠 KidsBrain
        </Link>
        <div className="nav">
          {role === 'child' && (
            <>
              <NavLink to="/play" end>Play</NavLink>
              <NavLink to="/parent">Parent View</NavLink>
            </>
          )}
          {role === 'admin' && (
            <>
              <NavLink to="/admin" end>Clients</NavLink>
              <NavLink to="/admin/new">+ New Child</NavLink>
            </>
          )}
          <button className="btn-ghost" onClick={logout} style={{ padding: '6px 12px' }}>
            Log out
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}
