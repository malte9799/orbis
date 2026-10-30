import { describe, expect, it } from 'vitest';
import { decodeOwx, tilesFor } from './wxmodel';

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
