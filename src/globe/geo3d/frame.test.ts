import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GeoFrame, sphereHides, toMercator, toUnit, withDepthRange } from './frame';
import { H, W, frame, matrices } from './testcamera';

/** where a point of render space lands, in CSS pixels */
function screenOf(f: GeoFrame, p: [number, number, number]) {
  const c = new THREE.Vector4(p[0], p[1], p[2], 1).applyMatrix4(f.proj);
  return [(c.x / c.w * 0.5 + 0.5) * W, (1 - (c.y / c.w * 0.5 + 0.5)) * H];
}

describe('coordinates', () => {
  it('match MapLibre: x = sin lng cos lat, y = sin lat, z = cos lng cos lat', () => {
    expect(toUnit(0, 0)).toEqual([0, 0, 1]);
    const [x, y, z] = toUnit(90, 0);
    expect(x).toBeCloseTo(1);
    expect(y).toBeCloseTo(0);
    expect(z).toBeCloseTo(0);
    expect(toUnit(0, 90)[1]).toBeCloseTo(1);
    expect(toUnit(0, 0, 6371008.8)[2]).toBeCloseTo(2);
  });

  it('mercator like MercatorCoordinate.fromLngLat', () => {
    const [x, y] = toMercator(0, 0);
    expect(x).toBeCloseTo(0.5);
    expect(y).toBeCloseTo(0.5);
  });
});

describe('depth range', () => {
  it('moves the depth, not the pixels', () => {
    const m = new THREE.Matrix4().fromArray(matrices(2, 10, 50).globe);
    const longer = withDepthRange(m.clone(), 10, 50000);
    const p = new THREE.Vector4(0.3, 0.5, 0.8, 1);
    const a = p.clone().applyMatrix4(m);
    const b = p.clone().applyMatrix4(longer);
    expect(b.x).toBeCloseTo(a.x, 9);
    expect(b.y).toBeCloseTo(a.y, 9);
    expect(b.w).toBeCloseTo(a.w, 9);
    expect(b.z).not.toBeCloseTo(a.z, 3);
  });

  it('near and far land on -1 and 1', () => {
    // a matrix without tilt or scale: w is simply the distance in front of the camera
    const m = withDepthRange(new THREE.Matrix4().set(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, -1, 0), 10, 1000);
    const at = (d: number) => {
      const c = new THREE.Vector4(0, 0, -d, 1).applyMatrix4(m);
      return c.z / c.w;
    };
    expect(at(10)).toBeCloseTo(-1, 9);
    expect(at(1000)).toBeCloseTo(1, 9);
  });

  it('keeps a geostationary satellite beside the globe inside the planes', () => {
    const f = frame(2, 1);
    // 90° from the centre of the view at geostationary altitude
    const c = new THREE.Vector4(...toUnit(100, 0, 35786000), 1).applyMatrix4(f.globeMatrix);
    expect(c.z / c.w).toBeGreaterThan(-1);
    expect(c.z / c.w).toBeLessThan(1);
  });
});

describe.each([
  ['globe', 1],
  ['blend', 0.5],
  ['flat', 0],
])('placing on the %s', (_name, t) => {
  it('the centre of the map is the centre of the screen', () => {
    const f = frame(6.5, t);
    expect(f.toScreen(10, 50)![0]).toBeCloseTo(W / 2, 3);
    expect(f.toScreen(10, 50)![1]).toBeCloseTo(H / 2, 3);
  });

  it('position() lands where toScreen() says', () => {
    const f = frame(6.5, t, 10, 50, 40, 30);
    for (const [lon, lat, alt] of [[10, 50, 0], [12, 51, 11000], [8, 49, 500]]) {
      const a = screenOf(f, f.position(lon, lat, alt));
      const b = f.toScreen(lon, lat, alt)!;
      expect(a[0]).toBeCloseTo(b[0], 3);
      expect(a[1]).toBeCloseTo(b[1], 3);
    }
  });

  it('north is up and east is right on the screen', () => {
    const f = frame(6.5, t);
    const c = f.toScreen(10, 50)!;
    const north = f.toScreen(10, 50.5)!;
    const east = f.toScreen(10.5, 50)!;
    expect(north[1]).toBeLessThan(c[1]);
    expect(east[0]).toBeGreaterThan(c[0]);
  });

  it('place() maps the model axes to east, north and up', () => {
    const f = frame(6.5, t);
    const m = f.place(new THREE.Matrix4(), 10, 50, 0, 90);
    const { east } = f.basis(10, 50);
    // heading 90°: the nose (model y) points east
    const nose = new THREE.Vector3(0, 1, 0).transformDirection(m);
    const dir = new THREE.Vector3(...east).normalize();
    expect(nose.dot(dir)).toBeCloseTo(1, 6);
  });

  it('metresPerPixel() fits the measured distance on the screen', () => {
    const f = frame(6.5, t);
    const c = f.toScreen(10, 50)!;
    // 1000 m east at the centre of the view
    const east = f.position(10, 50);
    const b = f.basis(10, 50).east;
    const p: [number, number, number] = [east[0] + b[0] * 1000, east[1] + b[1] * 1000, east[2] + b[2] * 1000];
    const px = Math.hypot(screenOf(f, p)[0] - c[0], screenOf(f, p)[1] - c[1]);
    expect(1000 / px / f.metresPerPixel(10, 50)).toBeCloseTo(1, 2);
  });
});

describe('the far side', () => {
  it('a point on the back of the globe is hidden, the front not', () => {
    const f = frame(2, 1);
    expect(f.occluded(10, 50)).toBe(false);
    expect(f.occluded(-170, -50)).toBe(true);
    expect(f.toScreen(-170, -50)).toBeNull();
  });

  it('a satellite beside the globe stays visible, right behind it not', () => {
    const f = frame(2, 1, 0, 0);
    expect(f.occluded(100, 0, 35786000)).toBe(false);
    expect(f.occluded(180, 0, 35786000)).toBe(true);
  });

  it('nothing is hidden on the flat map', () => {
    expect(frame(8, 0).occluded(-170, -50)).toBe(false);
  });

  it('sphereHides only looks at what is in front of the camera', () => {
    expect(sphereHides([0, 0, 3], [0, 0, 1])).toBe(false);
    expect(sphereHides([0, 0, 3], [0, 0, -1])).toBe(true);
    expect(sphereHides([0, 0, 3], [0, 0, 5])).toBe(false);
    expect(sphereHides([0, 0, 3], [5, 0, 0])).toBe(false);
  });
});

describe('the antimeridian', () => {
  it('a point across it stays next to the map centre on the flat map', () => {
    const f = frame(8, 0, 179.9, 0);
    const p = f.toScreen(-179.9, 0)!;
    expect(p[0]).toBeGreaterThan(W / 2);
    expect(p[0]).toBeLessThan(W);
  });
});

describe('precision', () => {
  it('a metre near the centre is representable as Float32 relative to the origin', () => {
    const f = frame(6.9, 1);
    const p = f.position(10.00001, 50.00001, 0);
    const delta = Math.hypot(p[0], p[1], p[2]);
    expect(delta).toBeGreaterThan(0);
    expect(Math.fround(delta) / delta).toBeCloseTo(1, 5);
  });
});
