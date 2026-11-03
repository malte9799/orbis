import { describe, expect, it } from 'vitest';
import { FIELDS, recordFromProps, tileRange } from './osmtiles';

describe('recordFromProps', () => {
  it('fills missing properties with the defaults of the old record layout', () => {
    expect(recordFromProps('cctv', 8.8, 53.1, { surveillance: 'indoor', operator: 'Postbank', id: 42 })).toEqual([8.8, 53.1, -1, 'indoor', '', '', 0, 'Postbank', 42]);
  });
  it('keeps a direction of 0 and flags', () => {
    expect(recordFromProps('alpr', 1, 2, { dir: 0, flock: 1, id: 7 })).toEqual([1, 2, 0, '', 1, '', '', '', '', '', 7]);
  });
  it('has the field counts of the former records', () => {
    expect(Object.fromEntries(Object.entries(FIELDS).map(([k, v]) => [k, v.length + 2]))).toEqual({ cctv: 9, blitzer: 8, alpr: 11, webcam: 8, wind: 8, resource: 8 });
  });
});

describe('tileRange', () => {
  it('uses max zoom for a tiny box', () => {
    const r = tileRange({ west: 8.8, east: 8.8005, south: 53.07, north: 53.0705 });
    expect(r).toMatchObject({ z: 14, x0: r.x1, y0: r.y1 });
    expect(r.x0).toBe(8592);
    expect(r.y0).toBe(5331);
  });
  it('zooms out until the tile count fits', () => {
    const r = tileRange({ west: 5, east: 15, south: 47, north: 55 }, 16);
    expect((r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1)).toBeLessThanOrEqual(16);
    expect(r.z).toBeLessThan(14);
    const bigger = tileRange({ west: 5, east: 15, south: 47, north: 55 }, 64);
    expect(bigger.z).toBeGreaterThanOrEqual(r.z);
  });
  it('clamps polar and world boxes', () => {
    expect(tileRange({ west: -180, east: 180, south: -90, north: 90 })).toEqual({ z: 2, x0: 0, x1: 3, y0: 0, y1: 3 });
  });
});
