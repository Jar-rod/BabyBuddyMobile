import { C, TH, ICONS, NOUN, hm, dur, ago, describe } from '../theme.js';
import Icon from '../components/Icon.jsx';
import Segmented from '../components/Segmented.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';
import { whoOptions } from './Home.jsx';

// entries: the selected day's entries, newest first.
// earlier: { 'Kind:Twin': entry } — the newest entry before the day, for "since previous".
export default function Timeline({ who, setWho, names, entries, earlier, label, canNext, onPrev, onNext, loading, error, onRetry, onEdit }) {
  const now = Date.now();
  const rows = entries.map((e, i) => {
    const prev = entries.slice(i + 1).find((x) => x.kind === e.kind && x.twin === e.twin) || earlier[e.kind + ':' + e.twin];
    return {
      e,
      ...describe(e, names),
      since: prev ? dur((e.start - prev.start) / 60000) + ' since previous' : 'First ' + NOUN[e.kind] + ' logged',
    };
  });

  return (
    <>
      <Segmented options={whoOptions(names)} value={who} onPick={setWho} height={44} fontSize={15} style={{ flexShrink: 0 }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <button aria-label="Previous day" onClick={onPrev} style={{ width: 44, height: 44, border: 0, background: 'transparent', color: C.ink, fontSize: 22 }}>‹</button>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{label}</div>
        <button aria-label="Next day" disabled={!canNext} onClick={onNext} style={{ width: 44, height: 44, border: 0, background: 'transparent', color: canNext ? C.ink : C.disabled, fontSize: 22 }}>›</button>
      </div>

      <ErrorBanner text={error} onRetry={onRetry} />

      <div style={{ flexGrow: 1, minHeight: 0, overflowY: 'auto', position: 'relative', opacity: loading ? 0.5 : 1 }}>
        <div style={{ position: 'absolute', left: 19, top: 0, bottom: 0, width: 2, background: C.hair }} />
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 12 }}>
          {rows.map(({ e, title, detail, since }) => (
            <div key={e.kind + e.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 20, background: TH[e.twin].bg, color: C.white, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon d={ICONS[e.kind]} size={20} stroke={2} />
              </div>
              <div style={{ flexGrow: 1, minWidth: 0, padding: '12px 14px', border: `1.5px solid ${C.hair}`, borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
                <div style={{ fontSize: 14, color: C.detail, overflowWrap: 'anywhere' }}>{detail}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 8, marginTop: 4 }}>
                  <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.4 }}>
                    {e.kind === 'Weight' ? 'Logged for this day' : `${ago(e.start, now)} (${hm(e.start)})`}
                    <br />
                    {since}
                  </div>
                  <button onClick={() => onEdit(e)} style={{ height: 36, padding: '0 12px', border: 0, borderRadius: 10, background: C.sand, color: '#1D4459', fontSize: 14, fontWeight: 600 }}>Edit</button>
                </div>
              </div>
            </div>
          ))}
          {!loading && rows.length === 0 && !error && (
            <div style={{ padding: '40px 0 0 52px', fontSize: 15, color: C.muted }}>Nothing logged on this day.</div>
          )}
        </div>
      </div>
    </>
  );
}
