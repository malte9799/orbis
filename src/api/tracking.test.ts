import { describe, expect, it } from 'vitest';
import { twoline2satrec } from 'satellite.js';
import { orbitPath, type Sat } from './tracking';

const ISS: Sat = {
  name: 'ISS',
  id: '25544',
  group: 'stations',
  satrec: twoline2satrec('1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9000', '2 25544  51.6400 208.9163 0006317  69.9862  25.2906 15.49560532    00'),
};
const AT_EPOCH = new Date(Date.UTC(2024, 0, 1, 12));

describe('orbitPath', () => {
  const pts = orbitPath(ISS, AT_EPOCH);

  it('runs at the height of the station', () => {
    for (const p of pts) {
      expect(p[2]).toBeGreaterThan(350000);
      expect(p[2]).toBeLessThan(470000);
    }
  });

  it('reaches the inclination of the station', () => {
    expect(Math.max(...pts.map((p) => p[1]))).toBeCloseTo(51.6, 0);
  });

  it('closes into a ring, once around the Earth', () => {
    const [a, b] = [pts[0], pts[pts.length - 1]];
    expect(Math.abs(b[1] - a[1])).toBeLessThan(1);
    expect(Math.abs(Math.abs(b[0] - a[0]) - 360)).toBeLessThan(1);
  });

  it('has continuous longitudes', () => {
    for (let i = 1; i < pts.length; i++) expect(Math.abs(pts[i][0] - pts[i - 1][0])).toBeLessThan(30);
  });
});
