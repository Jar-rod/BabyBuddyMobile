import { C, S, TH, SW, parse, dur, clamp } from '../theme.js';
import Segmented from '../components/Segmented.jsx';
import Chip from '../components/Chip.jsx';
import Stepper from '../components/Stepper.jsx';
import ErrorBanner from '../components/ErrorBanner.jsx';

const TIMED = ['Feeding', 'Pumping', 'Sleep'];

// Checks the form and converts it to { values, kids } for the API layer, or returns { error }.
export function validate(kind, f) {
  const ps = parse(f.start), pe = parse(f.end);
  const timed = TIMED.includes(kind);
  if (timed && (!ps || !pe)) return { error: 'Please enter a start and end time.' };
  if (timed && pe < ps) return { error: 'End time must be after the start time.' };
  if (kind === 'Changes' && !f.wet && !f.solid) return { error: 'Choose wet, solid or both.' };
  if (kind === 'Notes' && !(f.note || '').trim()) return { error: 'Write a note first.' };
  if ((kind === 'Changes' || kind === 'Notes') && !ps) return { error: 'Please enter a time.' };
  if (kind === 'Weight' && !f.date) return { error: 'Please enter a date.' };
  if (kind === 'Changes' && f.amount && isNaN(parseFloat(f.amount))) return { error: 'Amount must be a number.' };
  if ((kind === 'Pumping' || (kind === 'Feeding' && f.type !== 'breast')) && !(f.ml > 0)) return { error: 'Amount must be more than 0 ml.' };

  let data;
  if (kind === 'Feeding') {
    if (f.type === 'breast') data = { type: 'breast', side: f.side };
    else if (f.type === 'other') data = { type: 'other', label: f.label, method: f.method, ml: f.ml };
    else data = { type: f.type, ml: f.ml };
  }
  if (kind === 'Pumping') data = { ml: f.ml };
  if (kind === 'Weight') data = { kg: f.kg };
  if (kind === 'Sleep') data = { nap: !!f.nap };
  if (kind === 'Changes') data = { wet: !!f.wet, solid: !!f.solid, color: f.color, amount: (f.amount || '').trim() };
  if (kind === 'Notes') data = { note: f.note.trim() };
  return {
    values: { start: ps, end: timed ? pe : null, date: f.date, data },
    kids: f.child === 'both' ? ['A', 'B'] : [f.child],
  };
}

export default function EntryForm({ kind, form: f, setForm, editing, names, lastKg, error, saving, onSave, onRemove }) {
  const fc = f.child || 'A';
  const fth = TH[fc] || TH.A;
  const childKeys = kind === 'Weight' || editing ? ['A', 'B'] : ['A', 'B', 'both'];
  const childOpts = childKeys.map((k) => ({ key: k, label: k === 'both' ? 'Both' : names[k], activeBg: TH[k].bg }));

  const timed = TIMED.includes(kind);
  const ps = parse(f.start), pe = parse(f.end);
  let durText = '', durColor = C.muted;
  if (timed && ps && pe) {
    if (pe < ps) { durText = 'End time is before the start time'; durColor = C.errFg; }
    else durText = 'Duration ' + dur((pe - ps) / 60000);
  }
  const showMl = kind === 'Pumping' || (kind === 'Feeding' && f.type !== 'breast');
  const showStart = kind !== 'Weight';

  return (
    <>
      <div style={{ flexGrow: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={S.group}>
          <div style={S.eyebrow}>Child</div>
          <Segmented
            options={childOpts}
            value={fc}
            onPick={(k) => setForm(kind === 'Weight' ? { child: k, kg: lastKg(k) } : { child: k })}
          />
        </div>

        {kind === 'Feeding' && (
          <>
            <div style={S.group}>
              <div style={S.eyebrow}>Type</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {/* Entries made in Baby Buddy with other types (e.g. solid food) keep their type when edited. */}
                {[['breast', 'Breast'], ['formula', 'Formula'], ['expressed', 'Expressed milk'], ...(f.label ? [['other', f.label.charAt(0).toUpperCase() + f.label.slice(1)]] : [])].map(([k, label]) => (
                  <Chip key={k} on={f.type === k} onClick={() => setForm({ type: k })}>{label}</Chip>
                ))}
              </div>
            </div>
            {f.type === 'breast' && (
              <div style={S.group}>
                <div style={S.eyebrow}>Side</div>
                <Segmented
                  options={[{ key: 'L', label: 'Left' }, { key: 'R', label: 'Right' }, { key: 'B', label: 'Both' }]}
                  value={f.side}
                  onPick={(k) => setForm({ side: k })}
                  height={44}
                  fontSize={15}
                />
              </div>
            )}
          </>
        )}

        {showMl && (
          <div style={S.group}>
            <div style={S.eyebrow}>Amount</div>
            <Stepper
              value={f.ml}
              unit="ml"
              onDown={() => setForm({ ml: clamp((f.ml || 0) - 10, 0, 400) })}
              onUp={() => setForm({ ml: clamp((f.ml || 0) + 10, 0, 400) })}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
              {[60, 90, 120, 150].map((v) => (
                <button
                  key={v}
                  onClick={() => setForm({ ml: v })}
                  style={{ height: 44, border: 0, borderRadius: 12, background: f.ml === v ? fth.tint : C.sand, color: f.ml === v ? fth.ink : C.ink, fontSize: 15, fontWeight: 600 }}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        )}

        {kind === 'Weight' && (
          <>
            <div style={S.group}>
              <div style={S.eyebrow}>Weight</div>
              <Stepper
                value={f.kg ? f.kg.toFixed(2) : '—'}
                unit="kg"
                onDown={() => setForm({ kg: Math.max(0.5, Math.round(((f.kg || 0) - 0.05) * 100) / 100) })}
                onUp={() => setForm({ kg: Math.round(((f.kg || 0) + 0.05) * 100) / 100 })}
              />
              <div style={{ fontSize: 14, color: C.muted }}>Last recorded: {lastKg(fc).toFixed(2)} kg · steps of 50 g</div>
            </div>
            <label style={S.labelBlock}>
              Date
              <input type="date" value={f.date || ''} onChange={(ev) => setForm({ date: ev.target.value })} style={S.input} />
            </label>
          </>
        )}

        {showStart && (
          <label style={S.labelBlock}>
            {timed ? 'Start time' : 'Time'}
            <input type="datetime-local" value={f.start || ''} onChange={(ev) => setForm({ start: ev.target.value })} style={S.input} />
          </label>
        )}
        {timed && (
          <>
            <label style={S.labelBlock}>
              End time
              <input type="datetime-local" value={f.end || ''} onChange={(ev) => setForm({ end: ev.target.value })} style={S.input} />
            </label>
            <div style={{ fontSize: 14, color: durColor, marginTop: -10 }}>{durText}</div>
          </>
        )}

        {kind === 'Sleep' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={S.eyebrow}>Nap</div>
            <Chip on={!!f.nap} activeBg={fth.bg} onClick={() => setForm({ nap: !f.nap })} style={{ padding: '0 20px' }}>
              {f.nap ? 'Nap ✓' : 'Nap'}
            </Chip>
          </div>
        )}

        {kind === 'Changes' && (
          <>
            <div style={S.group}>
              <div style={S.eyebrow}>Contents</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                {[['wet', 'Wet'], ['solid', 'Solid']].map(([k, label]) => (
                  <Chip key={k} on={!!f[k]} activeBg={fth.bg} onClick={() => setForm({ [k]: !f[k] })} style={{ height: 52, borderRadius: 16, fontSize: 16 }}>
                    {label}
                  </Chip>
                ))}
              </div>
            </div>
            <div style={S.group}>
              <div style={S.eyebrow}>Colour</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
                {Object.keys(SW).map((c) => (
                  <button
                    key={c}
                    aria-pressed={f.color === c}
                    onClick={() => setForm({ color: f.color === c ? '' : c })}
                    style={{ height: 64, border: `1.5px solid ${f.color === c ? C.ink : C.line}`, borderRadius: 14, background: f.color === c ? C.sand : C.white, color: C.ink, fontSize: 13, fontWeight: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    <span style={{ width: 18, height: 18, borderRadius: 9, background: SW[c] }} />
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <label style={S.labelBlock}>
              Amount (optional)
              <input type="text" inputMode="decimal" value={f.amount || ''} onChange={(ev) => setForm({ amount: ev.target.value })} placeholder="e.g. 20" style={S.input} />
            </label>
          </>
        )}

        {kind === 'Notes' && (
          <label style={S.labelBlock}>
            Note
            <textarea
              rows={5}
              value={f.note || ''}
              onChange={(ev) => setForm({ note: ev.target.value })}
              placeholder="Rash on cheek, extra fussy, first smile…"
              style={{ ...S.input, height: 'auto', padding: 14, borderRadius: 16, resize: 'none' }}
            />
          </label>
        )}

        <ErrorBanner text={error} />
      </div>

      <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
        {editing && (
          <button disabled={saving} onClick={onRemove} style={{ height: 58, padding: '0 18px', border: `1.5px solid ${C.line}`, borderRadius: 18, background: C.white, color: C.errFg, fontSize: 16, fontWeight: 600 }}>
            Delete
          </button>
        )}
        <button
          disabled={saving}
          onClick={onSave}
          style={{ flexGrow: 1, height: 58, border: 0, borderRadius: 18, background: fth.bg, color: C.white, fontSize: 17, fontWeight: 600, opacity: saving ? 0.6 : 1 }}
        >
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Save'}
        </button>
      </div>
    </>
  );
}
