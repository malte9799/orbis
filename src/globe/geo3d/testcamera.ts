import * as THREE from 'three';
import { GeoFrame, toMercator, type FrameInput } from './frame';

// The camera of MapLibre's VerticalPerspectiveTransform._calcMatrices and MercatorTransform, for tests.

export const W = 1000;
export const H = 800;
export const FOV = 0.6435011087932844; // MapLibre's default of 36.87°
export const TO_CENTRE = H / 2 / Math.tan(FOV / 2);

export function matrices(zoom: number, lng: number, lat: number, pitch = 0, bearing = 0, elevation = 0) {
  const r = (d: number) => (d * Math.PI) / 180;
  const worldSize = 512 * 2 ** zoom;
  const radius = worldSize / (2 * Math.PI) / Math.cos(r(lat));
  const persp = (far: number) => new THREE.Matrix4().set(
    (1 / Math.tan(FOV / 2)) * (H / W), 0, 0, 0,
    0, 1 / Math.tan(FOV / 2), 0, 0,
    0, 0, -(far + 0.5) / (far - 0.5), (-2 * far * 0.5) / (far - 0.5),
    0, 0, -1, 0,
  );
  const tilt = new THREE.Matrix4().makeTranslation(0, 0, -TO_CENTRE).multiply(new THREE.Matrix4().makeRotationX(-r(pitch))).multiply(new THREE.Matrix4().makeRotationZ(r(bearing)));
  // the globe camera does not look at the elevation, only the flat one does
  const globe = persp(TO_CENTRE + 2 * radius).multiply(tilt)
    .multiply(new THREE.Matrix4().makeTranslation(0, 0, -radius))
    .multiply(new THREE.Matrix4().makeRotationX(r(lat)))
    .multiply(new THREE.Matrix4().makeRotationY(-r(lng)))
    .multiply(new THREE.Matrix4().makeScale(radius, radius, radius));
  const [mx, my, mz] = toMercator(lng, lat, elevation);
  const merc = persp(TO_CENTRE * 4).multiply(tilt)
    .multiply(new THREE.Matrix4().makeScale(worldSize, -worldSize, worldSize))
    .multiply(new THREE.Matrix4().makeTranslation(-mx, -my, -mz));
  return { globe: globe.elements, merc: merc.elements };
}

export function frame(zoom: number, t: number, lng = 10, lat = 50, pitch = 0, bearing = 0, elevation = 0) {
  const m = matrices(zoom, lng, lat, pitch, bearing, elevation);
  const input: FrameInput = { mainMatrix: t > 0 ? m.globe : m.merc, fallbackMatrix: m.merc, transition: t, center: { lng, lat }, fov: FOV, width: W, height: H };
  return new GeoFrame(input);
}
