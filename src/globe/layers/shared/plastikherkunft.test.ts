import { describe, expect, it } from 'vitest';
import { arcPoints } from '../../geo3d/arc';
import originJson from '../../../../public/data/plastik/gpgp-origin.json';
import patchesJson from '../../../../public/data/plastik/patches.json';
import { ANCHORS, arcWidth, maxLonJump, summarize, unwrapLon, WIDTH_MAX, WIDTH_MIN, type OriginCountry } from './plastikherkunft';

const origin = originJson as { withOrigin: number; countries: OriginCountry[] };
const patches = patchesJson as { patches: { id: string; lon: number; lat: number }[] };
const gpgp = patches.patches.find((p) => p.id === 'gpgp')!;

describe('plastikherkunft', () => {
  it('scales the width with the share', () => {
    expect(arcWidth(0.336, 0.336)).toBe(WIDTH_MAX);
    expect(arcWidth(0, 0.336)).toBe(WIDTH_MIN);
    expect(arcWidth(0.0647, 0.336)).toBeGreaterThan(WIDTH_MIN);
    expect(arcWidth(0.0647, 0.336)).toBeLessThan(arcWidth(0.3233, 0.336));
  });
  it('unwraps the longitude to the side of the start', () => {
    expect(unwrapLon(-141.61, 140)).toBeCloseTo(218.39);
    expect(unwrapLon(-141.61, -123)).toBeCloseTo(-141.61);
    expect(unwrapLon(10, 0)).toBe(10);
  });
  it('sums the countries without an anchor into "andere"', () => {
    const s = summarize(origin.countries, origin.withOrigin);
    expect(s.anchored.map((c) => c.code)).toEqual(['JP', 'CN', 'KR', 'US', 'TW', 'CA']);
    const sumAll = origin.countries.reduce((a, c) => a + c.n, 0);
    expect(s.anchored.reduce((a, c) => a + c.n, 0) + s.other.n).toBe(sumAll);
    expect(s.other.count).toBe(origin.countries.length - 6);
    expect(s.other.share).toBeCloseTo(s.other.n / origin.withOrigin);
  });
  it('has an anchor for every shown country', () => {
    for (const c of summarize(origin.countries, origin.withOrigin).anchored) expect(ANCHORS[c.code]).toBeDefined();
  });
  it('takes the short way over the date line and stays in the Pacific', () => {
    for (const c of summarize(origin.countries, origin.withOrigin).anchored) {
      const a = ANCHORS[c.code];
      const pts = arcPoints([a.lon, a.lat], [gpgp.lon, gpgp.lat], { lift: 0.1 });
      expect(maxLonJump(pts)).toBeLessThan(10);
      const lons = pts.map((p) => p[0]);
      // all longitudes between the start and the target on the side of the start (219° for the Asian ones)
      const end = unwrapLon(gpgp.lon, a.lon);
      expect(Math.min(...lons)).toBeGreaterThanOrEqual(Math.min(a.lon, end) - 1);
      expect(Math.max(...lons)).toBeLessThanOrEqual(Math.max(a.lon, end) + 1);
      expect(Math.abs(Math.max(...lons) - Math.min(...lons))).toBeLessThan(110);
    }
  });
});
