import * as THREE from 'three';
import { EARTH_RADIUS_M, toMercator, toUnit, type GeoFrame, type Vec3 } from './frame';
import type { GeoPart } from './stage';

// Thick line of constant pixel width through lon / lat / altitude. Each segment is a quad carrying both
// of its end points, on the sphere and in mercator: the vertex shader blends them like the map does
// and pushes the corners sideways in screen space. The globe hides it per pixel, so an orbit
// disappears exactly at the edge of the Earth.

/** Clip space position of a point given on the sphere and in mercator, the way the map blends the two. */
export const BLEND_GLSL = `
uniform mat4 uGlobe;
uniform mat4 uMerc;
uniform float uT;
vec4 blend(vec3 g, vec3 m) {
  if (uT >= 1.0) return uGlobe * vec4(g, 1.0);
  vec4 f = uMerc * vec4(m, 1.0);
  if (uT <= 0.0) return f;
  vec4 p = uGlobe * vec4(g, 1.0);
  vec4 r;
  r.xyw = mix(f.xyw, p.xyw, uT);
  r.z = p.z / p.w * r.w;
  return r;
}`;

/** Is the globe between the camera and this point (relative to the anchor)? */
export const BEHIND_GLOBE_GLSL = `
uniform float uHide;
uniform vec3 uCam;
uniform vec3 uCentre;
bool behindGlobe(vec3 p) {
  if (uHide < 0.5) return false;
  vec3 d = p - uCam;
  vec3 o = uCam - uCentre;
  float a = dot(d, d);
  float b = 2.0 * dot(o, d);
  float disc = b * b - 4.0 * a * (dot(o, o) - 1.0);
  if (disc <= 0.0) return false;
  float t = (-b - sqrt(disc)) / (2.0 * a);
  // the tolerance keeps lines on the surface
  return t > 0.0 && t < 0.9998;
}`;

/** The uniforms of BLEND_GLSL and BEHIND_GLOBE_GLSL. */
export const anchorUniforms = () => ({
  uGlobe: { value: new THREE.Matrix4() },
  uMerc: { value: new THREE.Matrix4() },
  uT: { value: 1 },
  uHide: { value: 1 },
  uCam: { value: new THREE.Vector3() },
  uCentre: { value: new THREE.Vector3() },
});

const translate = new THREE.Matrix4();
const deg = (r: number) => (r * 180) / Math.PI;

/** Sets those uniforms for geometry given relative to an anchor, lifted by `liftM` (terrain below the anchor). */
export function setAnchor(u: ReturnType<typeof anchorUniforms>, frame: GeoFrame, unit: Vec3, merc: Vec3, liftM = 0) {
  u.uT.value = frame.t;
  u.uHide.value = frame.globe ? 1 : 0;
  const k = 1 + liftM / EARTH_RADIUS_M;
  const [ax, ay, az] = [unit[0] * k, unit[1] * k, unit[2] * k];
  u.uGlobe.value.copy(frame.globeMatrix).multiply(translate.makeTranslation(ax, ay, az));
  // in the copy of the world next to the map centre
  u.uMerc.value.copy(frame.mercMatrix).multiply(translate.makeTranslation(merc[0] + frame.worldCopy(merc[0]), merc[1], merc[2] + toMercator(0, deg(Math.asin(unit[1] / Math.hypot(unit[0], unit[1], unit[2]))), liftM)[2]));
  u.uCam.value.set(frame.camera[0] - ax, frame.camera[1] - ay, frame.camera[2] - az);
  u.uCentre.value.set(-ax, -ay, -az);
}

const VERTEX = `
attribute vec3 aGlobeStart;
attribute vec3 aGlobeEnd;
attribute vec3 aMercStart;
attribute vec3 aMercEnd;
attribute vec2 aCorner;
attribute vec2 aAlong;
attribute vec2 aTime; // time of start / end (end < 0: the moving head = now)
uniform vec2 uRes;
uniform float uWidth;
uniform float uNow;
uniform float uFade; // 0: no fading
varying vec3 vSphere;
varying float vAlong;
varying float vFade;
${BLEND_GLSL}
void main() {
  vec4 cs = blend(aGlobeStart, aMercStart);
  vec4 ce = blend(aGlobeEnd, aMercEnd);
  vSphere = mix(aGlobeStart, aGlobeEnd, aCorner.x);
  vAlong = mix(aAlong.x, aAlong.y, aCorner.x);
  float te = aTime.y < 0.0 ? uNow : aTime.y;
  vFade = uFade > 0.0 ? clamp(1.0 - (uNow - mix(aTime.x, te, aCorner.x)) / uFade, 0.0, 1.0) : 1.0;
  if (cs.w <= 0.0 || ce.w <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vec2 d = (ce.xy / ce.w - cs.xy / cs.w) * uRes;
  float len = length(d);
  vec2 dir = len > 0.0001 ? d / len : vec2(1.0, 0.0);
  vec4 c = mix(cs, ce, aCorner.x);
  c.xy += vec2(-dir.y, dir.x) * aCorner.y * uWidth / uRes * c.w;
  gl_Position = c;
}`;
const FRAGMENT = `
uniform vec3 uColor;
uniform float uOpacity;
uniform vec2 uDash; // period in metres, share of it that is drawn; 0: solid
varying vec3 vSphere;
varying float vAlong;
varying float vFade;
${BEHIND_GLOBE_GLSL}
void main() {
  if (uDash.x > 0.0 && mod(vAlong, uDash.x) > uDash.x * uDash.y) discard;
  if (behindGlobe(vSphere)) discard;
  gl_FragColor = vec4(uColor, uOpacity * vFade);
  #include <colorspace_fragment>
}`;

export interface GeoLineOptions {
  color: string;
  /** CSS pixels */
  width: number;
  opacity?: number;
  /** only makes sense in 3D (orbits): fades out with the globe instead of being flattened onto the map */
  globeOnly?: boolean;
  /** lies on the ground on the flat map: seen from a low camera a bow high in the air is of no use */
  groundOnFlat?: boolean;
  /** [on, off] in line widths, like line-dasharray */
  dash?: [number, number];
  /** a point has faded out this long after its time (ms) */
  fadeMs?: number;
}

function segmentDistance(x: number, y: number, a: [number, number], b: [number, number]) {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const t = dx || dy ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
}

export class GeoLine implements GeoPart {
  readonly object: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private globeAnchor: Vec3 = [0, 0, 1];
  private mercAnchor: Vec3 = [0, 0, 0];
  private opacity: number;
  private globeOnly: boolean;
  private groundOnFlat: boolean;
  private dash: [number, number] | null;
  private points: Vec3[] = [];
  private segs = -1;
  /** CSS pixels */
  private cssWidth: number;

  /** `points`: [lon, lat, altitude m] with longitudes continuous along the line (no jump at ±180°). */
  constructor(points: Vec3[], opts: GeoLineOptions) {
    this.opacity = opts.opacity ?? 1;
    this.globeOnly = !!opts.globeOnly;
    this.groundOnFlat = !!opts.groundOnFlat;
    this.dash = opts.dash ?? null;
    this.cssWidth = opts.width;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        ...anchorUniforms(),
        uRes: { value: new THREE.Vector2(1, 1) },
        uWidth: { value: opts.width },
        uColor: { value: new THREE.Color(opts.color) },
        uOpacity: { value: this.opacity },
        uDash: { value: new THREE.Vector2() },
        uNow: { value: 0 },
        uFade: { value: opts.fadeMs ?? 0 },
      },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.object = new THREE.Mesh(new THREE.BufferGeometry(), this.mat);
    this.object.matrixAutoUpdate = false;
    this.object.frustumCulled = false;
    this.object.renderOrder = 2;
    if (points.length > 1) this.setPoints(points);
  }

  private flatAlt(alt: number) {
    return this.groundOnFlat ? 0 : alt;
  }

  /**
   * The whole line anew. `times`: per point, for the fading; -1 at the last one: its time is always now.
   * `anchor`: where it has to be exact when zoomed in, by default the first point.
   */
  setPoints(points: Vec3[], times?: number[], anchor: Vec3 = points[0]) {
    this.points = points;
    this.globeAnchor = toUnit(anchor[0], anchor[1], anchor[2]);
    this.mercAnchor = toMercator(anchor[0], anchor[1], this.flatAlt(anchor[2]));
    const segs = points.length - 1;
    const g = this.segs === segs ? this.object.geometry : this.buildGeometry(segs);
    const attr = (name: string) => g.getAttribute(name) as THREE.BufferAttribute;
    const [gs, ge, ms, me, along, time] = ['aGlobeStart', 'aGlobeEnd', 'aMercStart', 'aMercEnd', 'aAlong', 'aTime'].map(attr);
    const globe = points.map((p) => this.relGlobe(p));
    const merc = points.map((p) => this.relMerc(p));
    let metres = 0;
    for (let i = 0; i < segs; i++) {
      const [a, b] = [globe[i], globe[i + 1]];
      const next = metres + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) * EARTH_RADIUS_M;
      for (let v = 0; v < 4; v++) {
        const at = i * 4 + v;
        gs.setXYZ(at, a[0], a[1], a[2]);
        ge.setXYZ(at, b[0], b[1], b[2]);
        ms.setXYZ(at, merc[i][0], merc[i][1], merc[i][2]);
        me.setXYZ(at, merc[i + 1][0], merc[i + 1][1], merc[i + 1][2]);
        along.setXY(at, metres, next);
        if (times) time.setXY(at, times[i], times[i + 1]);
      }
      metres = next;
    }
    for (const a of [gs, ge, ms, me, along, time]) a.needsUpdate = true;
  }

  private relGlobe(p: Vec3): Vec3 {
    const u = toUnit(p[0], p[1], p[2]);
    const a = this.globeAnchor;
    return [u[0] - a[0], u[1] - a[1], u[2] - a[2]];
  }

  private relMerc(p: Vec3): Vec3 {
    const m = toMercator(p[0], p[1], this.flatAlt(p[2]));
    const a = this.mercAnchor;
    return [m[0] - a[0], m[1] - a[1], m[2] - a[2]];
  }

  private buildGeometry(segs: number) {
    this.object.geometry.dispose();
    this.segs = segs;
    const g = new THREE.BufferGeometry();
    const attr = (n: number) => new THREE.BufferAttribute(new Float32Array(segs * 4 * n), n).setUsage(THREE.DynamicDrawUsage);
    const start = attr(3);
    g.setAttribute('position', start);
    g.setAttribute('aGlobeStart', start);
    g.setAttribute('aGlobeEnd', attr(3));
    g.setAttribute('aMercStart', attr(3));
    g.setAttribute('aMercEnd', attr(3));
    g.setAttribute('aAlong', attr(2));
    g.setAttribute('aTime', attr(2));
    const corner = new Float32Array(segs * 8);
    const index = new Uint32Array(segs * 6);
    for (let i = 0; i < segs; i++) {
      for (let v = 0; v < 4; v++) corner.set([v >> 1, v & 1 ? 1 : -1], (i * 4 + v) * 2);
      index.set([0, 1, 2, 2, 1, 3].map((k) => i * 4 + k), i * 6);
    }
    g.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2));
    g.setIndex(new THREE.BufferAttribute(index, 1));
    this.object.geometry = g;
    return g;
  }

  /** Moves the last point (the moving head of a trail); cheap enough for every frame. */
  setHead(p: Vec3) {
    const n = this.points.length;
    if (n < 2) return;
    this.points[n - 1] = p;
    const g = this.object.geometry;
    const [u, m] = [this.relGlobe(p), this.relMerc(p)];
    const ge = g.getAttribute('aGlobeEnd') as THREE.BufferAttribute;
    const me = g.getAttribute('aMercEnd') as THREE.BufferAttribute;
    const first = (n - 2) * 4;
    for (let v = 0; v < 4; v++) {
      ge.setXYZ(first + v, u[0], u[1], u[2]);
      me.setXYZ(first + v, m[0], m[1], m[2]);
    }
    ge.needsUpdate = me.needsUpdate = true;
  }

  /** `liftM`: the whole line this much higher (terrain below it). */
  update(frame: GeoFrame, now = 0, liftM = 0) {
    const u = this.mat.uniforms;
    this.object.visible = this.segs > 0 && (!this.globeOnly || frame.globe);
    u.uNow.value = now;
    u.uOpacity.value = this.opacity * (this.globeOnly ? frame.t : 1);
    const canvas = frame.pixels;
    u.uRes.value.set(canvas[0], canvas[1]);
    u.uWidth.value = this.cssWidth * (canvas[0] / frame.width);
    if (this.dash) {
      const [on, off] = this.dash;
      // the dashes follow the line, at the size of the pixels in the middle of the view
      u.uDash.value.set((on + off) * this.cssWidth * frame.centreMetresPerPixel, on / (on + off));
    }
    setAnchor(u as unknown as ReturnType<typeof anchorUniforms>, frame, this.globeAnchor, this.mercAnchor, liftM);
  }

  setWidth(px: number) {
    this.cssWidth = px;
  }

  setOpacity(opacity: number) {
    this.opacity = opacity;
  }

  setFade(ms: number) {
    this.mat.uniforms.uFade.value = ms;
  }

  /** Distance from a screen point to the visible part of the line (CSS px), Infinity if there is none. */
  distanceTo(frame: GeoFrame, x: number, y: number): number {
    let best = Infinity;
    if (!this.object.visible) return best;
    // a bow comes down while the map flattens
    const lift = this.groundOnFlat ? frame.t : 1;
    let prev: [number, number] | null = null;
    for (const p of this.points) {
      const s = frame.toScreen(p[0], p[1], p[2] * lift);
      if (s && prev) best = Math.min(best, segmentDistance(x, y, prev, s));
      prev = s;
    }
    return best;
  }

  dispose() {
    this.object.geometry.dispose();
    this.mat.dispose();
  }
}
