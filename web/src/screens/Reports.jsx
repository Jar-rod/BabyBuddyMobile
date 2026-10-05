import { useEffect, useState } from 'react';
import { C, S, TH, sod, dateOnly } from '../theme.js';
import Segmented from '../components/Segmented.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';
import LineChart from '../components/LineChart.jsx';

const KIND_OPTS = [['Feeding', 'Feeding'], ['Changes', 'Diapers'], ['Weight', 'Weight']].map(([k, label]) => ({ key: k, label }));
const RANGES = {
  Feeding: [7, 30, 90],
  Changes: [7, 30, 90],
  Weight: [30, 90, 0], // 0 = all time
};
const rangeLabel = (d) => (d === 0 ? 'All' : d + ' days');

// Daily totals per twin; every day in the range is plotted so gaps show as 0.
function dailyTotals(entries, twin, days, amount) {
  const totals = {};
  for (const e of entries) if (e.twin === twin && amount(e) > 0) { const k = dateOnly(e.start); totals[k] = (totals[k] || 0) + amount(e); }
  const pts = [];
  const d = new Date(sod(Date.now()));
  d.setDate(d.getDate() - (days - 1));
  for (let i = 0; i < days; i++, d.setDate(d.getDate() + 1)) pts.push({ x: d.getTime(), y: totals[dateOnly(d.getTime())] || 0 });
  return pts;
}

export default function Reports({ api, names }) {
  const [kind, setKind] = useState('Feeding');
  const [days, setDays] = useState(7);
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  const pickKind = (k) => { setKind(k); setDays(RANGES[k][0]); setEntries(null); };

  useEffect(() => {
    let live = true;
    setError(null);
    const from = days === 0 ? 0 : (() => { const d = new Date(sod(Date.now())); d.setDate(d.getDate() - (days - 1)); return d.getTime(); })();
    api.rangeOf(kind, from, Date.now() + 86400000)
      .then((rs) => { if (live) setEntries(rs); })
      .catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [api, kind, days, tick]);

  // Feeding/pumping chart ml; diaper changes chart how many there were.
  const amount = kind === 'Changes' ? () => 1 : (e) => e.data.ml;
  const twins = ['A', 'B'].filter((t) => names[t]);
  const isWeight = kind === 'Weight';
  const series = entries && twins.map((t) => ({
    key: t, label: names[t], color: TH[t].bg,
    points: isWeight
      ? entries.filter((e) => e.twin === t).sort((a, b) => a.start - b.start).map((e) => ({ x: e.start, y: e.data.kg }))
      : dailyTotals(entries, t, days, amount),
  }));
  const hasData = series && series.some((s) => s.points.some((p) => p.y > 0));

  const summary = (s) => {
    if (isWeight) { const last = s.points[s.points.length - 1]; return last ? last.y.toFixed(2) + ' kg latest' : '—'; }
    const active = s.points.filter((p) => p.y > 0);
    return active.length ? (kind === 'Changes' ? Math.round(active.reduce((a, p) => a + p.y, 0) / active.length * 10) / 10 + ' changes/day avg' : Math.round(active.reduce((a, p) => a + p.y, 0) / active.length) + ' ml/day avg') : '—';
  };

  return (
    <div style={{ flexGrow: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <Segmented options={KIND_OPTS} value={kind} onPick={pickKind} />
      <Segmented
        options={RANGES[kind].map((d) => ({ key: d, label: rangeLabel(d) }))}
        value={days} onPick={(d) => { setDays(d); setEntries(null); }} height={40} fontSize={14}
      />
      <div style={S.eyebrow}>{{ Weight: 'Weight (kg)', Feeding: 'Daily feeding total (ml)', Pumping: 'Daily pumping total (ml)', Changes: 'Diaper changes per day' }[kind]}</div>

      {error ? <ErrorBanner text={error} onRetry={() => setTick(tick + 1)} />
        : !entries ? <div style={{ color: C.muted, fontSize: 15, textAlign: 'center', paddingTop: 30 }}>Loading…</div>
        : !hasData ? <div style={{ color: C.muted, fontSize: 15, textAlign: 'center', paddingTop: 30 }}>No data in this range.</div>
        : (
          <>
            <LineChart
              series={series} zero={!isWeight} unit={isWeight ? 'kg' : kind === 'Changes' ? 'changes' : 'ml'} fmt={isWeight ? (v) => (Math.round(v * 100) / 100).toFixed(2) : (v) => Math.round(v)}
              label={`${kind} history for ${twins.map((t) => names[t]).join(' and ')}`}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 15 }}>
              {series.map((s) => (
                <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: C.muted }}>{s.label}</span><span style={{ fontWeight: 600 }}>{summary(s)}</span>
                </div>
              ))}
              {!isWeight && <div style={{ fontSize: 13, color: C.muted }}>Averages count days with entries.{kind === 'Feeding' && " Breast feeds have no amount and aren't included."}</div>}
            </div>
          </>
        )}
    </div>
  );
}
