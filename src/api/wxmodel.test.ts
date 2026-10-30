import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModelSampler, type ModelGrid, type ModelVar } from './model';
import { decodeOwx, mosaic, tilesFor, WxLayer } from './wxmodel';

// 3 steps of 5 × 6 values made by encode() in scripts/wx-icon.py (random noise on a ramp, one missing value,
// and values near the int16 limits so the predictor wraps around)
const FIXTURE = 'T1dYMaQAAAB7InZhciI6InRlbXBlcmF0dXJlXzJtIiwic2NhbGUiOjAuMSwib2Zmc2V0IjotNS4wLCJub2RhdGEiOi0zMjc2OCwicHJlZCI6InBsYW5lLXRpbWUiLCJsYXQwIjo5MCwibG9uMCI6LTE4MCwiZHgiOjAuMTI1LCJkeSI6MC4xMjUsIndyYXAiOmZhbHNlLCJudCI6MywibnkiOjUsIm54Ijo2fR+LCAAAAAAAAhP7b+NgZ2B35i8vgwjnATYmBma2Y+wizMyMl1g52Tg5ZH4y8Qowfn/HwyEpwszGOG8mMw+Hcvc8dnZWOXEhxicH2TkYWI5fYGRg4eYSFli6iJOTgWfaXAFmMXEOdoafvxiA4NdPBqwAIv4TJvv3L4KEi+OSBQCf/vg1tAAAAA==';
const EXPECTED: (number | null)[][][] = [[[-3205.0, -2.0, 1.2, 4.3, 6.7, 9.8], [5.2, 8.3, 10.8, 13.9, 17.3, 19.9], [14.8, 18.2, 20.8, 23.9, 27.1, 30.0], [24.7, 27.7, 31.3, 34.2, 37.2, 40.0], [35.2, 37.9, 41.0, 44.2, 46.7, 49.9]], [[-3.6, -0.3, 3.0, 5.4, 8.6, 11.6], [7.0, 9.5, 12.7, 15.5, 18.4, 21.9], [16.4, 19.5, 22.7, null, 28.4, 32.0], [26.9, 30.0, 32.4, 35.9, 38.6, 41.7], [37.0, 39.5, 42.9, 45.5, 48.6, 52.0]], [[3195.0, 1.4, 4.3, 7.1, 10.3, 13.5], [8.4, 11.6, 14.3, 17.5, 20.6, 23.7], [18.3, 21.1, 24.6, 27.4, 30.7, 33.4], [28.3, 31.1, 34.4, 37.5, 40.6, 43.6], [38.2, 41.5, 44.6, 47.2, 50.3, 53.6]]];

const bytes = () => Uint8Array.from(atob(FIXTURE), (c) => c.charCodeAt(0)).buffer;

describe('decodeOwx', () => {
  it('reproduces the values written by the Python encoder', async () => {
    const { header, values } = await decodeOwx(bytes());
    expect(header).toMatchObject({ var: 'temperature_2m', nt: 3, ny: 5, nx: 6, lat0: 90, dx: 0.125 });
    EXPECTED.forEach((plane, t) =>
      plane.forEach((row, y) =>
        row.forEach((want, x) => {
          const got = values[(t * 5 + y) * 6 + x];
          if (want === null) expect(got).toBeNaN();
          else expect(got).toBeCloseTo(want, 3);
        }),
      ),
    );
  });

  it('rejects other data', async () => {
    await expect(decodeOwx(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer)).rejects.toThrow();
  });
});

describe('tilesFor', () => {
  it('selects the 45° tiles around Central Europe', () => {
    expect(tilesFor({ west: 5, south: 45, east: 15, north: 55 })).toEqual({ c0: 4, c1: 4, r0: 0, r1: 1 });
  });

  it('gives up when the view needs too many tiles', () => {
    expect(tilesFor({ west: -180, south: -80, east: 180, north: 80 })).toBeNull();
  });

  it('stays inside the world at the edges', () => {
    expect(tilesFor({ west: 170, south: -89, east: 180, north: -80 })).toEqual({ c0: 7, c1: 7, r0: 3, r1: 3 });
  });
});

describe('mosaic', () => {
  // tile value = absolute column index of the cell (so neighbouring tiles agree on the shared edge) + 1000 per step + 0.001 per row
  const tile = (c: number, r: number) => {
    const nt = 2;
    const values = new Float32Array(nt * 361 * 361);
    for (let t = 0; t < nt; t++)
      for (let y = 0; y < 361; y++) for (let x = 0; x < 361; x++) values[(t * 361 + y) * 361 + x] = c * 360 + x + t * 1000 + (r * 360 + y) * 0.001;
    return { header: { var: 'v', nt, ny: 361, nx: 361, lat0: 90 - r * 45, lon0: -180 + c * 45, dx: 0.125, dy: 0.125, wrap: false, scale: 1, offset: 0, nodata: -32768 }, values };
  };

  it('puts tiles side by side with a shared edge column and keeps the time steps apart', () => {
    const g = mosaic([[tile(4, 0), tile(5, 0)], [tile(4, 1), tile(5, 1)]], [0, 1]);
    expect([g.nx, g.ny, g.lat0, g.lon0]).toEqual([721, 721, 90, 0]);
    const at = (t: number, y: number, x: number) => g.data[(t * g.ny + y) * g.nx + x];
    expect(at(0, 0, 0)).toBeCloseTo(4 * 360, 2);
    expect(at(0, 0, 360)).toBeCloseTo(5 * 360, 2); // first column of the eastern tile = last of the western one
    expect(at(0, 0, 720)).toBeCloseTo(5 * 360 + 360, 2);
    expect(at(1, 0, 100)).toBeCloseTo(4 * 360 + 100 + 1000, 2);
    expect(at(0, 360, 10)).toBeCloseTo(4 * 360 + 10 + 0.36, 2); // seam between the northern and southern row
    expect(at(0, 720, 10)).toBeCloseTo(4 * 360 + 10 + 0.72, 2);
  });
});

describe('ModelSampler with ICON fields', () => {
  const H = 3600_000;
  const T0 = Date.UTC(2026, 9, 30, 0);
  const owx = () => Uint8Array.from(atob(FIXTURE), (c) => c.charCodeAt(0)).buffer;

  // Open-Meteo grid: 42 °C everywhere, steps T0 … T0+12h
  const nx = 3;
  const ny = 3;
  const times = [0, 3, 6, 9, 12].map((h) => T0 + h * H);
  const global = {
    lat0: 90, lon0: -180, dx: 1, dy: 1, nx, ny, wrap: false, times,
    data: { temperature_2m: new Float32Array(times.length * nx * ny).fill(42) } as unknown as Record<ModelVar, Float32Array>,
  } satisfies ModelGrid;

  afterEach(() => vi.unstubAllGlobals());

  async function layer(iconTimes: number[]) {
    const meta = { v: 1, run: '2026103000', issued: Date.now(), times: iconTimes, attribution: '', vars: { temperature_2m: { scale: 0.1, offset: -5, unit: '°C' } } };
    vi.stubGlobal('fetch', async (url: string) =>
      url.endsWith('latest.json') ? { ok: true, json: async () => meta } : { ok: true, arrayBuffer: async () => owx() },
    );
    // each test needs its own metadata (the module caches it for a few minutes)
    vi.useFakeTimers({ now: Date.now() + 10 * 60_000, toFake: ['Date'] });
    const l = await WxLayer.load(['temperature_2m']);
    vi.useRealTimers();
    return l!;
  }

  // the fixture has 3 steps; the point lies inside its 5 × 6 cells (0.8 cells from the corner)
  const sampleAt = (l: WxLayer, t: number) => new ModelSampler(global, null, t, l).sample('temperature_2m', 89.9, -179.9);

  it('uses ICON inside its time range, mixing steps linearly, and Open-Meteo outside', async () => {
    const l = await layer([T0 + 3 * H, T0 + 6 * H, T0 + 9 * H]); // starts later than the Open-Meteo grid
    expect(sampleAt(l, 0)).toBeCloseTo(42, 6); // before the first ICON step
    expect(sampleAt(l, 4)).toBeCloseTo(42, 6); // after the last one
    const a = sampleAt(l, 1); // T0+3h = ICON step 0
    const b = sampleAt(l, 2); // ICON step 1
    expect(a).not.toBe(42);
    expect(b).not.toBe(a);
    expect(sampleAt(l, 1.5)).toBeCloseTo((a + b) / 2, 4);
  });

  it('falls back to Open-Meteo once the run is too old', async () => {
    const l = await layer([T0, T0 + 3 * H, T0 + 6 * H]);
    expect(sampleAt(l, 0)).not.toBe(42);
    vi.useFakeTimers({ now: Date.now() + 31 * H, toFake: ['Date'] });
    expect(l.expired).toBe(true);
    expect(sampleAt(l, 0)).toBeCloseTo(42, 6);
    vi.useRealTimers();
  });
});
