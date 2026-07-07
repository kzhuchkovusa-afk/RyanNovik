// KidsBrain Game SDK — the postMessage contract between the shell and every game.
//
// Two entry points:
//   • KidsBrainGame.connect({onInit,onStop}) — used INSIDE a game module.
//   • KidsBrainShell.mount(iframeEl, initPayload, handlers) — used by the hub/shell to load a game.
//
// Same module is imported by both sides so message shapes stay in exactly one place.
// See PLATFORM_ARCHITECTURE.md §2 and TASK_1.1_game_contract_sdk.md.

export const PROTOCOL_VERSION = 1;

export const MSG = Object.freeze({
  // shell → game
  INIT: 'init',
  STOP: 'stop',
  // game → shell
  READY: 'ready',
  PROGRESS: 'progress',
  SESSION_COMPLETE: 'sessionComplete',
  REQUEST_EXIT: 'requestExit'
});

// Clamp a score to a valid 0-100 integer. Non-numbers become 0.
function clampScore(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function safeNumber(x, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function safeObject(x) {
  return x && typeof x === 'object' && !Array.isArray(x) ? x : {};
}

// ---------- GAME SIDE ----------
// Called ONCE from inside each game module. Returns a handle with
// progress/complete/exit methods. The game is expected to render nothing
// until onInit fires — the shell owns "when to start".
export const KidsBrainGame = {
  connect({ onInit, onStop, allowedParentOrigin } = {}) {
    // parentOrigin: where we send messages. Starts as "*" for the initial
    // ready broadcast (which carries no secrets); locks to the shell's real
    // origin the moment the shell replies with `init`.
    let parentOrigin = '*';
    let initReceived = false;
    let handshakeTimer = null;

    // Optional origin hint via URL (?po=...). The shell adds this when
    // it renders the iframe so a sandboxed null-origin game can still
    // validate messages from the shell without waiting for init.
    let expectedOrigin = allowedParentOrigin || null;
    try {
      const url = new URL(window.location.href);
      const po = url.searchParams.get('po');
      if (po) expectedOrigin = po;
    } catch { /* no-op */ }

    const send = (message) => {
      if (!window.parent || window.parent === window) return;
      window.parent.postMessage(message, parentOrigin);
    };

    const originAllowed = (origin) => {
      if (expectedOrigin) return origin === expectedOrigin;
      // No hint yet — accept only the first origin we hear from and then
      // stick with it. Anything else is dropped.
      return true;
    };

    const handleMessage = (event) => {
      if (event.source !== window.parent) return;
      if (!originAllowed(event.origin)) return;
      const msg = event.data;
      if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return;

      switch (msg.type) {
        case MSG.INIT: {
          if (initReceived) return; // ignore duplicates
          initReceived = true;
          if (handshakeTimer) { clearTimeout(handshakeTimer); handshakeTimer = null; }
          // Lock parent origin to whatever we just heard from.
          if (!expectedOrigin) expectedOrigin = event.origin;
          parentOrigin = event.origin || parentOrigin;
          const payload = {
            child: safeObject(msg.child),
            config: safeObject(msg.config),
            limits: safeObject(msg.limits),
            locale: typeof msg.locale === 'string' ? msg.locale : 'en'
          };
          if (typeof onInit === 'function') {
            try { onInit(payload); } catch (e) { console.error('[game-sdk] onInit threw', e); }
          }
          break;
        }
        case MSG.STOP: {
          const reason = typeof msg.reason === 'string' ? msg.reason : 'unknown';
          if (typeof onStop === 'function') {
            try { onStop({ reason }); } catch (e) { console.error('[game-sdk] onStop threw', e); }
          }
          break;
        }
        default:
          // Silently ignore unknown message types.
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    // Announce ready.
    send({ type: MSG.READY, protocol: PROTOCOL_VERSION });

    // Re-announce a few times in case the shell attached its listener late.
    handshakeTimer = setInterval(() => {
      if (initReceived) { clearInterval(handshakeTimer); handshakeTimer = null; return; }
      send({ type: MSG.READY, protocol: PROTOCOL_VERSION });
    }, 500);
    // Give up after 10s — no shell, no game.
    setTimeout(() => { if (handshakeTimer) { clearInterval(handshakeTimer); handshakeTimer = null; } }, 10000);

    return {
      progress(pct) {
        send({ type: MSG.PROGRESS, pct: clampScore(pct) });
      },
      complete(payload) {
        const safe = safeObject(payload);
        send({
          type: MSG.SESSION_COMPLETE,
          skill: typeof safe.skill === 'string' ? safe.skill : undefined,
          score: clampScore(safe.score),
          level: Number.isFinite(Number(safe.level)) ? Number(safe.level) : null,
          durationSec: Math.max(0, Math.round(safeNumber(safe.durationSec, 0))),
          raw: safeObject(safe.raw)
        });
      },
      exit() {
        send({ type: MSG.REQUEST_EXIT });
      },
      destroy() {
        window.removeEventListener('message', handleMessage);
        if (handshakeTimer) { clearInterval(handshakeTimer); handshakeTimer = null; }
      }
    };
  }
};

// ---------- SHELL SIDE ----------
// Called from the hub (or any component that needs to embed a game).
// The iframe element MUST already be in the DOM before calling.
// Returns a handle: stop(reason), destroy(), plus a bit of introspection.
export const KidsBrainShell = {
  mount(iframeEl, initPayload = {}, handlers = {}) {
    if (!iframeEl || iframeEl.tagName !== 'IFRAME') {
      throw new Error('KidsBrainShell.mount: iframeEl must be a mounted <iframe> element');
    }

    // The iframe's src is the game module URL. Its origin is what we allow.
    let allowedOrigin;
    try {
      allowedOrigin = new URL(iframeEl.src, window.location.href).origin;
    } catch {
      throw new Error('KidsBrainShell.mount: iframe src is invalid');
    }

    let readyHandled = false;
    let sessionRecorded = false;
    let lastProgress = 0;
    let destroyed = false;

    const send = (msg) => {
      if (destroyed) return;
      const target = iframeEl.contentWindow;
      if (!target) return;
      target.postMessage(msg, allowedOrigin);
    };

    const handleMessage = (event) => {
      if (destroyed) return;
      // Origin check — reject anything not from the game's origin.
      if (event.origin !== allowedOrigin) return;
      // Source check — reject anything not from THIS iframe.
      if (event.source !== iframeEl.contentWindow) return;

      const msg = event.data;
      if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return;

      switch (msg.type) {
        case MSG.READY: {
          // Handshake: the game asks for init. Duplicate readys are ignored.
          if (readyHandled) return;
          readyHandled = true;
          send({
            type: MSG.INIT,
            child: safeObject(initPayload.child),
            config: safeObject(initPayload.config),
            limits: safeObject(initPayload.limits),
            locale: typeof initPayload.locale === 'string' ? initPayload.locale : 'en'
          });
          break;
        }
        case MSG.PROGRESS: {
          lastProgress = clampScore(msg.pct);
          if (typeof handlers.onProgress === 'function') {
            try { handlers.onProgress(lastProgress); } catch (e) { console.error(e); }
          }
          break;
        }
        case MSG.SESSION_COMPLETE: {
          if (sessionRecorded) return;
          sessionRecorded = true;
          const safe = {
            skill: typeof msg.skill === 'string' ? msg.skill : null,
            score: clampScore(msg.score),
            level: Number.isFinite(Number(msg.level)) ? Number(msg.level) : null,
            durationSec: Math.max(0, Math.round(safeNumber(msg.durationSec, 0))),
            raw: safeObject(msg.raw)
          };
          if (typeof handlers.onSessionComplete === 'function') {
            try { handlers.onSessionComplete(safe); } catch (e) { console.error(e); }
          }
          break;
        }
        case MSG.REQUEST_EXIT: {
          if (typeof handlers.onExit === 'function') {
            try {
              handlers.onExit({ lastProgress, completed: sessionRecorded });
            } catch (e) { console.error(e); }
          }
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    return {
      stop(reason = 'stopByShell') {
        send({ type: MSG.STOP, reason: String(reason) });
      },
      destroy() {
        destroyed = true;
        window.removeEventListener('message', handleMessage);
      },
      getLastProgress: () => lastProgress,
      hasCompleted: () => sessionRecorded,
      hasReceivedReady: () => readyHandled
    };
  }
};

// Helper the shell uses to build the iframe src for the SAME-ORIGIN
// game-host route we ship with the platform. Adds the parent-origin hint.
export function buildGameHostSrc(gameKey, extra = {}) {
  const params = new URLSearchParams({ key: String(gameKey || ''), po: window.location.origin });
  for (const [k, v] of Object.entries(extra)) {
    if (v == null) continue;
    params.set(k, String(v));
  }
  return `/game-host?${params.toString()}`;
}
