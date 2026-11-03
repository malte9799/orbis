import { describe, expect, it } from 'vitest';
import { GLOBAL_GRID, MODEL_VARS, OM_BATCH, buildSnapshot, forecastUrls, gridPoints, parseSnapshot, snapshotIsStale, type HourlyRow } from './omgrid';

function fakeRows(n: number, start = '2026-11-03T00:00'): HourlyRow[] {
  const t0 = Date.parse(`${start}:00Z`);
  const time = Array.from({ length: 72 }, (_, h) => new Date(t0 + h * 3600000).toISOString().slice(0, 16));
  return Array.from({ length: n }, (_, p) => {
    const hourly = { time } as unknown as HourlyRow['hourly'];
    MODEL_VARS.forEach((v, k) => {
      hourly[v] = time.map((_, h) => (p === 0 && h === 3 ? null : p + h / 3 + k * 0.123456));
    });
    return { hourly };
  });
}

describe('grid and requests', () => {
  it('has 408 points from 80N/180W and splits into 5 requests', () => {
    const pts = gridPoints(GLOBAL_GRID);
    expect(pts).toHaveLength(408);
    expect(pts[0]).toEqual([80, -180]);
    expect(pts[407]).toEqual([-80, 165]);
    const reqs = forecastUrls(pts);
    expect(reqs.map((r) => r.count)).toEqual([100, 100, 100, 100, 8]);
    expect(OM_BATCH).toBe(100);
    expect(reqs[0].url).toContain('forecast_days=3');
    expect(reqs[0].url).toContain('timezone=GMT');
  });
});

describe('snapshot', () => {
  const now = Date.parse('2026-11-03T10:12:00Z');
  it('round-trips with rounding and NaN as null', () => {
    const snap = buildSnapshot(GLOBAL_GRID, fakeRows(408), now);
    expect(snap.n).toBe(24);
    expect(snap.t).toBe(Date.parse('2026-11-03T00:00:00Z') / 3600000);
    const back = parseSnapshot(JSON.parse(JSON.stringify(snap)), GLOBAL_GRID, now)!;
    expect(back).not.toBeNull();
    expect(back.times).toHaveLength(24);
    expect(back.times[1] - back.times[0]).toBe(3 * 3600000);
    expect(back.data.temperature_2m).toHaveLength(24 * 408);
    // point 0, step 1 = hour 3 -> null -> NaN
    expect(back.data.temperature_2m[408]).toBeNaN();
    // point 5, step 2 (hour 6): 5 + 2 + 0 -> 7
    expect(back.data.temperature_2m[2 * 408 + 5]).toBeCloseTo(7, 5);
    // cape (k=9): 5 + 2 + 1.1 = 8.1 -> rounded to 8
    expect(back.data.cape[2 * 408 + 5]).toBe(8);
  });
  it('rejects wrong version, other grid and bad lengths', () => {
    const snap = buildSnapshot(GLOBAL_GRID, fakeRows(408), now);
    expect(parseSnapshot({ ...snap, v: 2 }, GLOBAL_GRID, now)).toBeNull();
    expect(parseSnapshot(snap, { ...GLOBAL_GRID, dx: 10, nx: 36 }, now)).toBeNull();
    expect(parseSnapshot({ ...snap, vals: { ...snap.vals, cape: [1] } }, GLOBAL_GRID, now)).toBeNull();
    expect(parseSnapshot(null, GLOBAL_GRID, now)).toBeNull();
  });
  it('is stale after 3 h', () => {
    const snap = buildSnapshot(GLOBAL_GRID, fakeRows(408), now);
    expect(snapshotIsStale(snap, now + 179 * 60000)).toBe(false);
    expect(snapshotIsStale(snap, now + 181 * 60000)).toBe(true);
    expect(parseSnapshot(snap, GLOBAL_GRID, now + 150 * 60000)).not.toBeNull();
    expect(parseSnapshot(snap, GLOBAL_GRID, now + 4 * 3600000)).toBeNull();
  });
  it('refuses a wrong number of locations', () => {
    expect(() => buildSnapshot(GLOBAL_GRID, fakeRows(10), now)).toThrow();
  });
});
