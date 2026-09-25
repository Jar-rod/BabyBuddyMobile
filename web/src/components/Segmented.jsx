import { C, S } from '../theme.js';

// Pill track with one selected option (child picker, breast side, …).
// options: [{ key, label, activeBg }]
export default function Segmented({ options, value, onPick, height = 48, fontSize = 16, style }) {
  return (
    <div role="radiogroup" style={{ ...S.track, gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`, ...style }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button
            key={o.key}
            role="radio"
            aria-checked={on}
            onClick={() => onPick(o.key)}
            style={{ height, border: 0, borderRadius: 10, background: on ? o.activeBg || C.ink : 'transparent', color: on ? C.white : C.ink, fontSize, fontWeight: 600 }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
