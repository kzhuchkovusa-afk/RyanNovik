import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api.js';
import { useAuth } from '../../lib/auth.jsx';
import { useParentAuth } from '../../lib/parentAuth.jsx';

// Controls tab of the parent area. All writes carry the parent token
// (Task 2.1 gate rejects everything else).
export default function ParentControls() {
  const { user } = useAuth();
  const { token } = useParentAuth();
  const childId = user && user.id;

  const [limits, setLimits] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [saveMsg, setSaveMsg] = useState('');
  const [savingRow, setSavingRow] = useState(null);   // for per-tile toggles
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [l, a] = await Promise.all([
          api(`/children/${childId}/limits`, { token }),
          api(`/children/${childId}/assignments`, { token })
        ]);
        if (!alive) return;
        setLimits(hydrateLimits(l.limits));
        setAssignments(a.assignments || []);
      } catch (e) {
        setErr(e.message || 'Failed to load controls');
      }
    })();
    return () => { alive = false; };
  }, [childId, token]);

  if (err) return <div style={styles.errorBanner}>{err}</div>;
  if (!limits) return <div style={{ padding: 40, color: 'rgba(255,255,255,0.7)' }}>Loading…</div>;

  const save = async (partial) => {
    setSaveMsg('');
    const next = { ...limits, ...partial };
    setLimits(next);
    try {
      const body = serializeLimits(next);
      const res = await api(`/children/${childId}/limits`, {
        method: 'PUT', token, body
      });
      setLimits(hydrateLimits(res.limits));
      setSaveMsg('Saved ✓');
      setTimeout(() => setSaveMsg(''), 1600);
    } catch (e) {
      setErr(e.message || 'Save failed');
    }
  };

  const toggleUnlock = async (assignment) => {
    setSavingRow(assignment.assignment_id);
    const nextUnlocked = !assignment.unlocked;
    setAssignments((list) => list.map((a) => a.assignment_id === assignment.assignment_id ? { ...a, unlocked: nextUnlocked } : a));
    try {
      await api(`/assignments/${assignment.assignment_id}`, {
        method: 'PUT', token, body: { unlocked: nextUnlocked }
      });
      setSaveMsg('Saved ✓');
      setTimeout(() => setSaveMsg(''), 1400);
    } catch (e) {
      setErr(e.message || 'Save failed');
      // Roll back optimistic update.
      setAssignments((list) => list.map((a) => a.assignment_id === assignment.assignment_id ? { ...a, unlocked: !nextUnlocked } : a));
    } finally {
      setSavingRow(null);
    }
  };

  return (
    <div style={styles.page}>
      <div style={{ position: 'sticky', top: 0, zIndex: 5, background: 'linear-gradient(180deg,#0f3460 90%, rgba(15,52,96,0))', padding: '8px 0' }}>
        {saveMsg && <div style={styles.saveBadge}>{saveMsg}</div>}
      </div>

      <Section title="Pause">
        <PauseToggle paused={limits.paused} onChange={(v) => save({ paused: v })} />
      </Section>

      <Section title="Daily time cap">
        <p style={styles.help}>When the daily limit is reached, games lock until tomorrow.</p>
        <MinuteStepper
          minutes={limits.daily_seconds_cap != null ? Math.round(limits.daily_seconds_cap / 60) : 30}
          min={5} max={120} step={5}
          onChange={(m) => save({ daily_seconds_cap: m * 60 })}
        />
        <div style={styles.subtle}>Current: {formatMin(limits.daily_seconds_cap)}</div>
      </Section>

      <Section title="Max session length">
        <p style={styles.help}>Each game auto-wraps at the cap so kids take breaks.</p>
        <MinuteStepper
          minutes={limits.max_session_seconds != null ? Math.round(limits.max_session_seconds / 60) : 15}
          min={5} max={60} step={5}
          onChange={(m) => save({ max_session_seconds: m * 60 })}
        />
        <div style={styles.subtle}>Current: {formatMin(limits.max_session_seconds)}</div>
      </Section>

      <Section title="Allowed hours">
        <HoursPicker
          value={limits.allowed_hours}
          onChange={(v) => save({ allowed_hours: v })}
        />
      </Section>

      <Section title="Allowed days">
        <DaysPicker
          value={limits.allowed_days}
          onChange={(v) => save({ allowed_days: v })}
        />
      </Section>

      <Section title="Unlock games">
        <p style={styles.help}>Turn a game off to hide it from the hub without deleting it.</p>
        <div style={{ display: 'grid', gap: 10 }}>
          {assignments.map((a) => (
            <div key={a.assignment_id} style={styles.gameRow}>
              <div>
                <div style={{ fontWeight: 700 }}>{a.game.name}</div>
                <div style={styles.subtle}>{a.game.game_type}</div>
              </div>
              <Toggle
                on={!!a.unlocked}
                busy={savingRow === a.assignment_id}
                onToggle={() => toggleUnlock(a)}
              />
            </div>
          ))}
          {assignments.length === 0 && (
            <div style={styles.subtle}>No games assigned yet.</div>
          )}
        </div>
      </Section>
    </div>
  );
}

// ---------- helpers & sub-components ----------

function hydrateLimits(raw) {
  return {
    ...raw,
    // Ensure the primitives are ready to render.
    paused: !!raw.paused,
    allowed_hours: raw.allowed_hours || null,
    allowed_days: raw.allowed_days || null
  };
}
function serializeLimits(l) {
  return {
    daily_seconds_cap: l.daily_seconds_cap,
    max_session_seconds: l.max_session_seconds,
    allowed_hours: l.allowed_hours,
    allowed_days: l.allowed_days,
    paused: l.paused
  };
}
function formatMin(sec) {
  if (sec == null) return 'no limit';
  const m = Math.round(sec / 60);
  return `${m} min`;
}

function Section({ title, children }) {
  return (
    <div style={styles.card}>
      <h3 style={styles.h3}>{title}</h3>
      {children}
    </div>
  );
}

function PauseToggle({ paused, onChange }) {
  return (
    <div
      onClick={() => onChange(!paused)}
      style={{
        cursor: 'pointer', padding: 18, borderRadius: 14,
        background: paused ? '#e17055' : 'rgba(78,205,196,0.15)',
        color: paused ? 'white' : '#4ECDC4',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}
    >
      <div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>
          {paused ? '⏸ Games are paused' : '▶ Games allowed'}
        </div>
        <div style={{ fontSize: 13, marginTop: 4, opacity: 0.9 }}>
          {paused ? 'Tap to allow play' : 'Tap to pause all games now'}
        </div>
      </div>
      <div style={{
        width: 56, height: 32, borderRadius: 999,
        background: paused ? 'rgba(255,255,255,0.35)' : 'rgba(78,205,196,0.35)',
        position: 'relative', flexShrink: 0
      }}>
        <div style={{
          position: 'absolute', top: 3, left: paused ? 28 : 3, width: 26, height: 26,
          borderRadius: '50%', background: 'white', transition: 'left .15s'
        }} />
      </div>
    </div>
  );
}

function MinuteStepper({ minutes, min, max, step, onChange }) {
  const v = Math.max(min, Math.min(max, minutes || min));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <button style={styles.stepper} onClick={() => onChange(Math.max(min, v - step))}>−</button>
      <div style={{ fontSize: 32, fontWeight: 800, minWidth: 90, textAlign: 'center' }}>
        {v}<span style={{ fontSize: 14, opacity: 0.7, marginLeft: 4 }}>min</span>
      </div>
      <button style={styles.stepper} onClick={() => onChange(Math.min(max, v + step))}>+</button>
    </div>
  );
}

function HoursPicker({ value, onChange }) {
  const enabled = !!value;
  const from = (value && value.from) || '07:00';
  const to = (value && value.to) || '20:00';
  return (
    <div>
      <div style={styles.rowBetween}>
        <span>Restrict to a window</span>
        <SmallToggle on={enabled} onToggle={() => onChange(enabled ? null : { from, to })} />
      </div>
      {enabled && (
        <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
          <TimeInput label="From" value={from} onChange={(v) => onChange({ from: v, to })} />
          <TimeInput label="To" value={to} onChange={(v) => onChange({ from, to: v })} />
        </div>
      )}
      {!enabled && <div style={styles.subtle}>Currently: allowed any time.</div>}
    </div>
  );
}
function TimeInput({ label, value, onChange }) {
  return (
    <label style={{ flex: 1 }}>
      <div style={styles.subtle}>{label}</div>
      <input
        type="time" value={value} onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%', padding: '10px 12px', borderRadius: 10,
          background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
          color: 'white', fontSize: 16, fontFamily: 'inherit'
        }}
      />
    </label>
  );
}

const DAYS = [
  { key: 'mon', label: 'Mon' }, { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' }, { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' }, { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' }
];
function DaysPicker({ value, onChange }) {
  const enabled = Array.isArray(value);
  const set = useMemo(() => new Set(enabled ? value : DAYS.map((d) => d.key)), [value, enabled]);

  const toggle = (day) => {
    const next = new Set(set);
    if (next.has(day)) next.delete(day); else next.add(day);
    onChange(Array.from(next));
  };

  return (
    <div>
      <div style={styles.rowBetween}>
        <span>Restrict by day</span>
        <SmallToggle
          on={enabled}
          onToggle={() => onChange(enabled ? null : DAYS.map((d) => d.key))}
        />
      </div>
      {enabled && (
        <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          {DAYS.map((d) => {
            const on = set.has(d.key);
            return (
              <button
                key={d.key}
                onClick={() => toggle(d.key)}
                style={{
                  padding: '10px 12px', borderRadius: 10, border: 0, fontWeight: 700,
                  cursor: 'pointer',
                  background: on ? '#4ECDC4' : 'rgba(255,255,255,0.10)',
                  color: on ? '#0F3460' : 'white'
                }}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      )}
      {!enabled && <div style={styles.subtle}>Currently: allowed every day.</div>}
    </div>
  );
}

function SmallToggle({ on, onToggle }) {
  return (
    <div
      onClick={onToggle}
      style={{
        cursor: 'pointer', width: 46, height: 26, borderRadius: 999,
        background: on ? '#4ECDC4' : 'rgba(255,255,255,0.20)', position: 'relative'
      }}
    >
      <div style={{
        position: 'absolute', top: 3, left: on ? 24 : 3, width: 20, height: 20,
        borderRadius: '50%', background: 'white', transition: 'left .12s'
      }} />
    </div>
  );
}

function Toggle({ on, busy, onToggle }) {
  return (
    <div
      onClick={busy ? undefined : onToggle}
      style={{
        cursor: busy ? 'wait' : 'pointer',
        width: 52, height: 30, borderRadius: 999,
        background: on ? '#4ECDC4' : 'rgba(255,255,255,0.15)',
        position: 'relative', opacity: busy ? 0.6 : 1
      }}
    >
      <div style={{
        position: 'absolute', top: 3, left: on ? 26 : 3, width: 24, height: 24,
        borderRadius: '50%', background: 'white', transition: 'left .12s'
      }} />
    </div>
  );
}

// ---------- styles ----------
const styles = {
  page: { padding: 20, maxWidth: 720, margin: '0 auto', color: 'white' },
  card: { background: '#0F3460', borderRadius: 16, padding: 20, marginBottom: 16 },
  h3: { margin: '0 0 12px', fontSize: 18, color: '#4ECDC4' },
  help: { marginTop: 0, color: 'rgba(255,255,255,0.65)', fontSize: 13 },
  subtle: { color: 'rgba(255,255,255,0.55)', fontSize: 13, marginTop: 6 },
  stepper: {
    width: 54, height: 54, borderRadius: 14, border: 0,
    background: 'rgba(78,205,196,0.15)', color: '#4ECDC4',
    fontSize: 30, fontWeight: 800, cursor: 'pointer'
  },
  saveBadge: {
    position: 'fixed', top: 84, left: '50%', transform: 'translateX(-50%)',
    background: '#4ECDC4', color: '#0F3460', padding: '8px 14px',
    borderRadius: 999, fontWeight: 800, fontSize: 14, zIndex: 20,
    boxShadow: '0 10px 20px rgba(0,0,0,0.3)'
  },
  gameRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: 14, background: 'rgba(255,255,255,0.05)', borderRadius: 12
  },
  rowBetween: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontSize: 15
  },
  errorBanner: {
    background: '#e17055', color: 'white', padding: 12, borderRadius: 10, margin: 20
  }
};
