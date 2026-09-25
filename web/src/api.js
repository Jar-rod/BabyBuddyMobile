// Thin Baby Buddy REST client plus the mapping between API records and the
// mockup's entry shape: { kind, id, twin, start, end, data }.
// All requests go to /api on our own server, which adds the auth token.

export const KINDS = ['Feeding', 'Pumping', 'Weight', 'Sleep', 'Changes', 'Notes'];

const ENDPOINT = {
  Feeding: 'feedings',
  Pumping: 'pumping',
  Weight: 'weight',
  Sleep: 'sleep',
  Changes: 'changes',
  Notes: 'notes',
};

// Which filter names bound each endpoint's time field.
const RANGE = {
  Feeding: ['start_min', 'start_max'],
  Pumping: ['start_min', 'start_max'],
  Sleep: ['start_min', 'start_max'],
  Changes: ['date_min', 'date_max'],
  Notes: ['date_min', 'date_max'],
};

const pad = (x) => String(x).padStart(2, '0');

// ISO string with the browser's UTC offset, e.g. 2026-09-25T20:02:35+02:00.
export function isoLocal(ms) {
  const d = new Date(ms);
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`
  );
}

export class ApiError extends Error {}

// Flatten DRF validation errors ({field: [msg]}) into one readable line.
function errorText(body, status) {
  if (!body) return `Request failed (HTTP ${status})`;
  if (typeof body === 'string') return body;
  if (body.detail) return body.detail;
  return Object.entries(body)
    .map(([k, v]) => (k === 'non_field_errors' ? '' : k + ': ') + [].concat(v).join(' '))
    .join(' · ');
}

async function request(method, path, body) {
  let res;
  try {
    res = await fetch('/api/' + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check your Wi-Fi.');
  }
  if (res.status === 204) return null;
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!res.ok) throw new ApiError(errorText(json, res.status));
  return json;
}

const qs = (params) =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

const list = async (kind, params) => (await request('GET', `${ENDPOINT[kind]}/?${qs(params)}`)).results;

// ---- Children --------------------------------------------------------------

// Twin keys 'A' / 'B' follow the mockup: A = Levi, B = Liam. Falls back to id order.
export async function loadChildren() {
  const kids = (await request('GET', 'children/?limit=50')).results.sort((a, b) => a.id - b.id);
  const byName = (n) => kids.find((c) => c.first_name.toLowerCase() === n);
  const a = byName('levi') || kids[0];
  const b = byName('liam') || kids.find((c) => c !== a);
  const twins = {};
  if (a) twins.A = { id: a.id, name: a.first_name };
  if (b) twins.B = { id: b.id, name: b.first_name };
  return twins;
}

// ---- Mapping ---------------------------------------------------------------

const ms = (s) => (s ? new Date(s).getTime() : null);
const dateMs = (d) => new Date(d + 'T12:00').getTime();

function fromApi(kind, r, twinOf) {
  const base = { kind, id: r.id, twin: twinOf(r.child) };
  switch (kind) {
    case 'Feeding': {
      let data;
      if (r.method && r.method.includes('breast')) {
        data = { type: 'breast', side: r.method.startsWith('left') ? 'L' : r.method.startsWith('right') ? 'R' : 'B' };
      } else if (r.type === 'formula') {
        data = { type: 'formula', ml: r.amount };
      } else if (r.type === 'breast milk') {
        data = { type: 'expressed', ml: r.amount };
      } else {
        data = { type: 'other', label: r.type, method: r.method, ml: r.amount };
      }
      return { ...base, start: ms(r.start), end: ms(r.end), data };
    }
    case 'Pumping':
      return { ...base, start: ms(r.start), end: ms(r.end), data: { ml: r.amount } };
    case 'Weight':
      return { ...base, start: dateMs(r.date), end: null, data: { kg: r.weight } };
    case 'Sleep':
      return { ...base, start: ms(r.start), end: ms(r.end), data: { nap: !!r.nap } };
    case 'Changes':
      return {
        ...base, start: ms(r.time), end: null,
        data: { wet: r.wet, solid: r.solid, color: r.color || '', amount: r.amount == null ? '' : String(r.amount) },
      };
    case 'Notes':
      return { ...base, start: ms(r.time), end: null, data: { note: r.note } };
    default:
      throw new Error('Unknown kind ' + kind);
  }
}

// Build the API payload for one child from the form's parsed values.
function toApi(kind, childId, v) {
  switch (kind) {
    case 'Feeding': {
      const times = { child: childId, start: isoLocal(v.start), end: isoLocal(v.end) };
      if (v.data.type === 'breast') {
        const method = { L: 'left breast', R: 'right breast', B: 'both breasts' }[v.data.side];
        return { ...times, type: 'breast milk', method, amount: null };
      }
      if (v.data.type === 'other') return { ...times, type: v.data.label, method: v.data.method || 'bottle', amount: v.data.ml };
      return { ...times, type: v.data.type === 'formula' ? 'formula' : 'breast milk', method: 'bottle', amount: v.data.ml };
    }
    case 'Pumping':
      return { child: childId, start: isoLocal(v.start), end: isoLocal(v.end), amount: v.data.ml };
    case 'Weight':
      return { child: childId, weight: v.data.kg, date: v.date };
    case 'Sleep':
      return { child: childId, start: isoLocal(v.start), end: isoLocal(v.end), nap: v.data.nap };
    case 'Changes':
      // Colour and amount aren't captured; leaving them out keeps any stored values on edit.
      return { child: childId, time: isoLocal(v.start), wet: v.data.wet, solid: v.data.solid };
    case 'Notes':
      return { child: childId, time: isoLocal(v.start), note: v.data.note };
    default:
      throw new Error('Unknown kind ' + kind);
  }
}

// ---- Queries & mutations ---------------------------------------------------

export function makeApi(twins) {
  const idToTwin = Object.fromEntries(Object.entries(twins).map(([k, t]) => [t.id, k]));
  const twinOf = (childId) => idToTwin[childId] || 'A';
  const map = (kind) => (r) => fromApi(kind, r, twinOf);

  const latest = async (kind, twin) => {
    // Weights only have a date, so several can tie; the highest id is the newest.
    const rs = await list(kind, { child: twins[twin].id, limit: kind === 'Weight' ? 10 : 1 });
    const r = kind === 'Weight' ? rs.filter((x) => x.date === rs[0].date).sort((a, b) => b.id - a.id)[0] : rs[0];
    return r ? map(kind)(r) : null;
  };

  return {
    // Latest feed/sleep/change/weight/pumping per twin, for the home "today" card.
    async latestAll() {
      const out = {};
      await Promise.all(
        Object.keys(twins).flatMap((t) => {
          out[t] = {};
          return ['Feeding', 'Sleep', 'Changes', 'Weight'].map(async (k) => { out[t][k] = await latest(k, t); });
        }),
      );
      return out;
    },

    latest,

    // Every entry that starts within [from, to), optionally for one twin.
    async range(from, to, twin) {
      const child = twin && twin !== 'both' ? twins[twin].id : undefined;
      const lists = await Promise.all(
        KINDS.map(async (kind) => {
          // Weight can only filter by an exact date, so fetch it all (it's small) and filter here.
          if (kind === 'Weight') {
            const rs = (await list(kind, { child, limit: 1000 })).map(map(kind));
            return rs.filter((e) => e.start >= from && e.start < to);
          }
          const [lo, hi] = RANGE[kind];
          const rs = await list(kind, { child, [lo]: isoLocal(from), [hi]: isoLocal(to - 1000), limit: 2000 });
          return rs.map(map(kind));
        }),
      );
      return lists.flat();
    },

    day(dayStart, dayEnd, twin) {
      return this.range(dayStart, dayEnd, twin);
    },

    // The newest entry of this kind/twin that started strictly before `before`.
    async previous(kind, twin, before) {
      if (kind === 'Weight') {
        const rs = (await list(kind, { child: twins[twin].id, limit: 500 })).map(map(kind));
        return rs.filter((e) => e.start < before).sort((a, b) => b.start - a.start)[0] || null;
      }
      const [, hi] = RANGE[kind];
      const [r] = await list(kind, { child: twins[twin].id, [hi]: isoLocal(before - 1000), limit: 1 });
      return r ? map(kind)(r) : null;
    },

    async create(kind, twinKeys, values) {
      for (const t of twinKeys) await request('POST', `${ENDPOINT[kind]}/`, toApi(kind, twins[t].id, values));
    },

    async update(kind, id, twin, values) {
      await request('PATCH', `${ENDPOINT[kind]}/${id}/`, toApi(kind, twins[twin].id, values));
    },

    async remove(kind, id) {
      await request('DELETE', `${ENDPOINT[kind]}/${id}/`);
    },
  };
}
