import { describe, expect, it } from 'vitest';
import metaJson from '../../../../public/data/drifters/meta.json';
import {
  activeCount,
  advanceTime,
  crossesDateLine,
  dayToIso,
  decodeTracks,
  distanceKm,
  dotAlpha,
  localStep,
  pointAt,
  pointTimes,
  segmentIndex,
  SHARED_SPAN_DAYS,
  summarize,
  timeRange,
  unwrappedTrack,
  type DrifterMeta,
} from './treibbojen';

const SCALE = 180;
/** builds a tracks.bin in memory: each track { start, points: [lon, lat][] } */
function encode(tracks: { start: number; pts: [number, number][] }[]): ArrayBuffer {
  const total = tracks.reduce((n, t) => n + t.pts.length, 0);
  const buf = new ArrayBuffer(4 + tracks.length * 4 + total * 4);
  const v = new DataView(buf);
  v.setUint32(0, tracks.length, true);
  tracks.forEach((t, i) => {
    v.setUint16(4 + i * 4, t.start, true);
    v.setUint16(6 + i * 4, t.pts.length, true);
  });
  let at = 4 + tracks.length * 4;
  for (const t of tracks)
    for (const [lon, lat] of t.pts) {
      v.setUint16(at, Math.round((lon + 180) * SCALE), true);
      v.setUint16(at + 2, Math.round((lat + 90) * SCALE), true);
      at += 4;
    }
  return buf;
}
const meta = { scale: SCALE, stepDays: 5, ids: [11, 22] };
const sample = () =>
  decodeTracks(
    encode([
      { start: 100, pts: [[10, 20], [11, 21], [12, 22], [13, 23]] },
      { start: 200, pts: [[179, 0], [-179, 2], [-177, 4]] },
    ]),
    meta,
  );

describe('decodeTracks', () => {
  it('reads headers and dequantises the points', () => {
    const t = sample();
    expect(t.count).toBe(2);
    expect(Array.from(t.start)).toEqual([100, 200]);
    expect(Array.from(t.len)).toEqual([4, 3]);
    expect(Array.from(t.off)).toEqual([0, 4]);
    expect(t.lon[1]).toBeCloseTo(11, 2);
    expect(t.lat[2]).toBeCloseTo(22, 2);
    expect(t.lon[5]).toBeCloseTo(-179, 2);
  });
  it('rejects a file that does not fit', () => {
    expect(() => decodeTracks(new ArrayBuffer(2), meta)).toThrow();
    expect(() => decodeTracks(encode([{ start: 1, pts: [[0, 0]] }]), meta)).toThrow();
    expect(() => decodeTracks(encode([{ start: 1, pts: [[0, 0]] }, { start: 1, pts: [[0, 0]] }]).slice(0, 14), meta)).toThrow();
  });
  it('reads the real file in public/data/drifters', async () => {
    const m = metaJson as unknown as DrifterMeta;
    // the tests run in node; the project has no node types
    // @ts-ignore
    const { readFileSync } = (await import('node:fs')) as { readFileSync(url: URL): Uint8Array & { buffer: ArrayBuffer; byteOffset: number; byteLength: number } };
    const file = readFileSync(new URL('../../../../public/data/drifters/tracks.bin', import.meta.url));
    const t = decodeTracks(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), m);
    expect(t.count).toBe(m.count);
    expect(t.lon.length).toBe(m.points);
    expect(t.lat.reduce((a, b) => Math.min(a, b), 90)).toBeGreaterThanOrEqual(-90);
    expect(t.lon.reduce((a, b) => Math.max(a, b), -180)).toBeLessThanOrEqual(180);
    const r = timeRange('real', t);
    expect(dayToIso(r.lo) >= '1979-01-01').toBe(true);
    expect(dayToIso(r.hi) <= m.last).toBe(true);
    for (let i = 0; i < t.count; i++) expect(t.len[i]).toBeGreaterThanOrEqual(12);
  });
});

describe('pointAt', () => {
  it('interpolates between the points', () => {
    const t = sample();
    const p = pointAt(t, 0, 1.5)!;
    expect(p.lon).toBeCloseTo(11.5, 2);
    expect(p.lat).toBeCloseTo(21.5, 2);
    expect(pointAt(t, 0, 0)).toEqual({ lon: t.lon[0], lat: t.lat[0] });
    expect(pointAt(t, 0, 3)!.lon).toBeCloseTo(13, 2);
  });
  it('is null before the start and after the end', () => {
    const t = sample();
    expect(pointAt(t, 0, -0.1)).toBeNull();
    expect(pointAt(t, 0, 3.01)).toBeNull();
    expect(pointAt(t, 0, NaN)).toBeNull();
  });
  it('crosses the date line the short way', () => {
    const t = sample();
    const p = pointAt(t, 1, 0.5)!;
    expect(Math.abs(Math.abs(p.lon) - 180)).toBeLessThan(0.02);
    expect(pointAt(t, 1, 0.25)!.lon).toBeGreaterThan(179);
    expect(pointAt(t, 1, 0.75)!.lon).toBeLessThan(-179);
  });
});

describe('date line', () => {
  it('detects a jump over ±180°', () => {
    expect(crossesDateLine(179, -179)).toBe(true);
    expect(crossesDateLine(-170, 170)).toBe(true);
    expect(crossesDateLine(10, 12)).toBe(false);
  });
  it('leaves the step over the date line out of the trail', () => {
    const t = sample();
    // track 0: 3 segments; track 1: 2 points steps, the first one crosses
    const seg = Array.from(segmentIndex(t));
    expect(seg).toEqual([0, 1, 1, 2, 2, 3, 5, 6]);
  });
  it('unwraps a track for a continuous line', () => {
    const t = sample();
    const u = unwrappedTrack(t, 1).map((p) => p[0]);
    expect(u[0]).toBeCloseTo(179, 2);
    expect(u[1]).toBeCloseTo(181, 2);
    expect(u[2]).toBeCloseTo(183, 2);
  });
});

describe('time modes', () => {
  it('shared start counts from the release, real time from the calendar', () => {
    expect(localStep('shared', 25, 100, 5)).toBe(5);
    expect(localStep('real', 25, 100, 5)).toBe(5 - 100);
    expect(localStep('real', 520, 100, 5)).toBe(4);
  });
  it('ranges: loop length for shared, first to last day for real', () => {
    const t = sample();
    expect(timeRange('shared', t)).toEqual({ lo: 0, hi: SHARED_SPAN_DAYS });
    expect(timeRange('real', t)).toEqual({ lo: 500, hi: 1010 });
  });
  it('advances by one year in 5 s (shared) and 2.5 s (real) and loops', () => {
    const r = { lo: 0, hi: 1460 };
    expect(advanceTime('shared', 0, 5000, r)).toBeCloseTo(365, 5);
    expect(advanceTime('real', 0, 2500, r)).toBeCloseTo(365, 5);
    expect(advanceTime('shared', 1450, 1000, r)).toBeCloseTo(63, 5);
    expect(advanceTime('shared', 10, 0, r)).toBe(10);
  });
  it('fades the dots in and out and hides them outside of the track', () => {
    expect(dotAlpha(-1, 10)).toBe(0);
    expect(dotAlpha(10, 10)).toBe(0);
    expect(dotAlpha(0, 10)).toBeGreaterThan(0);
    expect(dotAlpha(0, 10)).toBeLessThan(1);
    expect(dotAlpha(4, 10)).toBe(1);
    expect(dotAlpha(9, 10)).toBeLessThan(1);
  });
  it('counts the buoys that are there', () => {
    const t = sample();
    expect(activeCount(t, 'shared', 0)).toBe(2);
    expect(activeCount(t, 'shared', 8)).toBe(2);
    expect(activeCount(t, 'shared', 12)).toBe(1);
    expect(activeCount(t, 'shared', 16)).toBe(0);
    expect(activeCount(t, 'real', 510)).toBe(1);
    expect(activeCount(t, 'real', 100)).toBe(0);
  });
  it('gives per point the days since the release and since 1970', () => {
    const t = sample();
    const times = pointTimes(t);
    expect(Array.from(times.slice(0, 4))).toEqual([0, 500, 5, 505]);
    expect(times[(4 + 2) * 2 + 1]).toBe(1010);
  });
});

describe('summarize', () => {
  it('gives dates, duration and distance', () => {
    const t = sample();
    const s = summarize(t, 0);
    expect(s.id).toBe(11);
    expect(s.startDay).toBe(500);
    expect(s.endDay).toBe(515);
    expect(s.days).toBe(15);
    expect(s.km).toBeGreaterThan(400);
    expect(s.km).toBeLessThan(600);
    expect(dayToIso(0)).toBe('1970-01-01');
  });
  it('measures a degree of latitude as ~111 km', () => {
    expect(distanceKm(0, 0, 0, 1)).toBeCloseTo(111.19, 1);
    expect(distanceKm(179.5, 0, -179.5, 0)).toBeCloseTo(111.19, 1);
  });
});
