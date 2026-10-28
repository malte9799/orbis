import { describe, expect, it } from 'vitest';
import { durationTxt, inTxt, parseDepartures, parseItineraries, parseStops } from './connections';

describe('parseStops', () => {
  it('keeps only stops and names the area', () => {
    const r = parseStops([
      { type: 'STOP', id: 'de-DELFI_x', name: 'Hannover Hbf', lat: 52.37, lon: 9.74, areas: [{ name: 'Hannover', default: true }] },
      { type: 'ADDRESS', id: 'a', name: 'Straße 1', lat: 0, lon: 0 },
    ]);
    expect(r).toEqual([{ id: 'de-DELFI_x', name: 'Hannover Hbf', lat: 52.37, lon: 9.74, area: 'Hannover' }]);
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
          { mode: 'HIGHSPEED_RAIL', from: { name: 'B', track: '7' }, to: { name: 'C' }, startTime: '2026-10-28T08:10:00Z', scheduledStartTime: '2026-10-28T08:05:00Z', endTime: '2026-10-28T09:30:00Z', realTime: true, displayName: 'ICE 1601', headsign: 'München' },
        ],
      },
    ]);
    expect(it.legs[0]).toMatchObject({ mode: 'WALK', line: '', walkM: 320, delayMin: null });
    expect(it.legs[1]).toMatchObject({ line: 'ICE 1601', headsign: 'München', track: '7', delayMin: 5 });
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
