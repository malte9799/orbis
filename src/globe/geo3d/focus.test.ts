import { describe, expect, it } from 'vitest';
import { placeAhead, focusCentre, maxFocusZoom, sightToObject } from './focus';
import { frame, H, TO_CENTRE, W } from './testcamera';
import type { Vec3 } from './frame';

const GEO_M = 35786000;
const ZOOM_OF = (zn: number, lat: number) => zn + Math.log2(Math.cos((lat * Math.PI) / 180));

/** How far from the middle of the screen the object is with the map centre for it (CSS px). */
function miss(p: Vec3, zoom: number, t: number, pitch: number, bearing: number) {
  const [lng, lat] = focusCentre(p, bearing, pitch, t);
  const s = frame(ZOOM_OF(zoom, lat), t, lng, lat, pitch, bearing, p[2]).toScreen(p[0], p[1], p[2]);
  expect(s).not.toBeNull();
  return Math.hypot(s![0] - W / 2, s![1] - H / 2);
}

describe('placeAhead', () => {
  it('goes north and east along the equator', () => {
    expect(placeAhead(0, 0, 0, 0.5)[1]).toBeCloseTo((0.5 * 180) / Math.PI);
    expect(placeAhead(0, 0, 90, 0.5)[0]).toBeCloseTo((0.5 * 180) / Math.PI);
  });

  it('stays put without an angle', () => {
    const [lon, lat] = placeAhead(13.4, 52.5, 77, 0);
    expect(lon).toBeCloseTo(13.4);
    expect(lat).toBeCloseTo(52.5);
  });
});

describe('sightToObject', () => {
  it('straight down it is the altitude', () => {
    expect(sightToObject(6371008.8, 0)).toBeCloseTo(1);
  });

  it('nothing on the ground', () => {
    expect(sightToObject(0, 45)).toBeCloseTo(0);
  });
});

describe('the object stays in the middle of the screen', () => {
  it.each([
    ['aircraft', [13.4, 52.5, 11000], 5],
    ['low orbit', [100, -30, 550000], 4],
    ['geostationary', [-40, 0, GEO_M], 0.8],
    ['near the antimeridian', [179.9, 10, 400000], 3],
  ] as [string, Vec3, number][])('%s on the globe, from every side', (_name, p, zoom) => {
    for (const pitch of [0, 30, 60, 85]) {
      for (const bearing of [0, 45, 135, -90]) {
        expect(miss(p, zoom, 1, pitch, bearing)).toBeLessThan(0.01);
      }
    }
  });

  it('on the flat map through the centre elevation', () => {
    expect(miss([13.4, 52.5, 11000], 12, 0, 60, 30)).toBeLessThan(0.01);
  });

  it('nearly during the blend', () => {
    for (const t of [0.25, 0.5, 0.75]) expect(miss([13.4, 52.5, 11000], 7, t, 60, 30)).toBeLessThan(1);
  });

  it('nearly during the blend at the zoom where the map really flattens', () => {
    for (const t of [0.25, 0.5, 0.75]) expect(miss([13.4, 52.5, 11000], 11.5, t, 60, 30)).toBeLessThan(1);
  });

  it('stays clear of a low orbit before the map flattens', () => {
    // the zoom of the map is this plus log2(cos lat): at most this at the equator
    expect(maxFocusZoom(550000, 60, TO_CENTRE)).toBeLessThan(11);
  });
});

describe('zoom limit', () => {
  it('a geostationary satellite keeps the camera far out', () => {
    expect(maxFocusZoom(GEO_M, 0, TO_CENTRE)).toBeLessThan(2);
  });

  it('an aircraft only limits zooms beyond the flat map', () => {
    expect(maxFocusZoom(11000, 0, TO_CENTRE)).toBeGreaterThan(8);
  });

  it('nothing on the ground', () => {
    expect(maxFocusZoom(0, 45, TO_CENTRE)).toBe(Infinity);
  });

  it('at the limit the camera is in front of the object', () => {
    const zoom = maxFocusZoom(GEO_M, 30, TO_CENTRE);
    const c = frame(ZOOM_OF(zoom, 0), 1, -40, 0, 30, 0).camera;
    expect(Math.hypot(c[0], c[1], c[2])).toBeGreaterThan(1 + GEO_M / 6371008.8);
  });
});
