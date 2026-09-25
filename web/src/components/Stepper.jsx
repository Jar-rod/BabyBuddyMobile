import { C } from '../theme.js';

const btn = { width: 48, height: 48, border: 0, borderRadius: 14, background: C.sand, fontSize: 24, color: C.ink };

export default function Stepper({ value, unit, onDown, onUp }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 8, border: `1.5px solid ${C.line}`, borderRadius: 18 }}>
      <button aria-label="Less" onClick={onDown} style={btn}>−</button>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontFamily: 'Fraunces, serif', fontSize: 38, fontWeight: 600 }}>{value}</span>
        <span style={{ fontSize: 16, color: C.muted }}>{unit}</span>
      </div>
      <button aria-label="More" onClick={onUp} style={btn}>+</button>
    </div>
  );
}
