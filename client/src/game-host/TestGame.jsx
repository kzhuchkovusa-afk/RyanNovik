import { useEffect, useState } from 'react';

// A one-screen game used to verify the SDK contract end-to-end.
// It shows the init payload the shell sent, lets you emit progress,
// simulate an early exit request, and complete with a canned score.
export default function TestGame({ child, config, limits, locale, stopSignal, sdk }) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('running');

  useEffect(() => {
    if (!stopSignal) return;
    setStatus(`stopping (${stopSignal.reason})`);
    // Honor stop: report whatever progress we had and exit.
    sdk.complete({
      skill: 'attention',
      score: progress || 25,
      level: 1,
      durationSec: 10,
      raw: { source: '__test', stopped: true, reason: stopSignal.reason }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopSignal]);

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', maxWidth: 640 }}>
      <h2>SDK Test Game</h2>
      <p style={{ color: '#636e72' }}>
        This module exists only to prove the shell↔game contract works.
      </p>
      <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 8, fontSize: 12, overflow: 'auto' }}>
{JSON.stringify({ child, config, limits, locale, status }, null, 2)}
      </pre>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <button
          onClick={() => { const p = Math.min(100, progress + 25); setProgress(p); sdk.progress(p); }}
          style={{ padding: '10px 16px', fontWeight: 700, borderRadius: 8, border: 0, background: '#6c5ce7', color: 'white' }}
        >
          progress +25 (now {progress})
        </button>
        <button
          onClick={() => sdk.complete({ skill: 'attention', score: 73, level: 3, durationSec: 42, raw: { source: '__test', canned: true } })}
          style={{ padding: '10px 16px', fontWeight: 700, borderRadius: 8, border: 0, background: '#00b894', color: 'white' }}
        >
          complete (score 73)
        </button>
        <button
          onClick={() => sdk.exit()}
          style={{ padding: '10px 16px', fontWeight: 700, borderRadius: 8, border: 0, background: '#e17055', color: 'white' }}
        >
          exit
        </button>
      </div>
    </div>
  );
}
