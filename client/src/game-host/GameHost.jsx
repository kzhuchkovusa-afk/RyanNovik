import { useEffect, useMemo, useRef, useState } from 'react';
import { KidsBrainGame } from '../shared/game-sdk.js';

// Registry: maps a game "key" to the component that implements the SDK contract.
// Games register themselves via a lazy import so the game-host bundle stays lean.
// The __test entry is a diagnostic module used by Task 1.1's throwaway test.
const REGISTRY = {
  __test: () => import('./TestGame.jsx'),
  memory_match: () => import('../components/games/MemoryMatch.jsx'),
  focus_finder: () => import('../components/games/FocusFinder.jsx'),
  speed_dash: () => import('../components/games/SpeedDash.jsx')
};

export default function GameHost() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const key = params.get('key') || '';
  const [Component, setComponent] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loader = REGISTRY[key];
    if (!loader) {
      setError(`Unknown game key: ${key}`);
      return;
    }
    let alive = true;
    loader()
      .then((mod) => {
        if (!alive) return;
        const C = mod.default;
        if (typeof C !== 'function') {
          setError(`Game module for "${key}" has no default export`);
          return;
        }
        setComponent(() => C);
      })
      .catch((e) => {
        if (!alive) return;
        setError(`Failed to load game "${key}": ${e && e.message ? e.message : e}`);
      });
    return () => { alive = false; };
  }, [key]);

  if (error) {
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', color: '#e17055' }}>
        <strong>Game load error:</strong> {error}
      </div>
    );
  }
  if (!Component) {
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', color: '#636e72' }}>
        Loading game…
      </div>
    );
  }
  return <SDKGameFrame Component={Component} />;
}

// Wraps the actual game component with the SDK connect() plumbing so
// individual games only worry about game logic — not messaging.
function SDKGameFrame({ Component }) {
  const gameRef = useRef(null);
  const [initPayload, setInitPayload] = useState(null);
  const [stopSignal, setStopSignal] = useState(null);

  useEffect(() => {
    const handle = KidsBrainGame.connect({
      onInit: (payload) => setInitPayload(payload),
      onStop: (payload) => setStopSignal(payload)
    });
    gameRef.current = handle;
    return () => handle.destroy();
  }, []);

  // Give the wrapped game a stable helper API instead of the raw handle,
  // so a game can just call `sdk.complete({...})` without knowing SDK internals.
  const sdk = useMemo(() => ({
    progress: (pct) => gameRef.current && gameRef.current.progress(pct),
    complete: (payload) => gameRef.current && gameRef.current.complete(payload),
    exit: () => gameRef.current && gameRef.current.exit()
  }), []);

  if (!initPayload) {
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', color: '#636e72' }}>
        Waiting for shell…
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fff' }}>
      <Component
        child={initPayload.child}
        config={initPayload.config}
        limits={initPayload.limits}
        locale={initPayload.locale}
        stopSignal={stopSignal}
        sdk={sdk}
      />
    </div>
  );
}
