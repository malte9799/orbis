import * as THREE from 'three';

// Where things are on screen this frame, for globe, flat map and the blend between them. Objects
// are placed by lon / lat / altitude only, never in projection coordinates.
//
// Render space: the globe draws a unit sphere (x = sin lng cos lat, y = sin lat, z = cos lng cos lat),
// the flat map the mercator square 0..1. Everything is placed relative to the map centre, computed in
// double precision here: the GPU only sees small numbers, so nothing jitters (Float32 at a world
// coordinate of about 1 cannot resolve a metre).

/** the sphere MapLibre draws (GLOBE_RADIUS in its shaders) */
export const EARTH_RADIUS_M = 6371008.8;
const CIRCUMFERENCE_M = 2 * Math.PI * EARTH_RADIUS_M;
/** the depth range must reach beyond the geostationary orbit (6.6 radii), also behind the globe */
const FAR_RADII = 8;
const NEAR_SHARE = 0.01;
const MAX_MERCATOR_LAT = 85.051129;
/** near enough for a name: up to this far, compared with the distance from the camera to the map centre */
const NEAR_SHARE_OF_CENTRE = 1.5;

const rad = (d: number) => (d * Math.PI) / 180;

export type Vec3 = [number, number, number];

/** What a custom layer gets from MapLibre plus the size of the map. */
export interface FrameInput {
  /** unit sphere → clip space while the globe is drawn, otherwise mercator → clip space */
  mainMatrix: ArrayLike<number>;
  /** mercator → clip space */
  fallbackMatrix: ArrayLike<number>;
  /** 1: globe, 0: flat map, in between: MapLibre blends the two */
  transition: number;
  center: { lng: number; lat: number };
  /** vertical field of view (radians) */
  fov: number;
  /** size of the map in CSS pixels */
  width: number;
  height: number;
  /** device pixels per CSS pixel */
  ratio?: number;
}

/** Unit vector on the sphere, times (1 + altitude / radius). */
export function toUnit(lon: number, lat: number, altM = 0): Vec3 {
  const cos = Math.cos(rad(lat));
  const k = 1 + altM / EARTH_RADIUS_M;
  return [Math.sin(rad(lon)) * cos * k, Math.sin(rad(lat)) * k, Math.cos(rad(lon)) * cos * k];
}

/** Mercator coordinates like MapLibre's MercatorCoordinate; z is conformal to x and y at that latitude. */
export function toMercator(lon: number, lat: number, altM = 0): Vec3 {
  const l = Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, lat));
  return [(180 + lon) / 360, (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (l * Math.PI) / 360))) / 360, altM / (CIRCUMFERENCE_M * Math.cos(rad(l)))];
}

/** Pulls the depth planes of a perspective matrix to `near` / `far` (same pixels, same x, y and w). */
export function withDepthRange(m: THREE.Matrix4, near: number, far: number): THREE.Matrix4 {
  // z_clip = a * w_clip + b, as w_clip is the distance from the camera in front of it
  const a = (far + near) / (far - near);
  const b = (-2 * far * near) / (far - near);
  const e = m.elements;
  e[2] = a * e[3];
  e[6] = a * e[7];
  e[10] = a * e[11];
  e[14] = a * e[15] + b;
  return m;
}

export class GeoFrame {
  /** 1: globe, 0: flat map */
  readonly t: number;
  readonly globe: boolean;
  /** render space → clip space, centre at the origin; goes into the camera of the scene */
  readonly proj = new THREE.Matrix4();
  /** unit sphere → clip space with the longer depth range (only meaningful while `globe`) */
  readonly globeMatrix = new THREE.Matrix4();
  /** mercator → clip space */
  readonly mercMatrix = new THREE.Matrix4();
  /** the object the camera follows [lon, lat, altitude m]: what is near is measured from there */
  nearPoint: Vec3 | null = null;
  /** camera position on the unit sphere's scale (only meaningful while `globe`) */
  readonly camera: Vec3 = [0, 0, 0];
  /** the map centre in render space */
  readonly origin: Vec3;
  readonly width: number;
  readonly height: number;
  private readonly ratio: number;
  private readonly lng: number;
  private readonly lat: number;
  /** the distance (w) at which one view unit is one CSS pixel: camera to map centre */
  readonly pxDistance: number;
  /** view units per render unit */
  private readonly unitPx: number;
  private readonly inverse = new THREE.Matrix4();

  constructor(input: FrameInput) {
    this.t = input.transition;
    this.globe = input.transition > 0;
    this.width = input.width;
    this.height = input.height;
    this.ratio = input.ratio ?? 1;
    this.lng = input.center.lng;
    this.lat = input.center.lat;
    this.pxDistance = input.height / 2 / Math.tan(input.fov / 2);
    this.mercMatrix.fromArray(this.globe ? (input.fallbackMatrix as number[]) : (input.mainMatrix as number[]));
    const main = new THREE.Matrix4().fromArray(input.mainMatrix as number[]);
    // the last row is the view direction scaled by the size of a render unit
    const e = main.elements;
    this.unitPx = Math.hypot(e[3], e[7], e[11]);
    if (this.globe) {
      // MapLibre's far plane ends right behind the globe and its depth buffer holds no real depth
      // there, see stage.ts: a depth range of our own that also takes in the orbits
      const toCentre = e[15];
      this.globeMatrix.copy(main);
      withDepthRange(this.globeMatrix, Math.max(0.5, (toCentre - this.unitPx) * NEAR_SHARE), toCentre + FAR_RADII * this.unitPx);
      this.inverse.copy(this.globeMatrix).invert();
      // the camera is the point that projects to w = 0 at the centre of the screen
      const c = new THREE.Vector4(0, 0, 1, 0).applyMatrix4(this.inverse);
      this.camera[0] = c.x / c.w;
      this.camera[1] = c.y / c.w;
      this.camera[2] = c.z / c.w;
      this.origin = toUnit(input.center.lng, input.center.lat);
      this.proj.copy(this.globeMatrix);
    } else {
      this.origin = toMercator(input.center.lng, input.center.lat);
      this.proj.copy(this.mercMatrix);
    }
    this.proj.multiply(new THREE.Matrix4().makeTranslation(this.origin[0], this.origin[1], this.origin[2]));
  }

  /** Size of the drawing buffer in device pixels. */
  get pixels(): [number, number] {
    return [this.width * this.ratio, this.height * this.ratio];
  }

  /** Whole worlds to add to a mercator x to get next to the map centre. */
  worldCopy(mercX: number) {
    return Math.round((this.lng + 180) / 360 - mercX);
  }

  /** The longitude next to the map centre (a mercator x must not jump across the antimeridian). */
  private near(lon: number) {
    return lon + 360 * Math.round((this.lng - lon) / 360);
  }

  /** Clip space position of a point, the way the map blends it. */
  private clip(lon: number, lat: number, altM: number, out = new THREE.Vector4()): THREE.Vector4 {
    const [mx, my, mz] = toMercator(this.near(lon), lat, altM);
    if (!this.globe) return out.set(mx, my, mz, 1).applyMatrix4(this.mercMatrix);
    const [ux, uy, uz] = toUnit(lon, lat, altM);
    out.set(ux, uy, uz, 1).applyMatrix4(this.globeMatrix);
    if (this.t >= 1) return out;
    // same formula as interpolateProjection in MapLibre's globe shader; the depth stays the globe's
    const f = new THREE.Vector4(mx, my, mz, 1).applyMatrix4(this.mercMatrix);
    const ndcZ = out.z / out.w;
    out.x = f.x + (out.x - f.x) * this.t;
    out.y = f.y + (out.y - f.y) * this.t;
    out.w = f.w + (out.w - f.w) * this.t;
    out.z = ndcZ * out.w;
    return out;
  }

  /**
   * The point of render space (relative to the origin) that lands on the screen where the map shows
   * lon / lat / altitude. During the blend that point is on neither the sphere nor the square.
   */
  position(lon: number, lat: number, altM = 0): Vec3 {
    if (!this.globe) {
      const m = toMercator(this.near(lon), lat, altM);
      return [m[0] - this.origin[0], m[1] - this.origin[1], m[2] - this.origin[2]];
    }
    if (this.t >= 1) {
      const u = toUnit(lon, lat, altM);
      return [u[0] - this.origin[0], u[1] - this.origin[1], u[2] - this.origin[2]];
    }
    const p = this.clip(lon, lat, altM).applyMatrix4(this.inverse);
    return [p.x / p.w - this.origin[0], p.y / p.w - this.origin[1], p.z / p.w - this.origin[2]];
  }

  /** East, north and up at a place in render space, each one metre long. */
  basis(lon: number, lat: number): { east: Vec3; north: Vec3; up: Vec3 } {
    const [sinLo, cosLo, sinLa, cosLa] = [Math.sin(rad(lon)), Math.cos(rad(lon)), Math.sin(rad(lat)), Math.cos(rad(lat))];
    if (this.globe) {
      const k = 1 / EARTH_RADIUS_M;
      return { east: [cosLo * k, 0, -sinLo * k], north: [-sinLa * sinLo * k, cosLa * k, -sinLa * cosLo * k], up: [sinLo * cosLa * k, sinLa * k, cosLo * cosLa * k] };
    }
    // south is +y in mercator
    const k = 1 / (CIRCUMFERENCE_M * Math.max(cosLa, Math.cos(rad(MAX_MERCATOR_LAT))));
    return { east: [k, 0, 0], north: [0, -k, 0], up: [0, 0, k] };
  }

  /**
   * Model matrix for an object in metres (x east, y nose, z up) at a place. `heading` in degrees from
   * north; `scale` stretches the metres, e.g. `Math.max(1, minPx * metresPerPixel / length)`.
   */
  place(out: THREE.Matrix4, lon: number, lat: number, altM: number, heading = 0, scale = 1): THREE.Matrix4 {
    const p = this.position(lon, lat, altM);
    const { east: e, north: n, up: u } = this.basis(lon, lat);
    const [s, c] = [Math.sin(rad(heading)) * scale, Math.cos(rad(heading)) * scale];
    // model x = c * east - s * north, model y = s * east + c * north
    return out.set(
      c * e[0] - s * n[0], s * e[0] + c * n[0], u[0] * scale, p[0],
      c * e[1] - s * n[1], s * e[1] + c * n[1], u[1] * scale, p[1],
      c * e[2] - s * n[2], s * e[2] + c * n[2], u[2] * scale, p[2],
      0, 0, 0, 1,
    );
  }

  /** Metres covered by one CSS pixel at a place, across the line of sight (also true at the horizon and in orbit). */
  metresPerPixel(lon: number, lat: number, altM = 0): number {
    const w = Math.abs(this.clip(lon, lat, altM).w);
    const unitM = this.globe ? EARTH_RADIUS_M : CIRCUMFERENCE_M * Math.cos(rad(Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, lat))));
    return (w / this.pxDistance) * (unitM / this.unitPx);
  }

  /** Metres covered by one CSS pixel at the map centre. */
  get centreMetresPerPixel(): number {
    return this.metresPerPixel(this.lng, this.lat);
  }

  /**
   * Near enough for a name? With a flat view the whole horizon is in sight, so only what is near gets one:
   * near the camera, or near the object the camera follows. `share`: how far, compared with the camera's
   * distance to the map centre or to that object.
   */
  isNear(lon: number, lat: number, altM = 0, share = NEAR_SHARE_OF_CENTRE): boolean {
    const from = this.nearPoint;
    if (!from) return this.metresPerPixel(lon, lat, altM) <= this.centreMetresPerPixel * share;
    const [a, b] = [toUnit(lon, lat, altM), toUnit(from[0], from[1], from[2])];
    const metres = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) * EARTH_RADIUS_M;
    return metres <= this.pxDistance * this.metresPerPixel(from[0], from[1], from[2]) * share;
  }

  /** Is the globe in the way between the camera and this point? */
  occluded(lon: number, lat: number, altM = 0): boolean {
    if (!this.globe) return false;
    return sphereHides(this.camera, toUnit(lon, lat, altM));
  }

  /** Position in CSS pixels of a point on the unit sphere's scale, on the globe; null behind the camera. The globe is not asked. */
  unitToScreen(x: number, y: number, z: number): [number, number] | null {
    const e = this.globeMatrix.elements;
    const w = e[3] * x + e[7] * y + e[11] * z + e[15];
    if (w <= 0) return null;
    const cx = e[0] * x + e[4] * y + e[8] * z + e[12];
    const cy = e[1] * x + e[5] * y + e[9] * z + e[13];
    return [(cx / w * 0.5 + 0.5) * this.width, (1 - (cy / w * 0.5 + 0.5)) * this.height];
  }

  /** Position in CSS pixels; null behind the camera or behind the globe. */
  toScreen(lon: number, lat: number, altM = 0): [number, number] | null {
    if (this.occluded(lon, lat, altM)) return null;
    const c = this.clip(lon, lat, altM);
    if (c.w <= 0) return null;
    return [(c.x / c.w * 0.5 + 0.5) * this.width, (1 - (c.y / c.w * 0.5 + 0.5)) * this.height];
  }
}

/** Does the ray from `camera` to `p` enter the unit sphere before it reaches `p`? */
export function sphereHides(camera: Vec3, p: Vec3): boolean {
  const d = [p[0] - camera[0], p[1] - camera[1], p[2] - camera[2]];
  const a = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
  const b = 2 * (camera[0] * d[0] + camera[1] * d[1] + camera[2] * d[2]);
  const c = camera[0] * camera[0] + camera[1] * camera[1] + camera[2] * camera[2] - 1;
  const disc = b * b - 4 * a * c;
  if (disc <= 0) return false;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  // t = 1 is a point right on the surface: a metre of tolerance keeps it visible
  return t > 0 && t < 1 - 2e-7;
}
