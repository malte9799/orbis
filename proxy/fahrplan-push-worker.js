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
//   • optional variable ALLOWED_ORIGINS (comma separated), like the data proxy
//
// Routes:  GET /key          → { key }  public VAPID key (applicationServerKey)
//          POST /sync        → store the subscription with its trips
//          POST /unsubscribe → forget a subscription
//          POST /test        → send a test notification to one subscription

const DB = 'https://v6.db.transport.rest';
const MOTIS = 'https://api.transitous.org/api';
const GRACE_MS = 4 * 60000; // a missed cron minute is made up for within this window
const MAX_SUBS = 500;
const MAX_TRIPS = 10;
const MAX_ACTIONS_PER_RUN = 40; // free plan: 50 subrequests per invocation
const KEEP_SENT_MS = 3 * 86400000;

// ---- small helpers ----------------------------------------------------------

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
export async function vapidAuth(env, endpoint, now = Date.now()) {
  const header = b64uEnc(te.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = b64uEnc(te.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: env.VAPID_SUBJECT || 'mailto:admin@example.org' })));
  const key = await crypto.subtle.importKey('jwk', JSON.parse(env.VAPID_PRIVATE), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te.encode(`${header}.${claims}`)));
  return `vapid t=${header}.${claims}.${b64uEnc(sig)}, k=${env.VAPID_PUBLIC}`;
}

/** Sends a notification; resolves with the HTTP status of the push service (404/410 = subscription gone). */
async function sendPush(env, sub, message) {
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

async function getJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

/** status of the trip's ride around `dep`: { cancelled, delayMin | null, dep, track } or null when it was not found */
export async function liveStatus(trip, dep) {
  const near = (ts) => Math.abs(ts - dep) <= 90000;
  if (trip.from.src === 'db' && trip.to.src === 'db') {
    try {
      const q = new URLSearchParams({ from: trip.from.id, to: trip.to.id, departure: new Date(dep - 15 * 60000).toISOString(), results: '6', stopovers: 'false', polylines: 'false', remarks: 'false', language: 'de' });
      const r = await getJson(`${DB}/journeys?${q}`);
      for (const j of r.journeys ?? []) {
        const ride = (j.legs ?? []).find((l) => !l.walking && !l.transfer);
        if (ride && ride.line?.name === trip.line && near(Date.parse(ride.plannedDeparture ?? ride.departure))) {
          return { cancelled: !!ride.cancelled, delayMin: typeof ride.departureDelay === 'number' ? Math.round(ride.departureDelay / 60) : null, dep: Date.parse(ride.departure ?? ride.plannedDeparture), track: ride.departurePlatform ?? ride.plannedDeparturePlatform };
        }
      }
    } catch {
      /* fall back to Transitous */
    }
  }
  const place = (s) => (s.src === 'db' ? `${s.lat},${s.lon}` : s.id);
  const q = new URLSearchParams({ fromPlace: place(trip.from), toPlace: place(trip.to), time: new Date(dep - 15 * 60000).toISOString(), arriveBy: 'false', numItineraries: '6', language: 'de' });
  const r = await getJson(`${MOTIS}/v5/plan?${q}`);
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

// ---- message ---------------------------------------------------------------------

/** the notification for a status, or null when nothing should be sent (trip is on time and only delays are wanted) */
export function buildMessage(trip, status, tz) {
  const title = `${trip.line} · ${trip.from.name} → ${trip.to.name}`;
  const gl = status.track ? `, Gleis ${status.track}` : '';
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
    if (from && to && id && line && hmTxt && days.length && leads.length) out.push({ id, from, to, line, hm: hmTxt, days, leads, onlyDelay: !!t.onlyDelay });
  }
  return out;
}

// ---- storage ---------------------------------------------------------------------------

const load = async (env) => (await env.PUSH_KV.get('subs', 'json')) ?? {};
const save = (env, doc) => env.PUSH_KV.put('subs', JSON.stringify(doc));
async function subId(endpoint) {
  return b64uEnc(new Uint8Array(await crypto.subtle.digest('SHA-256', te.encode(endpoint)))).slice(0, 22);
}

// ---- cron -----------------------------------------------------------------------------------

export async function runDue(env, now = Date.now()) {
  const doc = await load(env);
  const cache = new Map();
  let actions = 0;
  let dirty = false;
  run: for (const [id, s] of Object.entries(doc)) {
    for (const [k, t] of Object.entries(s.sent)) {
      if (now - t > KEEP_SENT_MS) {
        delete s.sent[k];
        dirty = true;
      }
    }
    for (const trip of s.trips) {
      for (const due of dueNotifications(trip, s.tz, now, s.sent)) {
        if (actions >= MAX_ACTIONS_PER_RUN) break run;
        const ck = `${trip.from.id}|${trip.to.id}|${trip.line}|${due.dep}`;
        if (!cache.has(ck)) {
          actions++;
          cache.set(ck, liveStatus(trip, due.dep).catch(() => null));
        }
        const status = await cache.get(ck);
        if (!status) continue; // not found / service down: try again next minute (inside the grace window)
        s.sent[due.key] = now;
        dirty = true;
        const msg = buildMessage(trip, status, s.tz);
        if (!msg) continue;
        actions++;
        const code = await sendPush(env, s.sub, msg).catch(() => 0);
        if (code === 404 || code === 410) {
          delete doc[id]; // the user revoked the permission or uninstalled the app
          continue run;
        }
      }
    }
  }
  if (dirty) await save(env, doc);
}

// ---- HTTP ---------------------------------------------------------------------------------------

function corsFor(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((x) => x.trim()).filter(Boolean);
  if (allowed.length && !allowed.includes(origin)) return null;
  return { 'Access-Control-Allow-Origin': origin || '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
}

const validSub = (s) => typeof s?.endpoint === 'string' && /^https:\/\//.test(s.endpoint) && s.endpoint.length < 600 && typeof s.keys?.p256dh === 'string' && typeof s.keys?.auth === 'string';
const validTz = (tz) => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return typeof tz === 'string';
  } catch {
    return false;
  }
};

async function handle(req, env, url) {
  if (url.pathname === '/key' && req.method === 'GET') return { key: env.VAPID_PUBLIC };
  if (req.method !== 'POST') return 404;
  const raw = await req.text();
  if (raw.length > 30000) return 413;
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return 400;
  }
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : body?.subscription?.endpoint;
  if (typeof endpoint !== 'string' || !/^https:\/\//.test(endpoint) || endpoint.length > 600) return 400;
  const id = await subId(endpoint);
  const doc = await load(env);
  if (url.pathname === '/sync') {
    const sub = body.subscription;
    if (!validSub(sub) || !validTz(body.tz)) return 400;
    const trips = cleanTrips(body.trips);
    if (!trips.length) delete doc[id];
    else {
      if (!doc[id] && Object.keys(doc).length >= MAX_SUBS) return 507;
      doc[id] = { sub: { endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } }, tz: body.tz, trips, sent: doc[id]?.sent ?? {}, t: Date.now() };
    }
    await save(env, doc);
    return { ok: true, trips: trips.length };
  }
  if (url.pathname === '/unsubscribe') {
    delete doc[id];
    await save(env, doc);
    return { ok: true };
  }
  if (url.pathname === '/test') {
    const s = doc[id];
    if (!s) return 404;
    const code = await sendPush(env, s.sub, { title: 'Orbis Fahrplan', body: 'Benachrichtigungen funktionieren.', tag: 'test', url: './#/fahrplan' }).catch(() => 0);
    if (code === 404 || code === 410) {
      delete doc[id];
      await save(env, doc);
    }
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
