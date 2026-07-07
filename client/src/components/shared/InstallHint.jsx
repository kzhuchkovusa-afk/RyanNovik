import { useEffect, useState } from 'react';

const DISMISS_KEY = 'kidsbrain_install_hint_dismissed_at';
const REPROMPT_DAYS = 14;

// One-tap-away hint shown only in iOS Safari (not when already installed
// as a PWA and not on other browsers, which have their own beforeinstallprompt).
export default function InstallHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isiOSSafari() || isStandalone()) return;
    const last = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (last && Date.now() - last < REPROMPT_DAYS * 86400_000) return;
    // Show a beat after paint so it doesn't fight the first render.
    const t = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', left: 12, right: 12, bottom: `max(12px, env(safe-area-inset-bottom))`,
      zIndex: 40, background: '#0F3460', color: 'white',
      borderRadius: 16, padding: 14, boxShadow: '0 20px 40px rgba(0,0,0,0.35)',
      display: 'flex', alignItems: 'center', gap: 12, fontSize: 14
    }}>
      <div style={{ fontSize: 30, flexShrink: 0 }}>📲</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, marginBottom: 2 }}>Add KidsBrain to your Home Screen</div>
        <div style={{ opacity: 0.85, fontSize: 12 }}>
          Tap <strong>Share ⤴</strong>, then <strong>“Add to Home Screen”</strong> — opens fullscreen, no browser bar.
        </div>
      </div>
      <button
        onClick={dismiss}
        style={{
          background: 'transparent', color: 'rgba(255,255,255,0.7)',
          border: '1px solid rgba(255,255,255,0.3)', padding: '6px 10px',
          borderRadius: 8, fontWeight: 700, cursor: 'pointer', flexShrink: 0
        }}
      >
        Later
      </button>
    </div>
  );
}

function isiOSSafari() {
  const ua = navigator.userAgent || '';
  const iOS = /iP(ad|hone|od)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return iOS && safari;
}
function isStandalone() {
  // iOS uses `navigator.standalone`; every other engine uses the
  // display-mode media query.
  return (
    (typeof navigator !== 'undefined' && navigator.standalone) ||
    (typeof window !== 'undefined' && window.matchMedia &&
      window.matchMedia('(display-mode: standalone)').matches)
  );
}
