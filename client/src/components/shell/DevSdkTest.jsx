import { useState } from 'react';
import GameLauncher from './GameLauncher.jsx';

// Diagnostic page for verifying Task 1.1 (SDK + iframe loader) end-to-end.
// Open http://localhost:5173/dev/sdk-test to use.
export default function DevSdkTest() {
  const [events, setEvents] = useState([]);
  const [key, setKey] = useState(0); // bump to remount the iframe

  const log = (type, payload) => {
    setEvents((prev) => [{ at: new Date().toISOString(), type, payload }, ...prev].slice(0, 50));
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 480px', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ borderRight: '1px solid #eee' }}>
        <GameLauncher
          key={key}
          gameKey="__test"
          child={{ id: 'test-child', name: 'Test Kid', avatar: '🦖', age: 8 }}
          config={{ demo: true, message: 'hello from dev test' }}
          limits={{ maxSessionSeconds: 900 }}
          locale="en"
          onProgress={(p) => log('progress', { pct: p })}
          onSessionComplete={(p) => log('sessionComplete', p)}
          onExit={() => log('requestExit', {})}
        />
      </div>
      <div style={{ padding: 16, overflow: 'auto', background: '#fafafa' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Shell events</h3>
          <button
            onClick={() => setKey((k) => k + 1)}
            style={{ padding: '6px 12px', borderRadius: 8, border: 0, background: '#6c5ce7', color: 'white', fontWeight: 700 }}
          >
            Remount iframe
          </button>
        </div>
        {events.length === 0 && <p style={{ color: '#636e72' }}>No messages yet. Poke buttons in the iframe.</p>}
        {events.map((e, i) => (
          <div key={i} style={{ background: 'white', border: '1px solid #eee', borderRadius: 8, padding: 8, marginBottom: 8 }}>
            <div style={{ fontSize: 12, color: '#636e72' }}>{e.at} · <strong>{e.type}</strong></div>
            <pre style={{ margin: '4px 0 0', fontSize: 12, whiteSpace: 'pre-wrap' }}>{JSON.stringify(e.payload, null, 2)}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}
