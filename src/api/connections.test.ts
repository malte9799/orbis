import { afterEach, describe, expect, it, vi } from 'vitest';
import { durationTxt, ensureSource, inTxt, parseDepartures, parseItineraries, parseStops } from './connections';

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
