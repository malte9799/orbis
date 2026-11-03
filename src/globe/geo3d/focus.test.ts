import { describe, expect, it } from 'vitest';
import { cockpitView, distanceZoomFor, distanceZoomOf, focusCentre, highestDistanceZoom, mapZoomFor, maxDistanceZoom, placeAhead, sightToObject } from './focus';
import { frame, H, TO_CENTRE, W } from './testcamera';
import { toUnit, type Vec3 } from './frame';

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
});

describe('zoom keeps the distance to the object', () => {
  /** Camera distance to an object in earth radii, with the map set up by this zoom of the distance. */
  function distance(p: Vec3, distanceZoom: number, pitch: number) {
    const zoom = mapZoomFor(distanceZoom, p[2], pitch, 1, TO_CENTRE);
    const [lng, lat] = focusCentre(p, 0, pitch, 1);
    const c = frame(ZOOM_OF(zoom, lat), 1, lng, lat, pitch, 0).camera;
    const o = toUnit(p[0], p[1], p[2]);
    return Math.hypot(c[0] - o[0], c[1] - o[1], c[2] - o[2]);
  }

  it('tilting moves the camera around the object, not away from it', () => {
    const p: Vec3 = [20, 10, 550000];
    const top = distance(p, 7, 0);
    for (const pitch of [30, 60, 85]) expect(distance(p, 7, pitch)).toBeCloseTo(top, 5);
  });

  it('tilting lets the map zoom out behind the object', () => {
    expect(mapZoomFor(7, 550000, 85, 1, TO_CENTRE)).toBeLessThan(mapZoomFor(7, 550000, 0, 1, TO_CENTRE) - 1);
  });

  it('the two zooms are each other\'s inverse', () => {
    const z = mapZoomFor(5, 11000, 60, 0.5, TO_CENTRE);
    expect(distanceZoomFor(z, 11000, 60, 0.5, TO_CENTRE)).toBeCloseTo(5, 6);
  });

  it('on the ground they are the same', () => {
    expect(mapZoomFor(9, 0, 60, 1, TO_CENTRE)).toBeCloseTo(9, 6);
  });

  it('on the flat map the elevation does it: they are the same', () => {
    expect(mapZoomFor(13, 11000, 60, 0, TO_CENTRE)).toBeCloseTo(13, 6);
  });
});

describe('cockpit view', () => {
  it('looks from just above the aircraft along its course', () => {
    const { position, view } = cockpitView(13, 52, 10000, 90);
    const a = (view.pitch * Math.PI) / 180;
    expect(position[0]).toBeGreaterThan(13);
    expect(position[1]).toBeCloseTo(52, 2);
    expect(position[2] + view.distanceM * Math.cos(a)).toBeCloseTo(10008);
    expect(view.bearing).toBe(90);
  });

  it('is within what the globe allows', () => {
    for (const alt of [0, 300, 10000, 40000]) {
      const { position, view } = cockpitView(0, 0, alt, 0);
      expect(distanceZoomOf(view.distanceM, TO_CENTRE)).toBeLessThanOrEqual(maxDistanceZoom(position[2], TO_CENTRE));
    }
  });
});

describe('zoom limit', () => {
  it('is the same distance from every side', () => {
    const limit = maxDistanceZoom(550000, TO_CENTRE);
    expect(mapZoomFor(limit, 550000, 85, 1, TO_CENTRE)).toBeLessThan(mapZoomFor(limit, 550000, 0, 1, TO_CENTRE));
    expect(2 ** -limit).toBeCloseTo(((550000 / 6371008.8) * 0.3) / ((TO_CENTRE * 2 * Math.PI) / 512), 6);
  });

  it('a geostationary satellite keeps the map far out', () => {
    expect(mapZoomFor(maxDistanceZoom(GEO_M, TO_CENTRE), GEO_M, 0, 1, TO_CENTRE)).toBeLessThan(2);
  });

  it('a low orbit stays clear of where the map flattens, from every side', () => {
    for (const pitch of [0, 60, 85]) expect(mapZoomFor(maxDistanceZoom(550000, TO_CENTRE), 550000, pitch, 1, TO_CENTRE)).toBeLessThan(11);
  });

  it('an aircraft only limits zooms beyond the flat map', () => {
    expect(mapZoomFor(maxDistanceZoom(11000, TO_CENTRE), 11000, 0, 1, TO_CENTRE)).toBeGreaterThan(8);
  });

  it('nothing on the ground', () => {
    expect(maxDistanceZoom(0, TO_CENTRE)).toBe(Infinity);
  });

  it('at the limit the camera is in front of the object', () => {
    const zoom = mapZoomFor(maxDistanceZoom(GEO_M, TO_CENTRE), GEO_M, 30, 1, TO_CENTRE);
    const c = frame(ZOOM_OF(zoom, 0), 1, -40, 0, 30, 0).camera;
    expect(Math.hypot(c[0], c[1], c[2])).toBeGreaterThan(1 + GEO_M / 6371008.8);
  });
});

describe('highestDistanceZoom', () => {
  it('keeps the camera away from a high aircraft on the flat map too', () => {
    // flat map (t = 0), zoom 16 allowed: the camera still stays about a third of the height from the object
    const dz = highestDistanceZoom(16, 10000, 60, 0, TO_CENTRE);
    expect(dz).toBeCloseTo(maxDistanceZoom(10000, TO_CENTRE), 6);
    expect(mapZoomFor(dz, 10000, 60, 0, TO_CENTRE)).toBeLessThan(15.5);
  });

  it('is the map limit near the ground', () => {
    expect(highestDistanceZoom(16, 0, 60, 0, TO_CENTRE)).toBeCloseTo(16, 6);
  });
});
