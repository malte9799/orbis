import { describe, expect, it } from 'vitest';
import { parseDbDepartures, parseDbJourneys, parseDbStops } from './dbrest';

describe('parseDbStops', () => {
  it('keeps stops with a position', () => {
    const r = parseDbStops([
      { type: 'stop', id: '8000152', name: 'Hannover Hbf', location: { latitude: 52.376, longitude: 9.741 } },
      { type: 'location', id: 'x', name: 'Adresse' },
      { type: 'stop', id: '1', name: 'Ohne Ort' },
    ]);
    expect(r).toEqual([{ id: '8000152', name: 'Hannover Hbf', lat: 52.376, lon: 9.741, src: 'db' }]);
  });
});

describe('parseDbJourneys', () => {
  it('reads delays in seconds, drops transfer legs and counts transfers', () => {
    const [j] = parseDbJourneys([
      {
        legs: [
          {
            origin: { name: 'Bad Kleinen' },
            destination: { name: 'Schwerin Hbf' },
            plannedDeparture: '2026-10-29T06:12:00Z',
            departure: '2026-10-29T06:26:00Z',
            departureDelay: 840,
            plannedArrival: '2026-10-29T06:27:00Z',
            arrival: '2026-10-29T06:39:00Z',
            arrivalDelay: 720,
            departurePlatform: '2',
            line: { name: 'RE 8', product: 'regionalExpress' },
            direction: 'Wismar',
            stopovers: [{ stop: { name: 'Bad Kleinen' } }, { stop: { name: 'Mitte' }, arrival: '2026-10-29T06:33:00Z', arrivalDelay: 780 }, { stop: { name: 'Schwerin Hbf' } }],
          },
          { transfer: true, walking: true, origin: { name: 'Schwerin Hbf' }, destination: { name: 'Schwerin Hbf' }, plannedDeparture: '2026-10-29T06:39:00Z', plannedArrival: '2026-10-29T06:41:00Z' },
          { origin: { name: 'Schwerin Hbf' }, destination: { name: 'Ziel' }, plannedDeparture: '2026-10-29T06:50:00Z', departure: '2026-10-29T06:50:00Z', plannedArrival: '2026-10-29T07:10:00Z', arrival: '2026-10-29T07:10:00Z', line: { name: 'Bus 3', product: 'bus' } },
        ],
      },
    ]);
    expect(j.legs).toHaveLength(2);
    expect(j.transfers).toBe(1);
    expect(j.legs[0]).toMatchObject({ mode: 'REGIONAL_FAST_RAIL', line: 'RE 8', delayMin: 14, arrDelayMin: 12, track: '2', headsign: 'Wismar' });
    expect(j.legs[0].via).toEqual([{ name: 'Mitte', time: Date.parse('2026-10-29T06:33:00Z'), delayMin: 13 }]);
    expect(j.legs[1].delayMin).toBeNull();
  });
});

describe('parseDbDepartures', () => {
  it('maps delay and platform', () => {
    const [d] = parseDbDepartures([{ when: '2026-10-29T06:26:00Z', plannedWhen: '2026-10-29T06:12:00Z', delay: 840, platform: '2', line: { name: 'RE 8', product: 'regionalExpress' }, direction: 'Wismar' }]);
    expect(d).toMatchObject({ mode: 'REGIONAL_FAST_RAIL', line: 'RE 8', delayMin: 14, track: '2', headsign: 'Wismar' });
  });
});
