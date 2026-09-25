import { C } from '../theme.js';
import Icon from './Icon.jsx';

const TABS = [
  { key: 'home', label: 'Home', d: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z' },
  { key: 'Timeline', label: 'Timeline', d: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01' },
  { key: 'Summary', label: 'Summary', d: 'M6 20V11M12 20V5M18 20v-6' },
];

export default function BottomNav({ screen, onGo }) {
  // Entry forms belong to Home.
  const active = screen === 'Timeline' || screen === 'Summary' ? screen : 'home';
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
