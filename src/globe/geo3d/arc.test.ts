import { describe, expect, it } from 'vitest';
import { arcPoints } from './arc';

const BERLIN: [number, number] = [13.4, 52.5];
const NEW_YORK: [number, number] = [-74, 40.7];

describe('arcPoints', () => {
  it('starts and ends on the ground at the two places', () => {
    const pts = arcPoints(BERLIN, NEW_YORK, { lift: 0.15 });
    expect(pts[0][0]).toBeCloseTo(13.4);
    expect(pts[0][1]).toBeCloseTo(52.5);
    expect(pts[0][2]).toBeCloseTo(0);
    expect(pts[pts.length - 1][0]).toBeCloseTo(-74);
    expect(pts[pts.length - 1][1]).toBeCloseTo(40.7);
    expect(pts[pts.length - 1][2]).toBeCloseTo(0);
  });

  it('is highest in the middle, by share of the distance', () => {
    const pts = arcPoints(BERLIN, NEW_YORK, { lift: 0.15, steps: 64 });
    // Berlin - New York is about 6400 km
    expect(pts[32][2]).toBeGreaterThan(900000);
    expect(pts[32][2]).toBeLessThan(1000000);
  });

  it('takes the short way and stays continuous across the antimeridian', () => {
    const pts = arcPoints([170, 0], [-170, 0]);
    for (let i = 1; i < pts.length; i++) expect(Math.abs(pts[i][0] - pts[i - 1][0])).toBeLessThan(5);
    expect(pts[pts.length - 1][0]).toBeCloseTo(190);
  });

  it('two arcs with a different bulge run apart in the middle only', () => {
    const a = arcPoints(BERLIN, NEW_YORK, { bulge: 2.5 });
    const b = arcPoints(BERLIN, NEW_YORK, { bulge: -2.5 });
    expect(Math.abs(a[32][1] - b[32][1])).toBeGreaterThan(4);
    expect(a[0][1]).toBeCloseTo(b[0][1]);
  });

  it('survives two identical places', () => {
    for (const p of arcPoints(BERLIN, BERLIN)) {
      expect(p[0]).toBeCloseTo(13.4);
      expect(p[1]).toBeCloseTo(52.5);
    }
  });
});
