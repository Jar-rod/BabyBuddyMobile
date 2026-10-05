import { pad } from '../theme.js';

const SLOTS = Array.from({ length: 48 }, (_, i) => pad(Math.floor(i / 2)) + ':' + (i % 2 ? '30' : '00'));

// Date picker plus a half-hour dropdown. value / onChange use the "YYYY-MM-DDTHH:mm" form of datetime-local.
// A time that isn't on the half hour (an older entry) gets its own option, so opening and saving it leaves it unchanged.
export default function DateTimeField({ value, onChange, className, style }) {
  const [date = '', time = ''] = (value || '').split('T');
  const times = time && !SLOTS.includes(time) ? [...SLOTS, time].sort() : SLOTS;
  const emit = (d, t) => onChange(d + 'T' + (t || '12:00'));
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 8 }}>
      <input className={className} style={style} type="date" value={date} onChange={(ev) => ev.target.value && emit(ev.target.value, time)} />
      <select className={className} style={style} value={time} onChange={(ev) => emit(date, ev.target.value)}>
        {!time && <option value="" disabled>--:--</option>}
        {times.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
    </div>
  );
}
