import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ICONS, SW, hm, local, dateOnly, dur, sod, clamp } from '../theme.js';
import Icon from '../components/Icon.jsx';
import { KINDS } from '../api.js';
import { validate } from './EntryForm.jsx';
import './History.css';

// Design: history_1.html. Browses the last 30 days of Baby Buddy entries with day,
// child and type filters; tapping a row opens a sheet to view, edit or delete it.

const DAY = 86400000;
const DAYS_IN_STRIP = 30;
const LABEL = { Feeding: 'Feeding', Pumping: 'Pumping', Weight: 'Weight', Sleep: 'Sleep', Changes: 'Diaper', Notes: 'Note' };
const DN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SIDE = { L: 'Left', R: 'Right', B: 'Both' };
const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

const relDay = (ms) => {
  const diff = Math.round((sod(Date.now()) - sod(ms)) / DAY);
  const d = new Date(ms);
  return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : `${DN[d.getDay()]} ${d.getDate()} ${MS[d.getMonth()]}`;
};

// Title, one-line detail, and the key/value rows shown in the sheet.
function describe(e, names) {
  const d = e.data, n = names[e.twin], mins = e.end ? (e.end - e.start) / 60000 : 0;
  const when = e.kind === 'Weight' ? relDay(e.start) : relDay(e.start) + ' · ' + hm(e.start) + (e.end ? '–' + hm(e.end) : '');
  const rows = [['Child', n], ['When', when]];
  let title, detail;
  if (e.kind === 'Feeding') {
    title = n + ' had a feeding';
    if (d.type === 'breast') {
      detail = `Breast · ${SIDE[d.side].toLowerCase()} side · ${dur(mins)}`;
      rows.push(['Type', 'Breast'], ['Side', SIDE[d.side]]);
    } else {
      const t = d.type === 'formula' ? 'Formula' : d.type === 'expressed' ? 'Expressed milk' : cap(d.label);
      detail = t + (d.ml != null ? ` · ${d.ml} ml` : '');
      rows.push(['Type', t]);
      if (d.ml != null) rows.push(['Amount', d.ml + ' ml']);
    }
    rows.push(['Duration', dur(mins)]);
  } else if (e.kind === 'Pumping') {
    title = 'Pumped for ' + n; detail = `${d.ml} ml · ${dur(mins)}`;
    rows.push(['Amount', d.ml + ' ml'], ['Duration', dur(mins)]);
  } else if (e.kind === 'Weight') {
    title = n + ' was weighed'; detail = d.kg.toFixed(2) + ' kg';
    rows.push(['Weight', detail]);
  } else if (e.kind === 'Sleep') {
    title = n + (d.nap ? ' had a nap' : ' slept'); detail = `${hm(e.start)}–${hm(e.end)} · ${dur(mins)}`;
    rows.push(['Duration', dur(mins)], ['Nap', d.nap ? 'Yes' : 'No']);
  } else if (e.kind === 'Changes') {
    const c = cap([d.wet ? 'wet' : '', d.solid ? 'solid' : ''].filter(Boolean).join(' + ')) || 'Dry';
    title = n + ' had a diaper change'; detail = c + (d.color ? ' · ' + d.color : '');
    rows.push(['Contents', c]);
    if (d.color) rows.push(['Colour', cap(d.color)]);
    if (d.amount) rows.push(['Amount', d.amount]);
  } else {
    title = 'Note about ' + n; detail = d.note;
    rows.push(['Note', d.note]);
  }
  return { title, detail, rows };
}

// What api.create needs to put a deleted entry back.
const valuesOf = (e) => ({ start: e.start, end: e.end, date: dateOnly(e.start), data: e.data });

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
);

export default function History({ api, names }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [daySel, setDaySel] = useState(null); // null = all days, else days back from today
  const [child, setChild] = useState('both');
  const [kind, setKind] = useState('all');
  const [sheet, setSheet] = useState(null); // { mode: 'view' | 'edit' | 'confirm', key }
  const [draft, setDraftState] = useState({});
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null); // { text, undo? }
  const toastTimer = useRef();
  const stripRef = useRef();
  const stripScrolled = useRef(false);

  const today = sod(Date.now());
  const from = today - (DAYS_IN_STRIP - 1) * DAY;
  const keyOf = (e) => e.kind + ':' + e.id;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const to = sod(Date.now() + DAY + 3600000); // start of tomorrow, DST-safe
      setEntries((await api.range(sod(Date.now()) - (DAYS_IN_STRIP - 1) * DAY, to)).sort((a, b) => b.start - a.start));
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }, [api]);
  useEffect(() => { load(); }, [load]);

  // Start the date strip scrolled to today (the right-hand end).
  useLayoutEffect(() => {
    if (!stripScrolled.current && stripRef.current) {
      stripRef.current.scrollLeft = stripRef.current.scrollWidth;
      stripScrolled.current = true;
    }
  });

  const flash = (text, undo) => {
    clearTimeout(toastTimer.current);
    setToast({ text, undo });
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  };

  const closeSheet = useCallback(() => { setSheet(null); setErr(null); }, []);
  useEffect(() => {
    const onKey = (ev) => ev.key === 'Escape' && closeSheet();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [closeSheet]);

  // ---- Filtering -----------------------------------------------------------
  const matches = (e) => (kind === 'all' || e.kind === kind) && (child === 'both' || e.twin === child);
  const hasDay = new Set(entries.filter(matches).map((e) => sod(e.start)));
  let list = entries.filter(matches);
  if (daySel !== null) {
    const st = today - daySel * DAY;
    list = list.filter((e) => sod(e.start) === sod(st));
  }
  const groups = [];
  for (const e of list) {
    const label = relDay(e.start);
    if (!groups.length || groups[groups.length - 1].label !== label) groups.push({ label, items: [] });
    groups[groups.length - 1].items.push(e);
  }

  // ---- Sheet actions -------------------------------------------------------
  const cur = sheet ? entries.find((e) => keyOf(e) === sheet.key) : null;
  const setDraft = (patch) => { setDraftState((d) => ({ ...d, ...patch })); setErr(null); };

  const startEdit = () => {
    setDraftState({
      child: cur.twin, start: local(cur.start), end: cur.end ? local(cur.end) : '', date: dateOnly(cur.start),
      type: 'formula', ml: 90, side: 'L', kg: 3, nap: false, wet: false, solid: false, color: '', amount: '', note: '',
      ...cur.data,
    });
    setErr(null);
    setSheet({ ...sheet, mode: 'edit' });
  };

  const save = async () => {
    const res = validate(cur.kind, draft);
    if (res.error) return setErr(res.error);
    setBusy(true);
    try {
      await api.update(cur.kind, cur.id, res.kids[0], res.values);
      await load();
      setSheet({ ...sheet, mode: 'view' });
      flash('Changes saved');
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    const e = cur;
    setBusy(true);
    try {
      await api.remove(e.kind, e.id);
      setEntries((list) => list.filter((x) => keyOf(x) !== keyOf(e)));
      closeSheet();
      flash('Entry deleted', e);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  // Baby Buddy has no restore, so undo re-creates the entry (it gets a new id).
  const undo = async () => {
    const e = toast?.undo;
    setToast(null);
    if (!e) return;
    try {
      await api.create(e.kind, [e.twin], valuesOf(e));
      await load();
    } catch (ex) {
      flash('Could not undo: ' + ex.message);
    }
  };

  // ---- Render --------------------------------------------------------------
  const strip = [];
  for (let o = DAYS_IN_STRIP - 1; o >= 0; o--) {
    const st = today - o * DAY, d = new Date(st);
    strip.push(
      <button
        key={o}
        className={'day' + (hasDay.has(sod(st)) ? ' has' : '')}
        aria-pressed={daySel === o}
        aria-label={relDay(st)}
        onClick={() => setDaySel(daySel === o ? null : o)}
      >
        <span className="wd">{o === 0 ? 'Today' : DN[d.getDay()]}</span>
        <span className="num">{d.getDate()}</span>
        <span className="dot" />
      </button>,
    );
  }

  return (
    <>
      <div className="hist">
        <div className="strip-row">
          <button className="day all" aria-pressed={daySel === null} onClick={() => setDaySel(null)}>All</button>
          <div className="strip" ref={stripRef} aria-label="Choose a day">{strip}</div>
        </div>

        <div className="seg" role="group" aria-label="Child">
          {[['both', 'Both'], ['A', names.A], ['B', names.B]].map(([v, l]) => (
            <button key={v} className={v} aria-pressed={child === v} onClick={() => setChild(v)}>{l}</button>
          ))}
        </div>

        <div className="chips" role="group" aria-label="Type">
          {[['all', 'All'], ...KINDS.map((k) => [k, LABEL[k]])].map(([v, l]) => (
            <button key={v} className="chip" aria-pressed={kind === v} onClick={() => setKind(v)}>{l}</button>
          ))}
        </div>

        <div className={'list' + (loading ? ' loading' : '')}>
          {loadError && (
            <div className="empty">
              Can't load history: {loadError}
              <br />
              <button className="chip" style={{ marginTop: 12 }} onClick={load}>Retry</button>
            </div>
          )}
          {!loadError && groups.map((g) => (
            <div key={g.label}>
              <div className="group-head">
                <span>{g.label}</span>
                <span>{g.items.length} {g.items.length === 1 ? 'entry' : 'entries'}</span>
              </div>
              {g.items.map((e) => {
                const d = describe(e, names);
                return (
                  <button key={keyOf(e)} className="row" aria-label={`View ${d.title} at ${hm(e.start)}`} onClick={() => { setSheet({ mode: 'view', key: keyOf(e) }); setErr(null); }}>
                    <span className={'badge ' + e.twin}><Icon d={ICONS[e.kind]} size={20} stroke={2} /></span>
                    <span className="txt"><span className="t">{d.title}</span><span className="d">{d.detail}</span></span>
                    <span className="time">{e.kind === 'Weight' ? '' : hm(e.start)}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A8F95" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
                  </button>
                );
              })}
            </div>
          ))}
          {!loading && !loadError && list.length === 0 && <div className="empty">Nothing logged for this filter yet.</div>}
        </div>
      </div>

      {cur && <Sheet {...{ cur, names, sheet, setSheet, draft, setDraft, err, busy, startEdit, save, confirmDelete, closeSheet }} />}

      {toast && (
        <div className="hist-layer hist-toast" role="status" aria-live="polite">
          <span>{toast.text}</span>
          {toast.undo && <button onClick={undo}>Undo</button>}
        </div>
      )}
    </>
  );
}

function Sheet({ cur, names, sheet, setSheet, draft: dr, setDraft, err, busy, startEdit, save, confirmDelete, closeSheet }) {
  const desc = describe(cur, names);
  const mode = sheet.mode;
  const k = cur.kind;
  const head = mode === 'edit' ? 'Edit ' + LABEL[k].toLowerCase() : mode === 'confirm' ? 'Delete this entry?' : desc.title;
  const toView = () => setSheet({ ...sheet, mode: 'view' });

  let body;
  if (mode === 'view') {
    body = (
      <>
        <div>{desc.rows.map(([key, v]) => <div key={key} className="kv"><span>{key}</span><span>{v}</span></div>)}</div>
        <div className="btns">
          <button className="btn danger-outline" onClick={() => setSheet({ ...sheet, mode: 'confirm' })}>Delete</button>
          <button className={'btn primary ' + cur.twin} onClick={startEdit}>Edit</button>
        </div>
      </>
    );
  } else if (mode === 'confirm') {
    body = (
      <>
        <p className="confirm-text">
          {desc.title} · {relDay(cur.start)} {k === 'Weight' ? '' : hm(cur.start)}.<br />You can undo straight after.
        </p>
        {err && <div className="error" role="alert">{err}</div>}
        <div className="btns">
          <button className="btn outline" onClick={toView}>Keep</button>
          <button className="btn danger" disabled={busy} onClick={confirmDelete}>{busy ? 'Deleting…' : 'Delete'}</button>
        </div>
      </>
    );
  } else {
    const showMl = k === 'Pumping' || (k === 'Feeding' && dr.type !== 'breast');
    const types = [['breast', 'Breast'], ['formula', 'Formula'], ['expressed', 'Expressed'], ...(dr.label ? [['other', cap(dr.label)]] : [])];
    body = (
      <>
        <div className="seg two" role="group" aria-label="Child">
          {['A', 'B'].map((t) => <button key={t} className={t} aria-pressed={dr.child === t} onClick={() => setDraft({ child: t })}>{names[t]}</button>)}
        </div>

        {k === 'Weight' ? (
          <label className="field">Date<input className="input" type="date" value={dr.date || ''} onChange={(ev) => setDraft({ date: ev.target.value })} /></label>
        ) : (
          <label className="field">{cur.end ? 'Start time' : 'Time'}<input className="input" type="datetime-local" value={dr.start || ''} onChange={(ev) => setDraft({ start: ev.target.value })} /></label>
        )}
        {cur.end && (
          <label className="field">End time<input className="input" type="datetime-local" value={dr.end || ''} onChange={(ev) => setDraft({ end: ev.target.value })} /></label>
        )}

        {k === 'Feeding' && (
          <div className="pills" role="group" aria-label="Type">
            {types.map(([v, l]) => <button key={v} className="pill" aria-pressed={dr.type === v} onClick={() => setDraft({ type: v, ml: dr.ml || 90 })}>{l}</button>)}
          </div>
        )}
        {k === 'Feeding' && dr.type === 'breast' && (
          <div className="seg" role="group" aria-label="Side">
            {Object.entries(SIDE).map(([v, l]) => <button key={v} aria-pressed={dr.side === v} onClick={() => setDraft({ side: v })}>{l}</button>)}
          </div>
        )}
        {showMl && (
          <div className="stepper">
            <button aria-label="Less" onClick={() => setDraft({ ml: clamp((dr.ml || 0) - 10, 0, 400) })}>−</button>
            <div className="val">{dr.ml || 0} <span className="unit">ml</span></div>
            <button aria-label="More" onClick={() => setDraft({ ml: clamp((dr.ml || 0) + 10, 0, 400) })}>+</button>
          </div>
        )}
        {k === 'Weight' && (
          <div className="stepper">
            <button aria-label="Less" onClick={() => setDraft({ kg: Math.max(0.5, Math.round(((dr.kg || 0) - 0.05) * 100) / 100) })}>−</button>
            <div className="val">{Number(dr.kg || 0).toFixed(2)} <span className="unit">kg</span></div>
            <button aria-label="More" onClick={() => setDraft({ kg: Math.round(((dr.kg || 0) + 0.05) * 100) / 100 })}>+</button>
          </div>
        )}
        {k === 'Sleep' && (
          <button className="toggle" aria-pressed={!!dr.nap} onClick={() => setDraft({ nap: !dr.nap })}>Nap: {dr.nap ? 'yes' : 'no'}</button>
        )}
        {k === 'Changes' && (
          <>
            <div className="grid2">
              {[['wet', 'Wet'], ['solid', 'Solid']].map(([v, l]) => <button key={v} className="toggle" aria-pressed={!!dr[v]} onClick={() => setDraft({ [v]: !dr[v] })}>{l}</button>)}
            </div>
            <div className="grid4">
              {Object.keys(SW).map((c) => (
                <button key={c} className="color" aria-pressed={dr.color === c} onClick={() => setDraft({ color: dr.color === c ? '' : c })}>
                  <span className="sw" style={{ background: SW[c] }} />{cap(c)}
                </button>
              ))}
            </div>
          </>
        )}
        {k === 'Notes' && (
          <textarea className="input" rows={4} aria-label="Note" value={dr.note || ''} onChange={(ev) => setDraft({ note: ev.target.value })} />
        )}
        {err && <div className="error" role="alert">{err}</div>}
        <div className="btns">
          <button className="btn outline" onClick={toView}>Cancel</button>
          <button className={'btn primary ' + dr.child} disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</button>
        </div>
      </>
    );
  }

  return (
    <div className="hist-layer overlay">
      <button className="scrim" aria-label="Close" onClick={closeSheet} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={head}>
        <div className="sheet-head">
          <span className={'badge ' + cur.twin}><Icon d={ICONS[k]} size={20} stroke={2} /></span>
          <h2>{head}</h2>
          <button className="close" aria-label="Close" onClick={closeSheet}><CloseIcon /></button>
        </div>
        {body}
      </div>
    </div>
  );
}
