import { afterEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error – plain JS worker file, deployed on its own
import worker, { buildMessage, cleanTrips, dbDelays, dbStamp, dueNotifications, instantAt, limited, matchDelay, parseStations, parseTimetable, pickStation, pushEndpoint, runDue, vapidAuth, zoned } from '../../proxy/fahrplan-push-worker.js';

const TZ = 'Europe/Berlin';
const stop = (name: string) => ({ id: `id-${name}`, name, lat: 53.7, lon: 11.4, src: 'db' });
const trip = (over = {}) => ({ id: 't1', from: stop('Bad Kleinen'), to: stop('Wismar'), line: 'RE 8', hm: '07:12', days: [1, 2, 3, 4, 5], leads: [30, 20, 10], onlyDelay: false, ...over });

describe('time zones', () => {
  it('maps wall clock to instants, also across the DST change', () => {
    // CEST (UTC+2) on 2026-10-24, CET (UTC+1) on 2026-10-26 – the clocks change on Sunday 25 October
    expect(new Date(instantAt(2026, 10, 24, 7, 12, TZ)).toISOString()).toBe('2026-10-24T05:12:00.000Z');
    expect(new Date(instantAt(2026, 10, 26, 7, 12, TZ)).toISOString()).toBe('2026-10-26T06:12:00.000Z');
    expect(zoned(Date.parse('2026-10-29T05:30:00Z'), TZ)).toMatchObject({ y: 2026, m: 10, d: 29, h: 6, mi: 30, wd: 4 });
  });
  it('lets the day overflow into the next month', () => {
    expect(new Date(instantAt(2026, 10, 32, 0, 10, TZ)).toISOString()).toBe('2026-10-31T23:10:00.000Z');
  });
});

describe('dueNotifications', () => {
  // Thursday 2026-10-29, departure 07:12 CET = 06:12Z
  const at = (hhmm: string) => Date.parse(`2026-10-29T${hhmm}:00Z`);
  it('fires at each lead time, once', () => {
    expect(dueNotifications(trip(), TZ, at('05:41'), {})).toEqual([]);
    const due = dueNotifications(trip(), TZ, at('05:42'), {});
    expect(due.map((d: { lead: number }) => d.lead)).toEqual([30]);
    expect(dueNotifications(trip(), TZ, at('05:42'), { [due[0].key]: 1 })).toEqual([]);
    expect(dueNotifications(trip(), TZ, at('06:02'), {}).map((d: { lead: number }) => d.lead)).toEqual([10]);
  });
  it('makes up for a missed cron minute, but not for long', () => {
    expect(dueNotifications(trip(), TZ, at('05:45'), {}).map((d: { lead: number }) => d.lead)).toEqual([30]);
    expect(dueNotifications(trip(), TZ, at('05:47'), {})).toEqual([]);
  });
  it('respects the weekdays and never fires after departure', () => {
    expect(dueNotifications(trip({ days: [6, 0] }), TZ, at('05:42'), {})).toEqual([]);
    expect(dueNotifications(trip({ leads: [1] }), TZ, at('06:12'), {})).toEqual([]);
  });
  it('sees a departure just after midnight from the evening before', () => {
    const night = trip({ hm: '00:10', leads: [30], days: [5] });
    // Thursday 23:41 local → Friday 00:10 departure
    expect(dueNotifications(night, TZ, Date.parse('2026-10-29T22:41:00Z'), {})).toHaveLength(1);
  });
});

describe('buildMessage', () => {
  const t = trip();
  it('says on time, late and cancelled', () => {
    const dep = Date.parse('2026-10-29T06:12:00Z');
    expect(buildMessage(t, { cancelled: false, delayMin: 0, dep, track: '2' }, TZ).body).toBe('Dein Zug ist pünktlich (Abfahrt: 07:12 Uhr, Gleis 2).');
    expect(buildMessage(t, { cancelled: false, delayMin: 14, dep: dep + 14 * 60000 }, TZ).body).toBe('Dein Zug hat 14 min Verspätung (Abfahrt: 07:26 Uhr).');
    expect(buildMessage(t, { cancelled: true, delayMin: null, dep }, TZ).body).toContain('entfällt');
    expect(buildMessage(t, { cancelled: false, delayMin: null, dep }, TZ).body).toContain('keine Echtzeitdaten');
  });
  it('stays quiet for on-time trains when only delays are wanted', () => {
    const dep = Date.parse('2026-10-29T06:12:00Z');
    expect(buildMessage(trip({ onlyDelay: true }), { cancelled: false, delayMin: 0, dep }, TZ)).toBeNull();
    expect(buildMessage(trip({ onlyDelay: true }), { cancelled: false, delayMin: 3, dep }, TZ)).not.toBeNull();
  });
});

describe('cleanTrips', () => {
  it('drops broken trips and clamps the rest', () => {
    const r = cleanTrips([trip({ leads: [10, 10, 500, 0, 5] }), trip({ hm: '7:12' }), trip({ days: [] }), { nonsense: true }]);
    expect(r).toHaveLength(1);
    expect(r[0].leads).toEqual([10, 5]);
  });
});

// sample answers in the format of the DB Timetables API (times: YYMMddHHmm, Germany time; 29 Oct 2026 is CET)
const PLAN = `<timetable station="Bad Kleinen" eva="8010046">
  <s id="-111-2610290704-5"><tl f="N" t="p" o="800642" c="RE" n="4305"/><ar pt="2610290659" pp="1" l="1"/><dp pt="2610290704" pp="1" l="1" ppth="Bad Kleinen|Ventschow"/></s>
  <s id="-222-2610290712-3"><tl f="N" t="p" o="800642" c="RE" n="4306"/><dp pt="2610290712" pp="2" l="8"/></s>
  <s id="-333-2610290712-4"><tl f="N" t="p" o="800642" c="S" n="9"/><dp pt="2610290712" pp="3" l="1"/></s>
  <s id="-444-2610291010-1"><tl c="RE" n="4310"/><dp pt="2610291010" pp="2" l="8"/></s>
</timetable>`;
const CHANGES = `<timetable station="Bad Kleinen" eva="8010046">
  <s id="-222-2610290712-3"><ar ct="2610290727"/><dp ct="2610290727" cp="1"/></s>
  <s id="-444-2610291010-1"><dp cs="c"/></s>
</timetable>`;
const at = (hhmmZ: string) => Date.parse(`2026-10-29T${hhmmZ}:00Z`);

describe('DB timetable XML', () => {
  it('reads stations and picks the one that is meant', () => {
    const list = parseStations('<stations><station name="Bad Kleinen" eva="8010046" ds100="WBKL"/><station name="Bad Kleinen Süd" eva="1"/></stations>');
    expect(list.map((x: { eva: string }) => x.eva)).toEqual(['8010046', '1']);
    expect(pickStation('Bad Kleinen Bahnhof', list)).toMatchObject({ eva: '8010046' });
    expect(pickStation('Dorf Mecklenburg B106', list)).toBeNull();
  });
  it('parses stops with their line and times', () => {
    const t = parseTimetable(PLAN);
    expect(t).toHaveLength(4);
    expect(t[1]).toMatchObject({ id: '-222-2610290712-3', tl: { c: 'RE', n: '4306' }, dp: { pt: '2610290712', l: '8', pp: '2' }, ar: null });
  });
  it('writes the planned minute the way the API does (Germany time)', () => {
    expect(dbStamp(at('06:12'))).toBe('2610290712');
    expect(dbStamp(Date.parse('2026-10-24T05:12:00Z'))).toBe('2610240712'); // CEST
  });
  it('finds delay and platform of a departure by line', () => {
    const planned = parseTimetable(PLAN);
    const changes = parseTimetable(CHANGES);
    // RE 8 planned 07:12 CET, 15 min late, platform changed 2 → 1
    for (const line of ['RE8', 'RE 8', 'RE 4306']) expect(matchDelay(planned, changes, { ts: at('06:12'), kind: 'dep', line })).toEqual({ delayMin: 15, cancelled: false, track: '1', trackChanged: true });
    // the S-Bahn at the same minute has no change entry → on time, planned platform
    expect(matchDelay(planned, changes, { ts: at('06:12'), kind: 'dep', line: 'S 9', now: at('06:00') })).toEqual({ delayMin: 0, cancelled: false, track: '3', trackChanged: false });
  });
  it('finds a train whose category field is the operator code (ODEG: c="OE", line "RE8")', () => {
    const planned = parseTimetable('<timetable><s id="-9-2610290712-1"><tl f="D" t="p" o="OWRE" c="OE" n="62001"/><dp pt="2610290712" pp="2" l="RE8"/></s></timetable>');
    const changes = parseTimetable('<timetable><s id="-9-2610290712-1"><dp ct="2610290737" l="RE8"/></s></timetable>');
    for (const line of ['RE8', 'RE 8', '62001', 'RE8 (62001)', 'RE8 (99999)']) expect(matchDelay(planned, changes, { ts: at('06:12'), kind: 'dep', line })).toMatchObject({ delayMin: 25 });
  });
  it('prefers the train number of "RE8 (62001)" and does not take another train of the line', () => {
    const planned = parseTimetable('<timetable><s id="a"><tl c="RE" n="4306"/><dp pt="2610290712" l="8"/></s></timetable>');
    expect(matchDelay(planned, [], { ts: at('06:12'), kind: 'dep', line: 'RE8 (4306)', now: at('06:00') })).toMatchObject({ delayMin: 0 });
    expect(matchDelay(planned, [], { ts: at('06:12'), kind: 'dep', line: 'IC1 (4306)', now: at('06:00') })).toMatchObject({ delayMin: 0 }); // number wins
    expect(matchDelay(planned, [], { ts: at('06:12'), kind: 'dep', line: 'IC1 (9999)', now: at('06:00') })).toBeNull();
  });
  it('does not guess when nothing or something else matches', () => {
    const planned = parseTimetable(PLAN);
    const changes = parseTimetable(CHANGES);
    expect(matchDelay(planned, changes, { ts: at('06:12'), kind: 'dep', line: 'IC 1' })).toBeNull(); // two trains at 07:12, none is IC 1
    expect(matchDelay(planned, changes, { ts: at('06:13'), kind: 'dep', line: 'RE8' })).toBeNull(); // no train at that minute
    expect(matchDelay(planned, changes, { ts: at('06:12'), kind: 'dep', line: '' })).toBeNull(); // ambiguous without a line
  });
  it('marks a cancelled departure and reads arrivals', () => {
    const planned = parseTimetable(PLAN);
    const changes = parseTimetable(CHANGES);
    expect(matchDelay(planned, changes, { ts: at('09:10'), kind: 'dep', line: 'RE8' })).toMatchObject({ cancelled: true });
    expect(matchDelay(planned, changes, { ts: at('05:59'), kind: 'arr', line: 'RE 1' })).toEqual({ delayMin: 0, cancelled: false, track: '1', trackChanged: false });
  });
});

describe('dbDelays (stubbed API)', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('resolves the station once and answers aligned', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: { headers: Record<string, string> }) => {
      urls.push(url);
      expect(init.headers['DB-Api-Key']).toBe('k');
      const xml = url.includes('/station/') ? '<stations><station name="Bad Kleinen" eva="8010046"/></stations>' : url.includes('/plan/') ? PLAN : CHANGES;
      return new Response(xml, { status: 200 });
    }));
    const env = { DB_CLIENT_ID: 'c', DB_API_KEY: 'k' };
    const q = (kind: string, ts: string, line: string) => ({ station: 'Bad Kleinen Bahnhof', ts: Date.parse(ts), kind, line });
    const r = await dbDelays(env, [q('dep', '2026-10-29T06:12:00Z', 'RE8'), q('dep', '2026-10-29T06:30:00Z', 'RE8')]);
    expect(r[0]).toMatchObject({ delayMin: 15 });
    expect(r[1]).toBeNull();
    expect(urls.filter((u) => u.includes('/station/'))).toHaveLength(1);
    expect(urls.some((u) => u.includes('/plan/8010046/261029/07'))).toBe(true);
  });
  it('returns nulls when the API fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('no', { status: 503 })));
    const r = await dbDelays({ DB_CLIENT_ID: 'c', DB_API_KEY: 'k' }, [{ station: 'Nirgendwo 1', ts: Date.now(), kind: 'dep', line: 'RE1' }]);
    expect(r).toEqual([null]);
  });
});

describe('matchDelay: unknown real time', () => {
  it('does not call a far-away stop without change entry on time', () => {
    const planned = parseTimetable(PLAN);
    const changes = parseTimetable(CHANGES);
    const q = { ts: at('06:12'), kind: 'dep', line: 'S 9' };
    expect(matchDelay(planned, changes, { ...q, now: at('03:00') })).toMatchObject({ delayMin: null });
    expect(matchDelay(planned, changes, { ...q, now: at('05:30') })).toMatchObject({ delayMin: 0 });
  });
});

describe('XML edge cases', () => {
  it('reads attributes in any order and ignores child elements it does not know', () => {
    const xml = '<timetable><s id="x"><ar l="9" pt="2610290712"><m id="1"/></ar><tl n="1" c="RE"/><dp pp="4" pt="2610290713" l="8"><m t="h"/></dp></s></timetable>';
    const [s] = parseTimetable(xml);
    expect(s.dp).toMatchObject({ pt: '2610290713', pp: '4', l: '8' });
    expect(s.tl).toMatchObject({ c: 'RE', n: '1' });
  });
});

describe('endpoints and limits', () => {
  it('accepts only the push services of browsers', () => {
    expect(pushEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true);
    expect(pushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/abc')).toBe(true);
    expect(pushEndpoint('https://web.push.apple.com/abc')).toBe(true);
    expect(pushEndpoint('https://evil.example/x')).toBe(false);
    expect(pushEndpoint('https://evilgoogleapis.com/x')).toBe(false);
    expect(pushEndpoint('http://fcm.googleapis.com/x')).toBe(false);
    expect(pushEndpoint('nonsense')).toBe(false);
  });
  it('limits calls per key and window', () => {
    const k = `k${Math.random()}`;
    expect([1, 2, 3].map(() => limited(k, 2, 1000, 0))).toEqual([false, false, true]);
    expect(limited(k, 2, 1000, 1001)).toBe(false);
  });
  it('keeps trips apart by their own time zone', () => {
    const [t] = cleanTrips([{ ...trip(), tz: 'Europe/London' }, trip()]);
    expect(t.tz).toBe('Europe/London');
    expect(cleanTrips([{ ...trip(), tz: 'Mars/Base' }])[0].tz).toBeUndefined();
  });
});

describe('subrequest budget', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('stops calling out when the budget is used up and answers null', async () => {
    const f = vi.fn(async () => new Response('<stations/>', { status: 200 }));
    vi.stubGlobal('fetch', f);
    const qs = Array.from({ length: 30 }, (_, i) => ({ station: `Station ${i} Nord`, ts: Date.now(), kind: 'dep', line: 'RE1' }));
    const r = await dbDelays({ DB_CLIENT_ID: 'c', DB_API_KEY: 'k' }, qs, { left: 5 });
    expect(f).toHaveBeenCalledTimes(5);
    expect(r.every((x: unknown) => x === null)).toBe(true);
  });
});

describe('cron and routes (stubbed KV, push service and Transitous)', () => {
  const NOW = Date.parse('2026-10-29T06:02:00Z'); // 10 min before 07:12 CET
  const EP = 'https://fcm.googleapis.com/fcm/send/abc';
  afterEach(() => vi.unstubAllGlobals());

  const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  async function setup() {
    const ecdh = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    const p256dh = b64u(new Uint8Array(await crypto.subtle.exportKey('raw', ecdh.publicKey)));
    const vk = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
    const kv = new Map<string, string>();
    const env = {
      VAPID_PUBLIC: 'pub',
      VAPID_PRIVATE: JSON.stringify(await crypto.subtle.exportKey('jwk', vk.privateKey)),
      PUSH_KV: {
        get: async (k: string) => (kv.has(k) ? JSON.parse(kv.get(k)!) : null),
        put: async (k: string, v: string) => void kv.set(k, v),
        delete: async (k: string) => void kv.delete(k),
      },
    };
    const sub = { endpoint: EP, keys: { p256dh, auth: b64u(new TextEncoder().encode('0123456789abcdef')) } };
    const call = async (path: string, body: unknown) => {
      const res = await worker.fetch(new Request(`https://w.example${path}`, { method: 'POST', body: JSON.stringify(body) }), env);
      return res.status;
    };
    return { env, kv, sub, call };
  }
  const tripBody = (over = {}) => ({ ...trip({ leads: [10], from: { ...stop('A'), src: 'motis' }, to: { ...stop('B'), src: 'motis' } }), ...over });
  const transitous = () =>
    JSON.stringify({ itineraries: [{ legs: [{ mode: 'REGIONAL_RAIL', displayName: 'RE 8', scheduledStartTime: '2026-10-29T06:12:00Z', startTime: '2026-10-29T06:20:00Z', realTime: true, from: { track: '2' } }] }] });
  const serve = (pushStatus: number[]) => {
    const pushes: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/v5/plan')) return new Response(transitous(), { status: 200 });
      pushes.push(url);
      return new Response('', { status: pushStatus[Math.min(pushes.length - 1, pushStatus.length - 1)] });
    }));
    return pushes;
  };

  it('sends once, remembers it in its own key and does not touch the subscriptions', async () => {
    const { env, kv, sub, call } = await setup();
    expect(await call('/sync', { subscription: sub, tz: TZ, trips: [tripBody()] })).toBe(200);
    const subsBefore = kv.get('subs');
    const pushes = serve([201]);
    await runDue(env, NOW);
    await runDue(env, NOW + 60000);
    expect(pushes).toHaveLength(1);
    expect(kv.get('subs')).toBe(subsBefore);
    expect(Object.keys(JSON.parse([...kv].find(([k]) => k.startsWith('sent:'))![1]))).toHaveLength(1);
  });
  it('tries again next minute when the push service fails', async () => {
    const { env, sub, call } = await setup();
    await call('/sync', { subscription: sub, tz: TZ, trips: [tripBody()] });
    const pushes = serve([503, 201]);
    await runDue(env, NOW);
    await runDue(env, NOW + 60000);
    await runDue(env, NOW + 120000);
    expect(pushes).toHaveLength(2);
  });
  it('keeps looking when the train is on time and only delays are wanted', async () => {
    const { env, sub, call } = await setup();
    await call('/sync', { subscription: sub, tz: TZ, trips: [tripBody({ onlyDelay: true })] });
    const pushes = serve([201]);
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/v5/plan')) return new Response(transitous().replace('06:20:00Z', '06:12:00Z'), { status: 200 });
      pushes.push(url);
      return new Response('', { status: 201 });
    }));
    await runDue(env, NOW);
    expect(pushes).toHaveLength(0);
  });
  it('forgets a subscription the push service reports as gone', async () => {
    const { env, kv, sub, call } = await setup();
    await call('/sync', { subscription: sub, tz: TZ, trips: [tripBody()] });
    serve([410]);
    await runDue(env, NOW);
    expect(JSON.parse(kv.get('subs')!)).toEqual({});
  });
  it('rejects foreign endpoints and a too fast /test', async () => {
    const { sub, call } = await setup();
    expect(await call('/sync', { subscription: { ...sub, endpoint: 'https://evil.example/x' }, tz: TZ, trips: [tripBody()] })).toBe(400);
    await call('/sync', { subscription: sub, tz: TZ, trips: [tripBody()] });
    serve([201]);
    expect(await call('/test', { endpoint: EP })).toBe(200);
    expect(await call('/test', { endpoint: EP })).toBe(429);
  });
  it('reuses the signed VAPID token', async () => {
    const { env } = await setup();
    const a = await vapidAuth(env, EP, NOW);
    expect(await vapidAuth(env, EP, NOW + 60000)).toBe(a);
    expect(await vapidAuth(env, EP, NOW + 12 * 3600000)).not.toBe(a);
  });
});
