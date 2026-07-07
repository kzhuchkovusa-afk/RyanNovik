import { useState } from 'react';
import ParentDashboard from './ParentDashboard.jsx';
import ParentControls from './ParentControls.jsx';

// The gated parent area: dark chrome, two tabs (Progress + Controls),
// prominent exit button. Sits between the PIN pad and the individual views.
export default function ParentArea({ onExit }) {
  const [tab, setTab] = useState('progress');
  return (
    <div style={{ minHeight: '100vh', background: '#16213E', color: 'white' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: '#0F3460', position: 'sticky', top: 0, zIndex: 10
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>👨‍👩‍👧 Parent area</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>Session auto-ends in 30 min.</div>
        </div>
        <button
          onClick={onExit}
          style={{
            background: 'transparent', color: 'rgba(255,255,255,0.75)',
            border: '2px solid rgba(255,255,255,0.3)', padding: '8px 14px',
            borderRadius: 10, fontWeight: 700, cursor: 'pointer'
          }}
        >
          Exit
        </button>
      </div>

      <div style={{
        display: 'flex', gap: 4, padding: '10px 20px',
        background: '#0F3460', borderBottom: '1px solid rgba(255,255,255,0.06)'
      }}>
        <Tab label="📈 Progress" active={tab === 'progress'} onClick={() => setTab('progress')} />
        <Tab label="🎛️ Controls" active={tab === 'controls'} onClick={() => setTab('controls')} />
      </div>

      <div>
        {tab === 'progress' && (
          <div style={{ padding: 8 }}>
            <ParentDashboard />
          </div>
        )}
        {tab === 'controls' && <ParentControls />}
      </div>
    </div>
  );
}

function Tab({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? '#16213E' : 'transparent',
        color: active ? 'white' : 'rgba(255,255,255,0.6)',
        border: 0, padding: '10px 16px', borderRadius: '10px 10px 0 0',
        fontWeight: 700, cursor: 'pointer', fontSize: 15
      }}
    >
      {label}
    </button>
  );
}
