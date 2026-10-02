import { useState } from 'react';
import { C } from '../theme.js';

const W = 340, H = 210, L = 40, R = 12, T = 12, B = 26;
const MS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmtDay = (ms) => { const d = new Date(ms); return d.getDate() + ' ' + MS[d.getMonth()]; };

// Round the axis maximum up to a tidy step so gridlines land on whole numbers.
function niceTicks(lo, hi, n = 4) {
  const span = hi - lo || 1;
  const raw = span / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const start = Math.floor(lo / step) * step;
  const ticks = [];
  for (let v = start; v < hi + step * 0.999; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

// series: [{ key, label, color, points: [{ x: ms, y: number }] }]
// zero: start the y-axis at 0 (amounts); otherwise fit the data (weight).
export default function LineChart({ series, zero = true, fmt = (v) => v, unit = '', label }) {
  const [sel, setSel] = useState(null); // x (ms) of the selected column

  const pts = series.flatMap((s) => s.points);
  if (!pts.length) return null;
  const xs = [...new Set(pts.map((p) => p.x))].sort((a, b) => a - b);
  const x0 = xs[0], x1 = xs[xs.length - 1];
  const ys = pts.map((p) => p.y);
  let lo = zero ? 0 : Math.min(...ys), hi = Math.max(...ys);
  if (!zero) { const pad = (hi - lo || 1) * 0.15; lo -= pad; hi += pad; }
  const ticks = niceTicks(lo, hi);
  lo = zero ? 0 : ticks[0]; hi = ticks[ticks.length - 1];

  const sx = (x) => (x1 === x0 ? (L + W - R) / 2 : L + ((x - x0) / (x1 - x0)) * (W - L - R));
  const sy = (y) => T + (1 - (y - lo) / (hi - lo || 1)) * (H - T - B);

  const xTicks = xs.length <= 5 ? xs : [0, 1, 2, 3, 4].map((i) => xs[Math.round((i * (xs.length - 1)) / 4)]);

  const pick = (ev) => {
    const r = ev.currentTarget.getBoundingClientRect();
    const vx = ((ev.clientX - r.left) / r.width) * W;
    setSel(xs.reduce((best, x) => (Math.abs(sx(x) - vx) < Math.abs(sx(best) - vx) ? x : best), xs[0]));
  };

  const at = (s, x) => s.points.find((p) => p.x === x);
  const readout = sel != null && series.map((s) => ({ s, p: at(s, sel) })).filter((r) => r.p);

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
        {series.map((s) => (
          <span key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, color: C.ink }}>
            <span style={{ width: 14, height: 3, borderRadius: 2, background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label}
        onPointerDown={pick} onPointerMove={(ev) => ev.buttons && pick(ev)} style={{ touchAction: 'pan-y', display: 'block' }}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={sy(t)} y2={sy(t)} stroke={C.hair} strokeWidth="1" />
            <text x={L - 6} y={sy(t) + 4} textAnchor="end" fontSize="11" fill={C.muted}>{fmt(t)}</text>
          </g>
        ))}
        {xTicks.map((x, i) => (
          <text key={x} x={sx(x)} y={H - 6} textAnchor={i === 0 && xTicks.length > 1 ? 'start' : i === xTicks.length - 1 && xTicks.length > 1 ? 'end' : 'middle'} fontSize="11" fill={C.muted}>{fmtDay(x)}</text>
        ))}
        {sel != null && <line x1={sx(sel)} x2={sx(sel)} y1={T} y2={H - B} stroke={C.line} strokeWidth="1" />}
        {series.map((s) => (
          <g key={s.key}>
            <polyline points={s.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {(s.points.length <= 31 || s.points.some((p) => p.x === sel)) && s.points.map((p) => (
              <circle key={p.x} cx={sx(p.x)} cy={sy(p.y)} r={p.x === sel ? 5 : 3.5} fill={s.color} stroke="#fff" strokeWidth="2" />
            ))}
          </g>
        ))}
      </svg>
      <div style={{ minHeight: 40, marginTop: 6, fontSize: 14, color: C.ink }}>
        {readout ? (
          <>
            <b>{fmtDay(sel)}</b>
            {readout.map(({ s, p }) => <span key={s.key} style={{ marginLeft: 12 }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: s.color, marginRight: 5 }} />{s.label} {fmt(p.y)} {unit}</span>)}
          </>
        ) : <span style={{ color: C.muted }}>Tap the chart to see values.</span>}
      </div>
    </div>
  );
}
