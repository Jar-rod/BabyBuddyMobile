import { C } from '../theme.js';
import Icon from './Icon.jsx';

const TABS = [
  { key: 'home', label: 'Home', d: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z' },
  { key: 'Timeline', label: 'Timeline', d: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01' },
  { key: 'History', label: 'History', d: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2' },
];

export default function BottomNav({ screen, onGo }) {
  // Entry forms belong to Home.
  const active = screen === 'Timeline' || screen === 'History' ? screen : 'home';
  return (
    <nav className="bottom-nav">
      {TABS.map((t) => {
        const on = t.key === active;
        return (
          <button
            key={t.key}
            aria-current={on ? 'page' : undefined}
            onClick={() => onGo(t.key)}
            style={{ height: 56, border: 0, background: 'transparent', fontSize: 12, fontWeight: on ? 600 : 500, color: on ? C.ink : C.muted, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}
          >
            <Icon d={t.d} size={22} stroke={2} />
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
