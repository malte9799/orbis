// Push notifications for saved commuter trips of the Fahrplan (Cloudflare Worker, free plan).
//
// A PWA cannot watch a train in the background, so this worker does it: the app sends it the trips
// the user wants to be notified about, a cron trigger (every minute) looks at the live timetable and
// sends a Web Push (VAPID, encrypted per RFC 8291) at the chosen minutes before departure, e.g.
// "RE 8 ist pünktlich" or "RE 8 hat 14 min Verspätung (Abfahrt: 07:26)".
//
// Setup: see "Fahrplan-Benachrichtigungen" in README.md. Needs
//   • KV namespace bound as PUSH_KV
//   • secrets VAPID_PUBLIC and VAPID_PRIVATE (node scripts/vapid-keys.mjs), variable VAPID_SUBJECT
//     ("mailto:you@example.org")
//   • cron trigger "* * * * *"
//   • variable ALLOWED_ORIGINS (comma separated, like the data proxy) – recommended: without it any website may use the worker.
//     Requests are also limited per IP and only the push services of the browsers are accepted as endpoints.
//
// Real-time delays: the official DB "Timetables" API (DB API Marketplace, free key, XML) is queried here, so the
// key stays in the worker and serves all users. Needs secrets DB_CLIENT_ID and DB_API_KEY. Without them the
// delay endpoint answers 501 and the push check falls back to Transitous. Data: Deutsche Bahn AG, CC BY 4.0.
//
// Routes:  GET /key          → { key }  public VAPID key (applicationServerKey)
//          POST /db/delays   → real-time delay / platform / cancellation of rail departures and arrivals
//          POST /sync        → store the subscription with its trips
//          POST /unsubscribe → forget a subscription
//          POST /test        → send a test notification to one subscription

const DB_BASE = 'https://apis.deutschebahn.com/db-api-marketplace/apis/timetables/v1';
const MOTIS = 'https://api.transitous.org/api';
const GRACE_MS = 4 * 60000; // a missed cron minute is made up for within this window
const MAX_SUBS = 500;
const MAX_TRIPS = 10;
const SUBREQUESTS = 45; // free plan: 50 subrequests per invocation – everything that calls out spends from one budget
const KNOWN_AHEAD_MS = 60 * 60000; // DB real time is only known shortly before a stop; further out "no change" means "unknown"
const KEEP_SENT_MS = 3 * 86400000;

// ---- small helpers ----------------------------------------------------------

/** subrequest budget of one invocation: spend() before every outgoing fetch, throws when it is used up */
const newBudget = (left = SUBREQUESTS) => ({ left });
function spend(budget) {
  if (budget && --budget.left < 0) throw new Error('subrequest budget used up');
}

/** best-effort limit per key in this worker instance (the free plan has no rate limiting) */
const hits = new Map();
export function limited(key, max, windowMs, now = Date.now()) {
  const h = hits.get(key);
  if (!h || h.until <= now) {
    hits.set(key, { n: 1, until: now + windowMs });
    if (hits.size > 2000) hits.delete(hits.keys().next().value);
    return false;
  }
  return ++h.n > max;
}

const te = new TextEncoder();
const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};
export const b64uEnc = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const b64uDec = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function hkdf(salt, ikm, info, bytes) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8));
}

// ---- Web Push: encryption (RFC 8291, aes128gcm) and VAPID (RFC 8292) ---------

/** body for a push to `sub` ({ keys: { p256dh, auth } }) carrying `payload` (Uint8Array) */
export async function encryptPush(sub, payload) {
  const ua = b64uDec(sub.keys.p256dh);
  const auth = b64uDec(sub.keys.auth);
  const eph = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPub = new Uint8Array(await crypto.subtle.exportKey('raw', eph.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', ua, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, eph.privateKey, 256));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const ikm = await hkdf(auth, secret, concat(te.encode('WebPush: info\0'), ua, asPub), 32);
  const cek = await hkdf(salt, ikm, te.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, te.encode('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  // a single record: the data followed by the 0x02 delimiter
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(payload, new Uint8Array([2]))));
  const head = new Uint8Array(21);
  head.set(salt, 0);
  new DataView(head.buffer).setUint32(16, 4096);
  head[20] = asPub.length;
  return concat(head, asPub, cipher);
}

/** `Authorization` header value for a push to `endpoint` */
const jwts = new Map(); // one signed token per push service, valid for 12 h – reused while 1 h or more is left
export async function vapidAuth(env, endpoint, now = Date.now()) {
  const aud = new URL(endpoint).origin;
  const ck = `${aud}|${env.VAPID_SUBJECT}|${env.VAPID_PUBLIC}`;
  const hit = jwts.get(ck);
  if (hit && hit.exp * 1000 - now > 3600000 && hit.exp * 1000 - now <= 12 * 3600000) return hit.auth;
  const exp = Math.floor(now / 1000) + 12 * 3600;
  const header = b64uEnc(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64uEnc(te.encode(JSON.stringify({ aud, exp, sub: env.VAPID_SUBJECT || 'mailto:admin@example.org' })));
  const key = await crypto.subtle.importKey('jwk', JSON.parse(env.VAPID_PRIVATE), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te.encode(`${header}.${claims}`)));
  const auth = `vapid t=${header}.${claims}.${b64uEnc(sig)}, k=${env.VAPID_PUBLIC}`;
  jwts.set(ck, { exp, auth });
  return auth;
}

/** Sends a notification; resolves with the HTTP status of the push service (404/410 = subscription gone). */
async function sendPush(env, sub, message, budget) {
  spend(budget);
  const body = await encryptPush(sub, te.encode(JSON.stringify(message)));
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: { Authorization: await vapidAuth(env, sub.endpoint), 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '600', Urgency: 'high' },
    body,
  });
  return res.status;
}

// ---- time zones --------------------------------------------------------------

/** wall clock of `ts` in `tz` */
export function zoned(ts, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', weekday: 'short' }).formatToParts(ts).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) };
}

/** the instant at which the wall clock in `tz` shows y-m-d h:mi (m is 1-based; d may overflow into the next month) */
export function instantAt(y, m, d, h, mi, tz) {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const z = zoned(guess, tz);
  const shown = Date.UTC(z.y, z.m - 1, z.d, z.h, z.mi);
  return guess - (shown - guess);
}

const clock = (ts, tz) => new Intl.DateTimeFormat('de-DE', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(ts);

// ---- which notifications are due ----------------------------------------------

/**
 * Notifications of `trip` that are due at `now`: for each lead time, the departure today (or just after
 * midnight tomorrow) whose window [dep − lead, dep − lead + grace] contains now and that was not sent yet.
 */
export function dueNotifications(trip, tz, now, sent) {
  const out = [];
  const [h, mi] = trip.hm.split(':').map(Number);
  const t = zoned(now, tz);
  for (const off of [0, 1]) {
    const dep = instantAt(t.y, t.m, t.d + off, h, mi, tz);
    const day = zoned(dep, tz);
    if (!trip.days.includes(day.wd)) continue;
    for (const lead of trip.leads) {
      const from = dep - lead * 60000;
      const key = `${trip.id}|${day.y}-${day.m}-${day.d}|${lead}`;
      if (now >= from && now < Math.min(from + GRACE_MS, dep) && !sent[key]) out.push({ lead, dep, key });
    }
  }
  return out;
}

// ---- live status ---------------------------------------------------------------

async function getJson(url, budget) {
  spend(budget);
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

/** status of the trip's ride around `dep`: { cancelled, delayMin | null, dep, track } or null when it was not found */
export async function liveStatus(trip, dep, env, budget = newBudget()) {
  const near = (ts) => Math.abs(ts - dep) <= 90000;
  // 1) the official DB data: exact delays for rail
  if (env?.DB_CLIENT_ID && env?.DB_API_KEY) {
    try {
      const [r] = await dbDelays(env, [{ station: trip.from.name, ts: dep, kind: 'dep', line: trip.line }], budget);
      if (r) return { cancelled: !!r.cancelled, delayMin: r.delayMin, dep: dep + (r.delayMin ?? 0) * 60000, track: r.track, trackChanged: !!r.trackChanged };
    } catch {
      /* fall back to Transitous */
    }
  }
  // 2) Transitous: planned times, real time only where the operator feeds it
  const place = (s) => (s.src === 'db' ? `${s.lat},${s.lon}` : s.id);
  const q = new URLSearchParams({ fromPlace: place(trip.from), toPlace: place(trip.to), time: new Date(dep - 15 * 60000).toISOString(), arriveBy: 'false', numItineraries: '6', language: 'de' });
  const r = await getJson(`${MOTIS}/v5/plan?${q}`, budget);
  for (const it of r.itineraries ?? []) {
    const ride = (it.legs ?? []).find((l) => l.mode !== 'WALK' && l.mode !== 'BIKE' && l.mode !== 'CAR');
    if (!ride || (ride.displayName ?? ride.routeShortName ?? '').trim() !== trip.line) continue;
    const sched = Date.parse(ride.scheduledStartTime ?? ride.from?.scheduledDeparture ?? ride.startTime);
    if (!near(sched)) continue;
    const actual = Date.parse(ride.startTime);
    return { cancelled: !!ride.cancelled, delayMin: ride.realTime ? Math.round((actual - sched) / 60000) : null, dep: actual, track: ride.from?.track ?? ride.from?.scheduledTrack };
  }
  return null;
}

// ---- official DB Timetables API (XML) ---------------------------------------------------

const decodeXml = (v) => v.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
function attrsOf(text) {
  const o = {};
  for (const m of text.matchAll(/([\w:-]+)="([^"]*)"/g)) o[m[1]] = decodeXml(m[2]);
  return o;
}
function tagOf(body, name) {
  const m = new RegExp(`<${name}(?:\\s([^>]*?))?/?>`).exec(body);
  return m ? attrsOf(m[1] ?? '') : null;
}

/** <station name eva …/> entries of a station search */
export function parseStations(xml) {
  return [...xml.matchAll(/<station\s([^>]*?)\/?>/g)].map((m) => attrsOf(m[1])).filter((a) => a.eva && a.name);
}

/** stops of a timetable (planned: pt/pp, changes: ct/cp/cs): [{ id, tl, ar, dp }] */
export function parseTimetable(xml) {
  const out = [];
  for (const m of xml.matchAll(/<s\s([^>]*?)(?:\/>|>([\s\S]*?)<\/s>)/g)) {
    const body = m[2] ?? '';
    out.push({ id: attrsOf(m[1]).id, tl: tagOf(body, 'tl'), ar: tagOf(body, 'ar'), dp: tagOf(body, 'dp') });
  }
  return out;
}

const normName = (n) => n.toLowerCase().replace(/ß/g, 'ss').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
const stripStation = (n) => normName(n).replace(/\b(bahnhof|bf|hbf|hauptbahnhof|haltepunkt|hp)\b/g, ' ').replace(/\s+/g, ' ').trim();

/** the station of `list` that is meant by `name` (exact, then without "Bahnhof"/"Hbf", then a prefix match) or null */
export function pickStation(name, list) {
  const n = normName(name);
  const base = stripStation(name);
  return list.find((x) => normName(x.name) === n) ?? list.find((x) => stripStation(x.name) === base) ?? list.find((x) => stripStation(x.name).startsWith(base) && base.length >= 4) ?? null;
}

/** wall clock of `ts` in Germany as the API writes it: YYMMddHHmm */
export function dbStamp(ts) {
  const z = zoned(ts, 'Europe/Berlin');
  const p = (n) => String(n).padStart(2, '0');
  return `${p(z.y % 100)}${p(z.m)}${p(z.d)}${p(z.h)}${p(z.mi)}`;
}
const stampMs = (st) => Date.UTC(2000 + +st.slice(0, 2), +st.slice(2, 4) - 1, +st.slice(4, 6), +st.slice(6, 8), +st.slice(8, 10));

const normLine = (l) => String(l ?? '').toUpperCase().replace(/[\s-]+/g, '');

/**
 * Real-time info for a query { ts, kind: 'dep' | 'arr', line } from the planned and the changed timetable of the
 * station: the stop planned at that minute (with the matching line), its delay, platform and cancellation.
 */
export function matchDelay(planned, changes, q) {
  const key = q.kind === 'arr' ? 'ar' : 'dp';
  const stamp = dbStamp(q.ts);
  const cands = planned.filter((s) => s[key]?.pt === stamp);
  // tl.c is the category (RE) for most trains but the operator code (OE for ODEG) for some, so the bare line ("RE8") counts too
  const label = (s) => [`${s.tl?.c ?? ''}${s[key]?.l ?? ''}`, `${s.tl?.c ?? ''}${s.tl?.n ?? ''}`, /\D/.test(s[key]?.l ?? '') ? s[key].l : ''].map(normLine);
  // the app names a train like Transitous does: "RE8 (62001)" = line + train number. The number is the surer match,
  // the line alone the fallback (the two sources do not always agree on numbers).
  const named = /^(.*?)\s*\((\d+)\)\s*$/.exec(q.line ?? '');
  const byLine = (w) => (w ? cands.filter((s) => label(s).includes(w) || normLine(s.tl?.n) === w) : cands);
  const exact = named ? (byLine(normLine(named[2])).length ? byLine(normLine(named[2])) : byLine(normLine(named[1]))) : byLine(normLine(q.line));
  const wanted = named ? normLine(named[1] || named[2]) : normLine(q.line);
  const hit = exact.length === 1 ? exact[0] : exact.length === 0 && cands.length === 1 && !wanted ? cands[0] : null;
  if (!hit) return null;
  const ch = changes.find((c) => c.id === hit.id)?.[key];
  const cancelled = ch?.cs === 'c' || hit[key]?.cs === 'c';
  // no entry in the changes: on time if it is soon, otherwise the real time just is not known yet
  const unknown = !ch?.ct && q.ts - (q.now ?? Date.now()) > KNOWN_AHEAD_MS;
  const delayMin = ch?.ct ? Math.round((stampMs(ch.ct) - stampMs(stamp)) / 60000) : unknown ? null : 0;
  const plannedTrack = hit[key]?.pp;
  // DB: cp = changed platform, pp = planned platform
  return { delayMin, cancelled, track: ch?.cp ?? plannedTrack, trackChanged: !!ch?.cp && !!plannedTrack && ch.cp !== plannedTrack };
}

// small caches per worker instance: the free key allows 60 calls a minute for all users together
const mem = new Map();
function cached(key, ttlMs, load) {
  const hit = mem.get(key);
  if (hit && hit.t > Date.now()) return hit.v;
  // the promise is stored, so parallel callers share one request; a failure is not kept
  const v = load();
  mem.set(key, { v, t: Date.now() + ttlMs });
  v.catch(() => mem.get(key)?.v === v && mem.delete(key));
  if (mem.size > 300) mem.delete(mem.keys().next().value);
  return v;
}

async function dbGet(env, path, budget) {
  spend(budget);
  const res = await fetch(`${env.DB_TIMETABLES_BASE || DB_BASE}${path}`, {
    headers: { 'DB-Client-Id': env.DB_CLIENT_ID, 'DB-Api-Key': env.DB_API_KEY, Accept: 'application/xml' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`DB ${res.status}`);
  return res.text();
}

async function evaOf(env, name, budget) {
  const variants = [...new Set([name, name.replace(/\s*\(.*\)\s*$/, ''), name.replace(/,.*$/, ''), name.replace(/\s+(Bahnhof|Bf|Hbf)$/i, '')].map((v) => v.trim()).filter(Boolean))];
  for (const v of variants) {
    const eva = await cached(`eva|${normName(v)}`, 7 * 86400000, async () => {
      const list = parseStations(await dbGet(env, `/station/${encodeURIComponent(v)}`, budget));
      return pickStation(name, list)?.eva ?? '';
    }).catch(() => '');
    if (eva) return eva;
  }
  return null;
}

/**
 * Looks up queries [{ station, ts, kind, line }] (planned instants) and returns, aligned, null or
 * { delayMin, cancelled, track }. Stations are resolved once, timetables are cached.
 */
export async function dbDelays(env, queries, budget = newBudget()) {
  const names = [...new Set(queries.map((x) => x.station))];
  const found = await Promise.all(names.map((n) => evaOf(env, n, budget)));
  const evas = new Map(names.map((n, i) => [n, found[i]]));
  // a query that runs out of subrequests answers null (unknown) like any other miss
  return Promise.all(
    queries.map(async (q) => {
      const eva = evas.get(q.station);
      if (!eva) return null;
      const stamp = dbStamp(q.ts);
      try {
        const [planned, changes] = await Promise.all([
          cached(`plan|${eva}|${stamp.slice(0, 8)}`, 3600000, async () => parseTimetable(await dbGet(env, `/plan/${eva}/${stamp.slice(0, 6)}/${stamp.slice(6, 8)}`, budget))),
          cached(`fchg|${eva}`, 45000, async () => parseTimetable(await dbGet(env, `/fchg/${eva}`, budget))),
        ]);
        return matchDelay(planned, changes, q);
      } catch {
        return null;
      }
    }),
  );
}

// ---- message ---------------------------------------------------------------------

/** the notification for a status, or null when nothing should be sent (trip is on time and only delays are wanted) */
export function buildMessage(trip, status, tz) {
  const title = `${trip.line} · ${trip.from.name} → ${trip.to.name}`;
  const gl = status.track ? `, Gleis ${status.track}${status.trackChanged ? ' (Gleiswechsel)' : ''}` : '';
  const tag = `trip-${trip.id}`;
  if (status.cancelled) return { title, body: `Dein Zug entfällt (planmäßige Abfahrt: ${trip.hm} Uhr).`, tag, url: './#/fahrplan' };
  if (status.delayMin != null && status.delayMin > 0) return { title, body: `Dein Zug hat ${status.delayMin} min Verspätung (Abfahrt: ${clock(status.dep, tz)} Uhr${gl}).`, tag, url: './#/fahrplan' };
  if (trip.onlyDelay) return null;
  if (status.delayMin === 0) return { title, body: `Dein Zug ist pünktlich (Abfahrt: ${clock(status.dep, tz)} Uhr${gl}).`, tag, url: './#/fahrplan' };
  return { title, body: `Planmäßig, keine Echtzeitdaten verfügbar (Abfahrt: ${trip.hm} Uhr${gl}).`, tag, url: './#/fahrplan' };
}

// ---- validation of what the app sends ------------------------------------------------

const str = (v, max) => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : null);
function cleanStop(s) {
  const id = str(s?.id, 100);
  const name = str(s?.name, 100);
  if (!id || !name || !Number.isFinite(s.lat) || !Number.isFinite(s.lon)) return null;
  return { id, name, lat: s.lat, lon: s.lon, src: s.src === 'db' ? 'db' : 'motis' };
}
export function cleanTrips(list) {
  const out = [];
  for (const t of Array.isArray(list) ? list.slice(0, MAX_TRIPS) : []) {
    const from = cleanStop(t.from);
    const to = cleanStop(t.to);
    const id = str(t.id, 300);
    const line = str(t.line, 40);
    const hmTxt = typeof t.hm === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(t.hm) ? t.hm : null;
    const days = Array.isArray(t.days) ? [...new Set(t.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))] : [];
    const leads = Array.isArray(t.leads) ? [...new Set(t.leads.filter((n) => Number.isInteger(n) && n >= 1 && n <= 120))].slice(0, 5) : [];
    // the zone the time was saved in (the device may be somewhere else when it syncs later)
    const tz = validTz(t.tz) ? t.tz : undefined;
    if (from && to && id && line && hmTxt && days.length && leads.length) out.push({ id, from, to, line, hm: hmTxt, days, leads, onlyDelay: !!t.onlyDelay, ...(tz ? { tz } : {}) });
  }
  return out;
}

// ---- storage ---------------------------------------------------------------------------
// 'subs' holds every subscription with its trips (written only by the HTTP routes). What the cron has sent
// lives in one key per subscription, so a cron run never overwrites a subscription that changed meanwhile.

const load = async (env) => (await env.PUSH_KV.get('subs', 'json')) ?? {};
const save = (env, doc) => env.PUSH_KV.put('subs', JSON.stringify(doc));
const loadSent = async (env, id) => (await env.PUSH_KV.get(`sent:${id}`, 'json')) ?? {};
async function subId(endpoint) {
  return b64uEnc(new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode(endpoint)))).slice(0, 22);
}
/** forgets a subscription (re-read right before writing, so concurrent changes of others survive) */
async function forget(env, id) {
  const doc = await load(env);
  if (doc[id]) {
    delete doc[id];
    await save(env, doc);
  }
  await env.PUSH_KV.delete(`sent:${id}`);
}

// ---- cron -----------------------------------------------------------------------------------

export async function runDue(env, now = Date.now()) {
  const doc = await load(env);
  const budget = newBudget();
  const cache = new Map();
  const gone = [];
  run: for (const [id, s] of Object.entries(doc)) {
    let sent = null; // loaded only when something is due at all
    let dirty = false;
    for (const trip of s.trips) {
      for (const due of dueNotifications(trip, trip.tz || s.tz, now, {})) {
        sent ??= await loadSent(env, id);
        if (sent[due.key]) continue;
        if (budget.left <= 0) break run; // the rest is tried again next minute (inside the grace window)
        const ck = `${trip.from.id}|${trip.to.id}|${trip.line}|${due.dep}`;
        if (!cache.has(ck)) cache.set(ck, liveStatus(trip, due.dep, env, budget).catch(() => null));
        const status = await cache.get(ck);
        if (!status) continue; // not found / service down: try again next minute
        const msg = buildMessage(trip, status, trip.tz || s.tz);
        if (!msg) continue; // on time and only delays wanted: keep looking until the grace window ends
        let code = 0;
        try {
          code = await sendPush(env, s.sub, msg, budget);
        } catch {
          /* budget used up or network error: counts as not sent */
        }
        if (code === 404 || code === 410) {
          gone.push(id); // the user revoked the permission or uninstalled the app
          dirty = false;
          continue run;
        }
        if (code >= 200 && code < 300) {
          sent[due.key] = now;
          dirty = true;
        }
      }
    }
    if (sent) {
      for (const [k, t] of Object.entries(sent)) {
        if (now - t > KEEP_SENT_MS) {
          delete sent[k];
          dirty = true;
        }
      }
      if (dirty) await env.PUSH_KV.put(`sent:${id}`, JSON.stringify(sent));
    }
  }
  for (const id of gone) await forget(env, id);
}

// ---- HTTP ---------------------------------------------------------------------------------------

function corsFor(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (allowed.length && !allowed.includes(origin)) return null;
  return { 'Access-Control-Allow-Origin': origin || '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
}

// only the push services of the browsers: a made-up endpoint would make this worker POST to any address
const PUSH_HOSTS = /(^|\.)(googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com|push\.microsoft\.com)$/;
export const pushEndpoint = (e) => {
  try {
    const u = new URL(e);
    return u.protocol === 'https:' && PUSH_HOSTS.test(u.hostname) && e.length < 600;
  } catch {
    return false;
  }
};
const validSub = (s) => typeof s?.endpoint === 'string' && pushEndpoint(s.endpoint) && typeof s.keys?.p256dh === 'string' && typeof s.keys?.auth === 'string';
const validTz = (tz) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return typeof tz === 'string';
  } catch {
    return false;
  }
};

async function delaysRoute(req, env) {
  if (!env.DB_CLIENT_ID || !env.DB_API_KEY) return 501;
  if (limited(`delays|${req.headers.get('CF-Connecting-IP') || ''}`, 20, 60000)) return 429; // the key allows ~60 calls a minute for everybody
  const raw = await req.text();
  if (raw.length > 20000) return 413;
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return 400;
  }
  const queries = (Array.isArray(body?.queries) ? body.queries : [])
    .slice(0, 40)
    .filter((q) => typeof q?.station === 'string' && q.station.length <= 100 && Number.isFinite(q.ts) && (q.kind === 'dep' || q.kind === 'arr'))
    .map((q) => ({ station: q.station, ts: q.ts, kind: q.kind, line: typeof q.line === 'string' ? q.line.slice(0, 40) : '' }));
  if (!queries.length) return 400;
  return { results: await dbDelays(env, queries) };
}

async function handle(req, env, url) {
  const ip = req.headers.get('CF-Connecting-IP') || '';
  if (url.pathname === '/key' && req.method === 'GET') return { key: env.VAPID_PUBLIC };
  if (req.method !== 'POST') return 404;
  if (url.pathname === '/db/delays') return delaysRoute(req, env);
  const raw = await req.text();
  if (raw.length > 30000) return 413;
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return 400;
  }
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : body?.subscription?.endpoint;
  if (typeof endpoint !== 'string' || !pushEndpoint(endpoint)) return 400;
  if (limited(`write|${ip}`, 30, 60000)) return 429;
  const id = await subId(endpoint);
  const doc = await load(env);
  if (url.pathname === '/sync') {
    const sub = body.subscription;
    if (!validSub(sub) || !validTz(body.tz)) return 400;
    const trips = cleanTrips(body.trips);
    if (!trips.length) {
      delete doc[id];
      await env.PUSH_KV.delete(`sent:${id}`);
    } else {
      if (!doc[id] && Object.keys(doc).length >= MAX_SUBS) return 507;
      doc[id] = { sub: { endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, tz: body.tz, trips, t: Date.now() };
    }
    await save(env, doc);
    return { ok: true, trips: trips.length };
  }
  if (url.pathname === '/unsubscribe') {
    delete doc[id];
    await save(env, doc);
    await env.PUSH_KV.delete(`sent:${id}`);
    return { ok: true };
  }
  if (url.pathname === '/test') {
    const s = doc[id];
    if (!s) return 404;
    if (limited(`test|${id}`, 1, 10000)) return 429;
    const code = await sendPush(env, s.sub, { title: 'Orbis Fahrplan', body: 'Benachrichtigungen funktionieren.', tag: 'test', url: './#/fahrplan' }).catch(() => 0);
    if (code === 404 || code === 410) await forget(env, id);
    return code >= 200 && code < 300 ? { ok: true } : 502;
  }
  return 404;
}

export default {
  async fetch(req, env) {
    const cors = corsFor(req, env);
    if (!cors) return new Response('Forbidden', { status: 403 });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const out = await handle(req, env, new URL(req.url)).catch(() => 500);
    if (typeof out === 'number') return new Response(String(out), { status: out, headers: cors });
    return new Response(JSON.stringify(out), { headers: { ...cors, 'Content-Type': 'application/json' } });
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runDue(env));
  },
};
