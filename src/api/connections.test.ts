import { afterEach, describe, expect, it, vi } from 'vitest';
import { durationTxt, ensureSource, inTxt, planProgressive, plain, parseDepartures, parseItineraries, parseStops } from './connections';

describe('parseStops', () => {
  it('keeps only stops and names the area', () => {
    const r = parseStops([
      { type: 'STOP', id: 'de-DELFI_x', name: 'Hannover Hbf', lat: 52.37, lon: 9.74, areas: [{ name: 'Hannover', default: true }] },
      { type: 'ADDRESS', id: 'a', name: 'Straße 1', lat: 0, lon: 0 },
    ]);
    expect(r).toEqual([{ id: 'de-DELFI_x', name: 'Hannover Hbf', lat: 52.37, lon: 9.74, area: 'Hannover', src: 'motis' }]);
  });
});

describe('parseItineraries', () => {
  it('maps legs, delay and walking', () => {
    const [it] = parseItineraries([
      {
        startTime: '2026-10-28T08:00:00Z',
        endTime: '2026-10-28T09:30:00Z',
        transfers: 0,
        legs: [
          { mode: 'WALK', from: { name: 'A' }, to: { name: 'B' }, startTime: '2026-10-28T08:00:00Z', endTime: '2026-10-28T08:05:00Z', distance: 320.4 },
          { mode: 'HIGHSPEED_RAIL', from: { name: 'B', track: '7' }, to: { name: 'C' }, startTime: '2026-10-28T08:10:00Z', scheduledStartTime: '2026-10-28T08:05:00Z', endTime: '2026-10-28T09:30:00Z', realTime: true, displayName: 'ICE 1601', headsign: 'München', scheduledEndTime: '2026-10-28T09:20:00Z', intermediateStops: [{ name: 'Z', arrival: '2026-10-28T08:40:00Z', scheduledArrival: '2026-10-28T08:35:00Z' }] },
        ],
      },
    ]);
    expect(it.legs[0]).toMatchObject({ mode: 'WALK', line: '', walkM: 320, delayMin: null });
    expect(it.legs[1]).toMatchObject({ line: 'ICE 1601', headsign: 'München', track: '7', delayMin: 5 });
    expect(it.legs[1]).toMatchObject({ arrDelayMin: 10, schedDep: Date.parse('2026-10-28T08:05:00Z') });
    expect(it.legs[1].via).toEqual([{ name: 'Z', time: Date.parse('2026-10-28T08:40:00Z'), delayMin: 5 }]);
    expect(it.arr - it.dep).toBe(90 * 60000);
  });
});

describe('parseDepartures', () => {
  it('reads real-time and cancelled departures', () => {
    const r = parseDepartures([
      { place: { name: 'X', departure: '2026-10-28T08:03:00Z', scheduledDeparture: '2026-10-28T08:00:00Z', track: '2' }, mode: 'BUS', realTime: true, routeShortName: '100', headsign: 'Zoo' },
      { place: { name: 'X', departure: '2026-10-28T08:10:00Z' }, mode: 'TRAM', cancelled: true },
      { place: { name: 'X' }, mode: 'TRAM' },
    ]);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ line: '100', delayMin: 3, track: '2', cancelled: false });
    expect(r[1].cancelled).toBe(true);
  });
});

describe('texts', () => {
  it('formats durations and countdowns', () => {
    expect(durationTxt(25 * 60000)).toBe('25 min');
    expect(durationTxt(65 * 60000)).toBe('1 h 05 min');
    expect(inTxt(1000 + 5 * 60000, 1000)).toBe('5 min');
    expect(inTxt(1000, 1000)).toBe('jetzt');
  });
});

describe('ensureSource', () => {
  const old = { id: 'de-DELFI_old', name: 'Bad Kleinen', lat: 53.7295, lon: 11.4035 };
  const reply = (list: unknown[]) => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(list), { status: 200, headers: { 'Content-Type': 'application/json' } })));
  afterEach(() => vi.unstubAllGlobals());

  it('leaves stops with a source alone', async () => {
    const s = { ...old, src: 'motis' as const };
    expect(await ensureSource(s)).toBe(s);
  });
  it('moves an old stop to the DB id found by name and position', async () => {
    reply([{ type: 'stop', id: '8010046', name: 'Bad Kleinen', location: { latitude: 53.7296, longitude: 11.4033 } }]);
    expect(await ensureSource(old)).toMatchObject({ id: '8010046', src: 'db', name: 'Bad Kleinen' });
  });
  it('stays at Transitous when DB only knows a far-away namesake or fails', async () => {
    reply([{ type: 'stop', id: '1', name: 'Bad Kleinen', location: { latitude: 48.1, longitude: 11.5 } }]);
    expect(await ensureSource({ ...old, id: 'other' })).toMatchObject({ id: 'other', src: 'motis' });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 503 })));
    expect(await ensureSource({ ...old, id: 'other2' })).toMatchObject({ id: 'other2', src: 'motis' });
  });
});

describe('planProgressive', () => {
  const A = { id: 'a', name: 'Bad Kleinen', lat: 53.7, lon: 11.4, src: 'db' as const };
  const B = { id: 'b', name: 'Wismar', lat: 53.9, lon: 11.46, src: 'db' as const };
  const T = (m: number) => new Date(Date.UTC(2026, 9, 29, 6, m)).toISOString();
  const dbBody = { journeys: [{ legs: [{ origin: { name: 'Bad Kleinen' }, destination: { name: 'Wismar' }, plannedDeparture: T(12), departure: T(27), departureDelay: 900, plannedArrival: T(27), arrival: T(42), arrivalDelay: 900, line: { name: 'RE 8', product: 'regionalExpress' } }] }] };
  const motisBody = { itineraries: [{ startTime: T(12), endTime: T(27), transfers: 0, legs: [{ mode: 'REGIONAL_FAST_RAIL', from: { name: 'Bad Kleinen' }, to: { name: 'Wismar' }, startTime: T(12), endTime: T(27), realTime: true, displayName: 'RE 8' }] }] };
  const serve = (dbMs: number, motisMs: number, dbOk = true) =>
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const db = String(url).includes('transport.rest');
      await new Promise((r) => setTimeout(r, db ? dbMs : motisMs));
      if (db && !dbOk) return new Response('down', { status: 503 });
      return new Response(JSON.stringify(db ? dbBody : motisBody), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }));
  afterEach(() => vi.unstubAllGlobals());
  const o = { time: Date.parse(T(0)), arriveBy: false };

  it('shows Transitous at once and delivers the DB data later', async () => {
    serve(80, 5);
    const partial: unknown[] = [];
    const r = await planProgressive(A, B, o, (p) => partial.push(p));
    expect(partial).toHaveLength(1);
    expect((partial[0] as { list: { legs: { delayMin: number | null }[] }[] }).list[0].legs[0].delayMin).toBeNull();
    expect(r.list[0].src).toBe('db');
    expect(r.list[0].legs[0].delayMin).toBe(15);
  });
  it('skips the preliminary list when DB is quicker', async () => {
    serve(5, 80);
    const partial: unknown[] = [];
    const r = await planProgressive(A, B, o, (p) => partial.push(p));
    expect(partial).toHaveLength(0);
    expect(r.list[0].src).toBe('db');
  });
  it('keeps the Transitous result when DB fails', async () => {
    serve(20, 5, false);
    const r = await planProgressive(A, B, o, () => {});
    expect(r.list[0].src).toBe('motis');
  });
  it('plain() drops delays and uses planned times', () => {
    const it = { dep: 2, arr: 9, transfers: 0, legs: [{ mode: 'RAIL', line: 'RE 8', headsign: '', from: 'A', to: 'B', dep: 2, arr: 9, schedDep: 1, schedArr: 8, delayMin: 1, arrDelayMin: 1, cancelled: false, via: [{ name: 'X', time: 5, delayMin: 1 }] }] };
    const p = plain(it);
    expect(p).toMatchObject({ dep: 1, arr: 8 });
    expect(p.legs[0]).toMatchObject({ delayMin: null, arrDelayMin: null });
    expect(p.legs[0].via[0].delayMin).toBeNull();
  });
});
