import { Link } from 'react-router-dom';

export default function Landing() {
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
