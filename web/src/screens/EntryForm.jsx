import { C, S, TH, parse, dur, clamp, feedEnd } from '../theme.js';
import Segmented from '../components/Segmented.jsx';
import Chip from '../components/Chip.jsx';
import DateTimeField from '../components/DateTimeField.jsx';
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
  // New feedings pick breast and/or one bottle type; editing keeps the single `type` of the stored entry.
  const multi = kind === 'Feeding' && f.breast !== undefined;
  const kids = f.child === 'both' ? ['A', 'B'] : [f.child];
  if (multi) {
    // Feeding both children takes a type and amount each (fields suffixed A / B), saved as separate entries.
    const each = f.child === 'both';
    const list = [];
    for (const k of each ? kids : ['']) {
      const breast = f['breast' + k], bottle = f['bottle' + k], ml = f['ml' + k];
      if (!breast && !bottle) return { error: 'Choose breast, formula or expressed milk' + (each ? ' for each child.' : '.') };
      if (bottle && !(ml > 0)) return { error: 'Amount must be more than 0 ml.' };
      // Breast first; a bottle in the same sitting follows it so the two entries don't overlap.
      const bottleStart = breast ? pe : ps;
      const only = each && { kids: [k] };
      if (breast) list.push({ start: ps, end: pe, date: f.date, data: { type: 'breast', side: f.side }, ...only });
      if (bottle) list.push({ start: bottleStart, end: bottleStart + (pe - ps), date: f.date, data: { type: bottle, ml }, ...only });
    }
    return { list, values: list[0], kids };
  }
  const needsMl = kind === 'Feeding' && f.type !== 'breast';
  if ((kind === 'Pumping' || needsMl) && !(f.ml > 0)) return { error: 'Amount must be more than 0 ml.' };

  let data;
  if (kind === 'Feeding') {
    if (f.type === 'breast') data = { type: 'breast', side: f.side };
    else if (f.type === 'other') data = { type: 'other', label: f.label, method: f.method, ml: f.ml };
    else data = { type: f.type, ml: f.ml };
  }
  if (kind === 'Pumping') data = { ml: f.ml };
  if (kind === 'Weight') data = { kg: f.kg };
  if (kind === 'Sleep') data = { nap: !!f.nap };
  if (kind === 'Changes') data = { wet: !!f.wet, solid: !!f.solid };
  if (kind === 'Notes') data = { note: f.note.trim() };
  const values = { start: ps, end: timed ? pe : null, date: f.date, data };
  return { values, list: [values], kids };
}

export default function EntryForm({ kind, form: f, setForm, editing, names, lastKg, lastMl, lastFeed, error, saving, onSave, onRemove }) {
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
  const multi = kind === 'Feeding' && !editing;
  const showBreast = kind === 'Feeding' && (multi ? f.breast : f.type === 'breast');
  const perKid = multi && fc === 'both' ? ['A', 'B'] : ['']; // one type and amount per child when feeding both
  const mlKeys = multi ? perKid.filter((k) => f['bottle' + k]) : [''];
  const showMl = kind === 'Pumping' || (kind === 'Feeding' && (multi ? mlKeys.length > 0 : f.type !== 'breast'));
  const showStart = kind !== 'Weight';
  const showEnd = timed && kind !== 'Feeding'; // feedings end 30 minutes after the start

  return (
    <>
      <div style={{ flexGrow: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={S.group}>
          <div style={S.eyebrow}>Child</div>
          <Segmented
            options={childOpts}
            value={fc}
            onPick={(k) => setForm(
              kind === 'Weight' ? { child: k, kg: lastKg(k) }
                : kind === 'Feeding' && !editing && k !== 'both' ? { child: k, ml: lastMl(kind, k), ...lastFeed(k) }
                  : kind === 'Pumping' && !editing && k !== 'both' ? { child: k, ml: lastMl(kind, k) }
                  : { child: k },
            )}
          />
        </div>

        {kind === 'Feeding' && (
          <>
            {perKid.map((c) => (
              <div key={c} style={S.group}>
                <div style={S.eyebrow}>{c ? `Type · ${names[c]}` : 'Type'}</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {/* Entries made in Baby Buddy with other types (e.g. solid food) keep their type when edited. */}
                  {[['breast', 'Breast'], ['formula', 'Formula'], ['expressed', 'Expressed milk'], ...(f.label ? [['other', f.label.charAt(0).toUpperCase() + f.label.slice(1)]] : [])].map(([k, label]) => (
                    <Chip
                      key={k}
                      on={multi ? (k === 'breast' ? !!f['breast' + c] : f['bottle' + c] === k) : f.type === k}
                      activeBg={c ? TH[c].bg : undefined}
                      onClick={() => setForm(!multi ? { type: k } : k === 'breast' ? { ['breast' + c]: !f['breast' + c] } : { ['bottle' + c]: f['bottle' + c] === k ? '' : k })}
                    >
                      {label}
                    </Chip>
                  ))}
                </div>
              </div>
            ))}
            {showBreast && !multi && (
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
            {mlKeys.map((k) => {
              const field = 'ml' + k;
              return (
                <div key={field} style={S.group}>
                  <div style={S.eyebrow}>{k ? `Amount · ${names[k]}` : 'Amount'}</div>
                  <Stepper
                    value={f[field]}
                    unit="ml"
                    onDown={() => setForm({ [field]: clamp((f[field] || 0) - 1, 0, 400) })}
                    onUp={() => setForm({ [field]: clamp((f[field] || 0) + 1, 0, 400) })}
                  />
                </div>
              );
            })}
            {kind === 'Pumping' && (
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
            )}
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
            <DateTimeField value={f.start} onChange={(v) => setForm(kind === 'Feeding' ? { start: v, end: feedEnd(v) } : { start: v })} style={S.input} />
          </label>
        )}
        {showEnd && (
          <>
            <label style={S.labelBlock}>
              End time
              <DateTimeField value={f.end} onChange={(v) => setForm({ end: v })} style={S.input} />
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

        {kind === 'Feeding' && !editing && (
          <div style={S.group}>
            <div style={S.eyebrow}>Also log a change</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
              {[['wet', 'Wet'], ['solid', 'Solid']].map(([k, label]) => (
                <Chip key={k} on={f.alsoChange === k} activeBg={fth.bg} onClick={() => setForm({ alsoChange: f.alsoChange === k ? '' : k })}>
                  {label}
                </Chip>
              ))}
            </div>
          </div>
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
