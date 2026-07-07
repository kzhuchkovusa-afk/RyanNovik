import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { KidsBrainShell, buildGameHostSrc } from '../../shared/game-sdk.js';

// Renders a sandboxed iframe pointing at /game-host?key=... and wires it
// to the SDK. This is the "shell loader" side of the contract.
//
// Props:
//   gameKey    — registry key of the game to load (e.g. "focus_finder")
//   child      — { id, name, avatar, age } → passed to game via init.child
//   config     — the assignment's config JSON → passed to game via init.config
//   limits     — { maxSessionSeconds } → passed to game via init.limits
//   locale     — "en" | "ru" | ...
//   onSessionComplete(payload) — REQUIRED; called when the game emits sessionComplete
//   onExit()   — game asked to leave
//   onProgress(pct) — optional live progress
//   allowSameOrigin — dev-only escape hatch; leave false in production
//
// Imperative handle (via ref):
//   stop(reason) — tell the game to wrap up; used by the session-limit timer
const GameLauncher = forwardRef(function GameLauncher({
  gameKey,
  child,
  config,
  limits,
  locale = 'en',
  onSessionComplete,
  onExit,
  onProgress,
  allowSameOrigin = false
}, ref) {
  const iframeRef = useRef(null);
  const handleRef = useRef(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = iframeRef.current;
    if (!el) return;
    const handle = KidsBrainShell.mount(el, {
      child, config, limits, locale
    }, {
      onProgress: (p) => { setProgress(p); if (onProgress) onProgress(p); },
      onSessionComplete: (payload) => { if (onSessionComplete) onSessionComplete(payload); },
      onExit: () => { if (onExit) onExit(); }
    });
    handleRef.current = handle;
    return () => handle.destroy();
    // Intentionally NOT re-mounting when child/config change — the parent
    // is expected to remount by giving this component a new React key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    stop: (reason) => handleRef.current && handleRef.current.stop(reason),
    getLastProgress: () => handleRef.current ? handleRef.current.getLastProgress() : 0,
    hasCompleted: () => handleRef.current ? handleRef.current.hasCompleted() : false
  }));

  const src = buildGameHostSrc(gameKey);
  // Sandbox strategy:
  //   Prod:      "allow-scripts"           — game runs but cannot read parent token/DOM.
  //   Dev opt:   "allow-scripts allow-same-origin" — needed if Vite HMR misbehaves.
  const sandbox = allowSameOrigin ? 'allow-scripts allow-same-origin' : 'allow-scripts';

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {progress > 0 && progress < 100 && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 4,
          background: 'rgba(0,0,0,0.08)', zIndex: 2, pointerEvents: 'none'
        }}>
          <div style={{ height: '100%', width: `${progress}%`, background: '#6c5ce7', transition: 'width .15s linear' }} />
        </div>
      )}
      <iframe
        ref={iframeRef}
        title={`kidsbrain-game-${gameKey}`}
        src={src}
        sandbox={sandbox}
        style={{ width: '100%', height: '100%', border: 0, display: 'block', background: '#fff' }}
      />
    </div>
  );
});

export default GameLauncher;
