import { C } from '../theme.js';
import Icon from '../components/Icon.jsx';

export default function Summary() {
  return (
    <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, textAlign: 'center', color: C.muted }}>
      <div style={{ width: 64, height: 64, borderRadius: 32, background: C.sand, color: C.ink, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon d="M6 20V11M12 20V5M18 20v-6" size={28} stroke={2} />
      </div>
      <div style={{ fontFamily: 'Fraunces, serif', fontSize: 22, fontWeight: 600, color: C.ink }}>Summary coming soon</div>
      <div style={{ fontSize: 15, maxWidth: 280 }}>Weekly charts will live here. For now, use the Timeline to review each day.</div>
    </div>
  );
}
