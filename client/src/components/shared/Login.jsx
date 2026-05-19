import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth.jsx';

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const user = await login(username.trim(), password);
      nav(user.role === 'admin' ? '/admin' : '/play', { replace: true });
    } catch (e2) {
      setErr(e2.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <h2>Welcome back 👋</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Sign in to your KidsBrain account.
        </p>
        {err && <div className="error">{err}</div>}
        <div className="field">
          <label>Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            autoComplete="username"
          />
        </div>
        <div className="field">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        <button className="btn-primary" type="submit" style={{ width: '100%' }} disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p style={{ textAlign: 'center', marginTop: 18 }}>
          <Link to="/" className="muted">← Back to home</Link>
        </p>
      </form>
    </div>
  );
}
