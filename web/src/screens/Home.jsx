import { C, S, TH, ICONS, hm, dur, describe } from '../theme.js';
import Icon from '../components/Icon.jsx';
import Segmented from '../components/Segmented.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';

export function whoOptions(names) {
  return [
    { key: 'A', label: names.A, activeBg: TH.A.bg },
    { key: 'B', label: names.B, activeBg: TH.B.bg },
    { key: 'both', label: 'Both', activeBg: TH.both.bg },
  ];
}

function todayRows(who, latest, names) {
  const get = (t, k) => latest?.[t]?.[k] || null;
  const kgText = (t) => { const w = get(t, 'Weight'); return w ? w.data.kg.toFixed(2) : '—'; };
  if (who === 'both') {
    const at = (t, k) => { const e = get(t, k); return e ? hm(e.start) : '—'; };
    return [
      { k: 'Last feed', v: `${names.A} ${at('A', 'Feeding')} · ${names.B} ${at('B', 'Feeding')}` },
      { k: 'Last sleep', v: ['A', 'B'].map((t) => { const e = get(t, 'Sleep'); return names[t] + ' ' + (e && e.end ? dur((e.end - e.start) / 60000) : '—'); }).join(' · ') },
      { k: 'Last change', v: `${names.A} ${at('A', 'Changes')} · ${names.B} ${at('B', 'Changes')}` },
      { k: 'Weight', v: `${kgText('A')} · ${kgText('B')} kg` },
    ];
  }
  const lf = get(who, 'Feeding'), ls = get(who, 'Sleep'), lc = get(who, 'Changes'), lw = get(who, 'Weight');
  return [
    { k: 'Last feed', v: lf ? hm(lf.start) + ' · ' + (lf.data.type === 'breast' ? 'breast' : lf.data.ml != null ? lf.data.ml + ' ml' : lf.data.label || '') : '—' },
    { k: 'Last sleep', v: ls ? hm(ls.start) + '–' + hm(ls.end) : '—' },
    { k: 'Last change', v: lc ? hm(lc.start) + ' · ' + describe(lc, names).detail.toLowerCase() : '—' },
    { k: 'Weight', v: lw ? lw.data.kg.toFixed(2) + ' kg' : '—' },
  ];
}

const TILES = ['Feeding', 'Pumping', 'Weight', 'Sleep', 'Changes', 'Notes', 'Timeline'];

export default function Home({ who, setWho, names, latest, loading, error, onRetry, onOpen }) {
  const th = TH[who];
  const rows = todayRows(who, latest, names);
  return (
    <>
      <div style={S.group}>
        <div style={S.eyebrow}>Logging for</div>
        <Segmented options={whoOptions(names)} value={who} onPick={setWho} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
        {TILES.map((k) => {
          const wide = k === 'Timeline';
          return (
            <button
              key={k}
              onClick={() => onOpen(k)}
              style={{
                height: wide ? 64 : 100, gridColumn: `span ${wide ? 3 : 1}`, border: 0, borderRadius: 20,
                background: th.tint, color: th.ink, display: 'flex', flexDirection: wide ? 'row' : 'column',
                alignItems: 'center', justifyContent: 'center', gap: 10,
              }}
            >
              <Icon d={ICONS[k]} />
              <span style={{ fontSize: 15, fontWeight: 600 }}>{k}</span>
            </button>
          );
        })}
      </div>

      <ErrorBanner text={error} onRetry={onRetry} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '16px 18px', borderRadius: 20, border: `1.5px solid ${C.line}`, opacity: loading && !latest ? 0.5 : 1 }}>
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
          {who === 'both' ? `${names.A} & ${names.B} today` : `${names[who]} today`}
        </div>
        {rows.map((r, i) => (
          <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '8px 0', borderBottom: i === rows.length - 1 ? 0 : `1px solid ${C.hair}`, fontSize: 15 }}>
            <span style={{ color: C.muted, whiteSpace: 'nowrap' }}>{r.k}</span>
            <span style={{ fontWeight: 600, textAlign: 'right' }}>{r.v}</span>
          </div>
        ))}
      </div>
    </>
  );
}
