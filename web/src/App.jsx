import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadChildren, makeApi } from './api.js';
import { C, TITLES, EDIT_TITLES, NOUN, local, dateOnly, sod, dayLabel } from './theme.js';
import Home from './screens/Home.jsx';
import EntryForm, { validate } from './screens/EntryForm.jsx';
import Timeline from './screens/Timeline.jsx';
import History from './screens/History.jsx';
import BottomNav from './components/BottomNav.jsx';
import Toast from './components/Toast.jsx';
import ErrorBanner from './components/ErrorBanner.jsx';

const FORMS = ['Feeding', 'Pumping', 'Weight', 'Sleep', 'Changes', 'Notes'];
const DAY = 86400000;

const storage = {
  get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

export default function App() {
  const [twins, setTwins] = useState(null);
  const [bootError, setBootError] = useState(null);
  const api = useMemo(() => (twins ? makeApi(twins) : null), [twins]);
  const names = useMemo(() => ({ A: twins?.A?.name || 'Twin A', B: twins?.B?.name || 'Twin B' }), [twins]);

  const [who, setWhoState] = useState(() => storage.get('who', 'A'));
  const setWho = (k) => { setWhoState(k); storage.set('who', k); };

  const [screen, setScreen] = useState('home');
  const [form, setFormState] = useState({});
  const [edit, setEdit] = useState(null); // { kind, id } while editing an existing entry
  const [formError, setFormError] = useState(null);
  const [saving, setSaving] = useState(false);
  const setForm = (patch) => { setFormState((f) => ({ ...f, ...patch })); setFormError(null); };

  const [toast, setToastText] = useState(null);
  const toastTimer = useRef();
  const showToast = (msg) => {
    clearTimeout(toastTimer.current);
    setToastText(msg);
    toastTimer.current = setTimeout(() => setToastText(null), 2600);
  };

  // ---- Boot: resolve which Baby Buddy child is Levi / Liam -----------------
  const boot = useCallback(() => {
    setBootError(null);
    loadChildren()
      .then((t) => (t.A && t.B ? setTwins(t) : setBootError('Baby Buddy needs two children set up.')))
      .catch((e) => setBootError(e.message));
  }, []);
  useEffect(boot, [boot]);

  // ---- Home: latest entries per twin ---------------------------------------
  const [latest, setLatest] = useState(null);
  const [homeLoading, setHomeLoading] = useState(false);
  const [homeError, setHomeError] = useState(null);
  const loadHome = useCallback(async () => {
    if (!api) return;
    setHomeLoading(true);
    setHomeError(null);
    try { setLatest(await api.latestAll()); }
    catch (e) { setHomeError(e.message); }
    finally { setHomeLoading(false); }
  }, [api]);

  // ---- Timeline: one day of entries ----------------------------------------
  const [tlOff, setTlOff] = useState(0);
  const [tl, setTl] = useState({ entries: [], earlier: {} });
  const [tlLoading, setTlLoading] = useState(false);
  const [tlError, setTlError] = useState(null);
  const tlReq = useRef(0);
  const dayStart = sod(Date.now()) - tlOff * DAY;
  const loadTimeline = useCallback(async () => {
    if (!api) return;
    const req = ++tlReq.current;
    setTlLoading(true);
    setTlError(null);
    try {
      const start = sod(Date.now()) - tlOff * DAY;
      // DST-safe end of day: midnight of the following calendar day.
      const end = sod(start + DAY + 3600000);
      const entries = (await api.day(start, end, who)).sort((a, b) => b.start - a.start);
      const oldest = {};
      for (const e of entries) oldest[e.kind + ':' + e.twin] = e; // newest-first, so the last write wins
      const earlier = {};
      await Promise.all(Object.entries(oldest).map(async ([key, e]) => { earlier[key] = await api.previous(e.kind, e.twin, e.start); }));
      if (req === tlReq.current) setTl({ entries, earlier });
    } catch (e) {
      if (req === tlReq.current) setTlError(e.message);
    } finally {
      if (req === tlReq.current) setTlLoading(false);
    }
  }, [api, tlOff, who]);

  useEffect(() => { if (screen === 'home') loadHome(); }, [screen, loadHome]);
  useEffect(() => { if (screen === 'Timeline') loadTimeline(); }, [screen, loadTimeline]);

  // Refresh when the phone brings the app back to the foreground.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      if (screen === 'home') loadHome();
      if (screen === 'Timeline') loadTimeline();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [screen, loadHome, loadTimeline]);

  // ---- Navigation & forms --------------------------------------------------
  const lastKg = (t) => latest?.[t]?.Weight?.data.kg ?? 3.0;

  const defaults = (kind, child) => {
    const c = kind === 'Weight' && child === 'both' ? 'A' : child;
    const now = Date.now();
    return {
      Feeding: { child: c, type: 'formula', ml: 90, side: 'L', start: local(now - 15 * 60000), end: local(now) },
      Pumping: { child: c, ml: 120, start: local(now - 20 * 60000), end: local(now) },
      Weight: { child: c, kg: lastKg(c), date: dateOnly(now) },
      Sleep: { child: c, nap: true, start: local(now - 60 * 60000), end: local(now) },
      Changes: { child: c, wet: true, solid: false, start: local(now) },
      Notes: { child: c, note: '', start: local(now) },
    }[kind];
  };

  // Back from an edit returns to the same Timeline day; opening Timeline fresh starts at today.
  const go = (target, { freshDay = false } = {}) => {
    setEdit(null);
    setFormError(null);
    if (freshDay && target === 'Timeline' && screen !== 'Timeline') setTlOff(0);
    setScreen(target);
  };
  const navTo = (target) => go(target, { freshDay: true });

  const openTile = (kind) => {
    if (kind === 'Timeline') return navTo('Timeline');
    setFormState(defaults(kind, who));
    setEdit(null);
    setFormError(null);
    setScreen(kind);
  };

  const openEdit = (e) => {
    setFormState({
      child: e.twin, start: local(e.start), end: e.end ? local(e.end) : local(e.start), date: dateOnly(e.start),
      ml: 90, side: 'L', type: 'formula', kg: 3, nap: false, wet: false, solid: false, color: '', amount: '', note: '',
      ...e.data,
    });
    setEdit({ kind: e.kind, id: e.id });
    setFormError(null);
    setScreen(e.kind);
  };

  const save = async () => {
    const kind = screen;
    const res = validate(kind, form);
    if (res.error) return setFormError(res.error);
    setSaving(true);
    try {
      if (edit) await api.update(kind, edit.id, res.kids[0], res.values);
      else await api.create(kind, res.kids, res.values);
      const whoText = res.kids.map((k) => names[k]).join(' & ');
      showToast((edit ? 'Updated · ' : 'Saved · ') + NOUN[kind] + ' for ' + whoText);
      go(edit ? 'Timeline' : 'home');
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!edit || !window.confirm('Delete this entry from Baby Buddy?')) return;
    setSaving(true);
    try {
      await api.remove(edit.kind, edit.id);
      showToast('Entry deleted');
      go('Timeline');
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // ---- Render --------------------------------------------------------------
  const isForm = FORMS.includes(screen);
  const title = edit ? EDIT_TITLES[screen] : TITLES[screen] || '';

  let body;
  if (!twins) {
    body = bootError
      ? <ErrorBanner text={`Can't load Baby Buddy: ${bootError}`} onRetry={boot} />
      : <div style={{ color: C.muted, fontSize: 15, paddingTop: 40, textAlign: 'center' }}>Connecting to Baby Buddy…</div>;
  } else if (screen === 'home') {
    body = <Home who={who} setWho={setWho} names={names} latest={latest} loading={homeLoading} error={homeError} onRetry={loadHome} onOpen={openTile} />;
  } else if (isForm) {
    body = (
      <EntryForm
        kind={screen} form={form} setForm={setForm} editing={!!edit} names={names} lastKg={lastKg}
        error={formError} saving={saving} onSave={save} onRemove={remove}
      />
    );
  } else if (screen === 'Timeline') {
    body = (
      <Timeline
        who={who} setWho={setWho} names={names} entries={tl.entries} earlier={tl.earlier}
        label={dayLabel(tlOff, dayStart)} canNext={tlOff > 0}
        onPrev={() => setTlOff(tlOff + 1)} onNext={() => setTlOff(Math.max(0, tlOff - 1))}
        loading={tlLoading} error={tlError} onRetry={loadTimeline} onEdit={openEdit}
      />
    );
  } else {
    body = <History api={api} names={names} />;
  }

  return (
    <div className="app">
      {screen !== 'home' && (
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <button aria-label="Back" onClick={() => go(edit ? 'Timeline' : 'home')} style={{ width: 44, height: 44, border: 0, borderRadius: 22, background: C.sand, color: C.ink, fontSize: 22 }}>‹</button>
          <h1 style={{ margin: 0, fontFamily: 'Fraunces, serif', fontSize: 22, fontWeight: 600 }}>{title}</h1>
          <div style={{ width: 44 }} />
        </header>
      )}
      {body}
      <Toast text={toast} />
      <BottomNav screen={screen} onGo={navTo} />
    </div>
  );
}
