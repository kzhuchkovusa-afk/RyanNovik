import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth.jsx';

// Landing detects a remembered session. If a child JWT is already stored
// (from a previous /enter or /login), show a "Continue as {name}" tap tile
// so the kid doesn't see the marketing pitch every time they open the app.
// The password path (/login) stays available for the admin.
export default function Landing() {
  const nav = useNavigate();
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="center-spinner">Loading…</div>;
  }

  // Remembered child session → one-tap re-entry.
  if (user && user.role === 'child') {
    return <RememberedChild user={user} onEnter={() => nav('/play')} />;
  }

  // Admin came back to /: send them to their console.
  if (user && user.role === 'admin') {
    return <RememberedAdmin onEnter={() => nav('/admin')} />;
  }

  return (
    <div className="landing-hero">
      <div className="landing-card">
        <h1>🧠 KidsBrain</h1>
        <p className="tagline">Personalized brain games, built just for your child.</p>
        <p style={{ color: 'var(--muted)' }}>
          Three custom games — memory, attention, and fast-thinking — designed around what
          your child already loves (dinosaurs, princesses, space, you name it).
        </p>
        <div className="feature-row">
          <div className="feature">
            <div className="emoji">🧩</div>
            <h3>Memory Match</h3>
            <p>Themed cards. Find pairs. Train recall.</p>
          </div>
          <div className="feature">
            <div className="emoji">🔍</div>
            <h3>Focus Finder</h3>
            <p>Spot the odd one out. Sharpen attention.</p>
          </div>
          <div className="feature">
            <div className="emoji">⚡</div>
            <h3>Speed Dash</h3>
            <p>Beat the clock. Build fast thinking.</p>
          </div>
        </div>
        <Link to="/login">
          <button className="btn-primary" style={{ fontSize: 18, padding: '14px 28px' }}>
            Sign in to play →
          </button>
        </Link>
      </div>
    </div>
  );
}

function RememberedChild({ user, onEnter }) {
  // We only have the user profile in AuthProvider's state; the avatar/name
  // travel with /auth/me. Use fallbacks so first paint is instant.
  const name = user.child_name || user.username;
  const avatar = user.avatar || '🎈';
  return (
    <div className="landing-hero" style={{ background: 'linear-gradient(135deg, #a29bfe, #74b9ff)' }}>
      <div style={{
        background: 'white', borderRadius: 28, padding: 40, maxWidth: 380, width: '100%',
        textAlign: 'center', boxShadow: '0 24px 60px rgba(0,0,0,0.25)'
      }}>
        <div style={{ fontSize: 14, color: '#636e72', letterSpacing: 1, textTransform: 'uppercase' }}>
          Tap to play
        </div>
        <button
          onClick={onEnter}
          style={{
            background: 'transparent', border: 0, cursor: 'pointer',
            margin: '20px auto', display: 'block', padding: 0
          }}
        >
          <div style={{
            width: 160, height: 160, borderRadius: '50%', margin: '0 auto',
            background: 'linear-gradient(135deg, #a8e6cf, #ffd3b6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 110, boxShadow: '0 12px 30px rgba(0,0,0,0.15)'
          }}>
            {avatar}
          </div>
          <div style={{ marginTop: 16, fontSize: 30, fontWeight: 800, color: '#2d3436' }}>
            {name}
          </div>
        </button>
        <div style={{ marginTop: 16 }}>
          <Link to="/login" style={{ fontSize: 13, color: '#636e72' }}>
            Not you? Sign in with a password →
          </Link>
        </div>
      </div>
    </div>
  );
}

function RememberedAdmin({ onEnter }) {
  return (
    <div className="landing-hero">
      <div className="landing-card">
        <h1>🧠 KidsBrain</h1>
        <p className="tagline">Welcome back, owner.</p>
        <button
          onClick={onEnter}
          className="btn-primary"
          style={{ fontSize: 18, padding: '14px 28px' }}
        >
          Open admin console →
        </button>
        <p style={{ marginTop: 16 }}>
          <Link to="/login" style={{ color: 'var(--muted)' }}>Sign in as someone else</Link>
        </p>
      </div>
    </div>
  );
}
