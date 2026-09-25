// Design tokens and formatting helpers ported from HomeTwinFirst.dc.html.

export const C = {
  ink: '#1E2328',
  muted: '#5E646B',
  sand: '#F1EEE9',
  line: '#DDD6CC',
  hair: '#ECE7E0',
  detail: '#33404A',
  disabled: '#B7B2AA',
  errBg: '#FBEAE5',
  errFg: '#8A2E12',
  white: '#FFFFFF',
};

export const TH = {
  A: { bg: '#2B5F7A', tint: '#E3EEF3', ink: '#1D4459' },
  B: { bg: '#A94E1B', tint: '#F7E4D6', ink: '#7E3A12' },
  both: { bg: '#1E2328', tint: '#F1EEE9', ink: '#1E2328' },
};

export const ICONS = {
  Feeding: 'M9 2h6M10 2v3L8 8v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V8l-2-3V2M8 13h8',
  Pumping: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
  Weight: 'M6 4h12a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3zM8 11a4 4 0 0 1 8 0M12 11l2-2.5',
  Sleep: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z',
  Changes: 'M3 7h18v3a9 9 0 0 1-18 0V7zM8 7v3M16 7v3',
  Notes: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5',
  Timeline: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
};

export const SW = { black: '#1E2328', brown: '#7A4B2A', green: '#5B7A3A', yellow: '#D9B23A' };

export const NOUN = { Feeding: 'feeding', Pumping: 'pumping', Weight: 'weight', Sleep: 'sleep', Changes: 'diaper change', Notes: 'note' };
export const TITLES = { Feeding: 'Add a feeding', Pumping: 'Add pumping', Weight: 'Add a weight', Sleep: 'Add sleep', Changes: 'Add a diaper change', Notes: 'Add a note', Timeline: 'Timeline', History: 'History' };
export const EDIT_TITLES = { Feeding: 'Edit feeding', Pumping: 'Edit pumping', Weight: 'Edit weight', Sleep: 'Edit sleep', Changes: 'Edit diaper change', Notes: 'Edit note' };

// Shared inline styles.
export const S = {
  eyebrow: { fontSize: 13, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.muted },
  labelBlock: { display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.muted },
  input: { height: 48, boxSizing: 'border-box', width: '100%', padding: '0 12px', border: `1.5px solid ${C.line}`, borderRadius: 14, fontSize: 16, color: C.ink, background: C.white, textTransform: 'none', letterSpacing: 0, fontWeight: 400 },
  track: { display: 'grid', gap: 6, padding: 4, background: C.sand, borderRadius: 14 },
  group: { display: 'flex', flexDirection: 'column', gap: 10 },
};

// ---- Formatting ------------------------------------------------------------

const MS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const pad = (x) => String(x).padStart(2, '0');
export const hm = (ms) => { const d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
export const local = (ms) => { const d = new Date(ms); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
export const dateOnly = (ms) => local(ms).slice(0, 10);
export const parse = (str) => { const t = new Date(str).getTime(); return isNaN(t) ? null : t; };
export const dur = (mins) => {
  mins = Math.round(mins);
  if (mins < 60) return mins + ' min';
  if (mins < 1440) return Math.floor(mins / 60) + 'h ' + pad(mins % 60) + 'm';
  return Math.floor(mins / 1440) + 'd ' + Math.floor((mins % 1440) / 60) + 'h';
};
export const sod = (ms) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const dayLabel = (off, dayStart) => {
  const d = new Date(dayStart);
  return off === 0 ? 'Today' : off === 1 ? 'Yesterday' : DN[d.getDay()] + ' ' + d.getDate() + ' ' + MS[d.getMonth()];
};

export const ago = (ms, now = Date.now()) => {
  const mins = Math.max(0, Math.round((now - ms) / 60000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return mins + ' min ago';
  if (mins < 1440) return Math.floor(mins / 60) + 'h ' + pad(mins % 60) + 'm ago';
  return Math.floor(mins / 1440) + ' days ago';
};

const SIDE = { L: 'left side', R: 'right side', B: 'both sides' };
const mlText = (ml) => (ml == null ? '' : ml + ' ml · ');

// Human description of one entry: { title, detail }.
export function describe(e, names) {
  const n = names[e.twin] || '';
  const d = e.data;
  const mins = e.end ? (e.end - e.start) / 60000 : 0;
  if (e.kind === 'Feeding') {
    if (d.type === 'breast') return { title: n + ' had a feeding.', detail: 'Breast · ' + SIDE[d.side] + ' · ' + dur(mins) };
    const label = d.type === 'formula' ? 'Formula' : d.type === 'expressed' ? 'Expressed milk' : d.label.charAt(0).toUpperCase() + d.label.slice(1);
    return { title: n + ' had a feeding.', detail: label + ' · ' + mlText(d.ml) + dur(mins) };
  }
  if (e.kind === 'Pumping') return { title: 'Pumped for ' + n + '.', detail: mlText(d.ml) + dur(mins) };
  if (e.kind === 'Weight') return { title: n + ' was weighed.', detail: d.kg.toFixed(2) + ' kg' };
  if (e.kind === 'Sleep') return { title: n + (d.nap ? ' had a nap.' : ' slept.'), detail: hm(e.start) + '–' + hm(e.end) + ' · ' + dur(mins) };
  if (e.kind === 'Changes') {
    const c = [d.wet ? 'Wet' : '', d.solid ? 'solid' : ''].filter(Boolean).join(' + ') || 'Dry';
    return { title: n + ' had a diaper change.', detail: c.charAt(0).toUpperCase() + c.slice(1) + (d.color ? ' · ' + d.color : '') + (d.amount ? ' · ' + d.amount : '') };
  }
  return { title: 'Note about ' + n + '.', detail: d.note };
}
