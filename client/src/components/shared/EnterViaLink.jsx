import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';

// The magic-link handler.
// URL: /enter?token=<access_token>
//   1. Read token from ?token=
//   2. Immediately strip it from the URL (history.replaceState)
//   3. POST /api/access/exchange { token } → child JWT
//   4. Store JWT (this is what "remembered login" reuses on repeat visits)
//   5. Redirect to /play
//
// Failure modes: unknown token, expired/revoked token, no token in URL.
// All show a calm message with a back button — never the raw token.
export default function EnterViaLink() {
  const nav = useNavigate();
  const { refresh } = useAuth();
  const [status, setStatus] = useState('exchanging'); // 'exchanging' | 'ok' | 'error'
  const [err, setErr] = useState('');
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      // Strip the token from the URL right now so it's not left in history
      // or the referrer of any subsequent request/asset.
      window.history.replaceState({}, document.title, '/enter');

      if (!token) {
        setStatus('error');
        setErr('No link provided.');
        return;
      }
      try {
        const res = await api('/access/exchange', { method: 'POST', body: { token } });
        setToken(res.token);
        await refresh();
        setStatus('ok');
        // Small delay so the "Welcome" flash doesn't jarringly disappear.
        setTimeout(() => nav('/play', { replace: true }), 250);
      } catch (e) {
        setStatus('error');
        setErr(e.message || 'This link is not valid anymore.');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #a29bfe, #fd79a8)', padding: 20, fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{
        background: 'white', borderRadius: 24, padding: 36, maxWidth: 420, width: '100%',
        textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.2)'
      }}>
        {status === 'exchanging' && (
          <>
            <div style={{ fontSize: 60 }}>✨</div>
            <h2 style={{ margin: '10px 0 4px' }}>One moment…</h2>
            <p style={{ margin: 0, color: '#636e72' }}>Getting you into your games.</p>
          </>
        )}
        {status === 'ok' && (
          <>
            <div style={{ fontSize: 60 }}>🎉</div>
            <h2 style={{ margin: '10px 0 4px' }}>Welcome back!</h2>
            <p style={{ margin: 0, color: '#636e72' }}>Loading your hub…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div style={{ fontSize: 60 }}>😕</div>
            <h2 style={{ margin: '10px 0 4px' }}>Link not valid</h2>
            <p style={{ margin: '4px 0 16px', color: '#636e72' }}>{err}</p>
            <p style={{ margin: '0 0 20px', color: '#636e72', fontSize: 14 }}>
              Ask a grown-up for a fresh link.
            </p>
            <button
              onClick={() => nav('/', { replace: true })}
              style={{
                background: '#6c5ce7', color: 'white', border: 0, padding: '10px 18px',
                borderRadius: 10, fontWeight: 700, cursor: 'pointer'
              }}
            >
              Back to home
            </button>
          </>
        )}
      </div>
    </div>
  );
}
