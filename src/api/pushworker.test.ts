import { afterEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error – plain JS worker file, deployed on its own
import { buildMessage, cleanTrips, dbDelays, dbStamp, dueNotifications, instantAt, matchDelay, parseStations, parseTimetable, pickStation, zoned } from '../../proxy/fahrplan-push-worker.js';

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
    for (const line of ['RE8', 'RE 8', 'RE 4306']) expect(matchDelay(planned, changes, { ts: at('06:12'), kind: 'dep', line })).toEqual({ delayMin: 15, cancelled: false, track: '1' });
    // the S-Bahn at the same minute has no change entry → on time, planned platform
    expect(matchDelay(planned, changes, { ts: at('06:12'), kind: 'dep', line: 'S 9' })).toEqual({ delayMin: 0, cancelled: false, track: '3' });
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
    expect(matchDelay(planned, changes, { ts: at('05:59'), kind: 'arr', line: 'RE 1' })).toEqual({ delayMin: 0, cancelled: false, track: '1' });
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
