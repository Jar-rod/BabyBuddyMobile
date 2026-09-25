import { C } from '../theme.js';

// Outlined toggle button that fills with `activeBg` when on.
export default function Chip({ on, activeBg = C.ink, onClick, style, children }) {
  return (
    <button
      aria-pressed={on}
      onClick={onClick}
      style={{
        height: 44, padding: '0 18px', border: `1.5px solid ${on ? activeBg : C.line}`, borderRadius: 22,
        background: on ? activeBg : C.white, color: on ? C.white : C.ink, fontSize: 15, fontWeight: 600, ...style,
      }}
    >
      {children}
    </button>
  );
}
