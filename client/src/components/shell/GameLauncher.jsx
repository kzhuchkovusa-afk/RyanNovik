import { useEffect, useRef, useState } from 'react';
import { KidsBrainShell, buildGameHostSrc } from '../../shared/game-sdk.js';

// Renders a sandboxed iframe pointing at /game-host?key=... and wires it
// to the SDK. This is the "shell loader" side of the contract.
//
// Props:
//   gameKey    — the registry key of the game to load (e.g. "focus_finder")
//   child      — { id, name, avatar, age } → passed to game via init.child
//   config     — the assignment's config JSON → passed to game via init.config
//   limits     — { maxSessionSeconds } → passed to game via init.limits
//   locale     — "en" | "ru" | ...
//   onSessionComplete(payload) — REQUIRED; called when the game emits sessionComplete
//   onExit()   — game asked to leave
//   onProgress(pct) — optional live progress
//   allowSameOrigin — dev-only escape hatch; leave false in production
export default function GameLauncher({
  gameKey,
  child,
  config,
  limits,
  locale = 'en',
  onSessionComplete,
  onExit,
  onProgress,
  allowSameOrigin = false
}) {
  const iframeRef = useRef(null);
  const handleRef = useRef(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = iframeRef.current;
    if (!el) return;
    // Give the iframe a tick to attach to DOM before wiring.
    const handle = KidsBrainShell.mount(el, {
      child, config, limits, locale
    }, {
      onProgress: (p) => { setProgress(p); if (onProgress) onProgress(p); },
      onSessionComplete: (payload) => { if (onSessionComplete) onSessionComplete(payload); },
      onExit: () => { if (onExit) onExit(); }
    });
    handleRef.current = handle;
    return () => handle.destroy();
    // Intentionally NOT re-mounting when child/config change — the game should
    // be re-created (new iframe) by the parent if it wants a fresh session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Public: hosts can call this via ref later. For now expose as effect dep.
  // (Task 1.4 / Phase 2 will use handle.stop for parental limits.)
  // We deliberately keep this component's API minimal.

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
          background: 'rgba(0,0,0,0.08)', zIndex: 2
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
}

// Imperative version — used by parents that need to hold a reference and
// call handle.stop() themselves (e.g. session-limit timer in Phase 2).
export function useGameLauncherHandle() {
  const ref = useRef(null);
  return {
    ref,
    stop: (reason) => ref.current && ref.current.stop(reason)
  };
}
