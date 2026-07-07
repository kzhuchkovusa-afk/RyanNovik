import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../lib/auth.jsx';
import { useParentAuth } from '../../lib/parentAuth.jsx';

const PIN_LENGTH = 4;

// Kid-safe grown-up gate. Digit keypad (works on phone / iPad).
// Shakes on error, locks visually during 30s cooldown.
export default function PinPad({ onSuccess, onCancel }) {
  const { user } = useAuth();
  const { login } = useParentAuth();
  const [pin, setPin] = useState('');
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [tick, setTick] = useState(0);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (!cooldownUntil) return;
    const id = setInterval(() => setTick((t) => t + 1), 500);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  const cooldownRemaining = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
  const locked = cooldownRemaining > 0 || busy;

  const submit = async (fullPin) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setBusy(true);
    setErr(null);
    try {
      const parent = await login({ childId: user && user.id, pin: fullPin });
      onSuccess && onSuccess(parent);
    } catch (e) {
      const status = e.status || 0;
      const msg = status === 429
        ? `Too many tries. Wait ${e.retry_after_seconds || 30}s.`
        : (e.message || 'Wrong PIN');
      setErr(msg);
      setShake((s) => s + 1);
      setPin('');
      if (status === 429) {
        setCooldownUntil(Date.now() + (parseCooldown(e.message) || 30) * 1000);
      }
    } finally {
      setBusy(false);
      submittedRef.current = false;
    }
  };

  const tapDigit = (d) => {
    if (locked) return;
    setErr(null);
    const next = (pin + d).slice(0, PIN_LENGTH);
    setPin(next);
    if (next.length === PIN_LENGTH) submit(next);
  };
  const back = () => { if (!locked) setPin((p) => p.slice(0, -1)); };
  const clear = () => { if (!locked) { setPin(''); setErr(null); } };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #16213e 0%, #0f3460 100%)', padding: 20
    }}>
      <div
        style={{
          width: '100%', maxWidth: 360, background: '#0F3460', color: 'white',
          borderRadius: 20, padding: 32, boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          transform: shake ? `translateX(${(shake % 2 === 0 ? -1 : 1) * 8}px)` : 'none',
          transition: 'transform .1s'
        }}
        key={shake}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 40 }}>🔒</div>
          <h2 style={{ margin: '10px 0 4px' }}>Grown-up area</h2>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
            Enter the {PIN_LENGTH}-digit PIN to continue.
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 20 }}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 44, height: 54, borderRadius: 12,
                background: 'rgba(255,255,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, fontWeight: 800,
                border: i < pin.length ? '2px solid #4ECDC4' : '2px solid transparent'
              }}
            >
              {i < pin.length ? '•' : ''}
            </div>
          ))}
        </div>

        {err && (
          <div style={{ background: 'rgba(225,112,85,0.15)', color: '#ffb2a3', padding: 10, borderRadius: 10, marginBottom: 12, textAlign: 'center', fontSize: 14 }}>
            {err}
          </div>
        )}

        {cooldownRemaining > 0 && (
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.7)', marginBottom: 12 }}>
            Try again in {cooldownRemaining}s…
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
            <PadKey key={d} onClick={() => tapDigit(String(d))} disabled={locked}>{d}</PadKey>
          ))}
          <PadKey onClick={clear} disabled={locked}>C</PadKey>
          <PadKey onClick={() => tapDigit('0')} disabled={locked}>0</PadKey>
          <PadKey onClick={back} disabled={locked}>⌫</PadKey>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            onClick={onCancel}
            style={{
              background: 'transparent', color: 'rgba(255,255,255,0.7)',
              border: 0, textDecoration: 'underline', cursor: 'pointer', fontSize: 14
            }}
          >
            ← Back to games
          </button>
        </div>

        <p style={{ marginTop: 20, fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
          Default PIN is <strong>1234</strong>. Ask the owner to change it.
        </p>
      </div>
    </div>
  );
}

function PadKey({ children, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '18px 0', borderRadius: 12, border: 0, background: 'rgba(255,255,255,0.10)',
        color: 'white', fontSize: 22, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1
      }}
    >
      {children}
    </button>
  );
}

function parseCooldown(msg) {
  const m = /(\d+)\s*s/i.exec(msg || '');
  return m ? Number(m[1]) : null;
}
