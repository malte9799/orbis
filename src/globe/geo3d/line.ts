import * as THREE from 'three';
import { toMercator, toUnit, type GeoFrame, type Vec3 } from './frame';
import type { GeoPart } from './stage';

// Thick line of constant pixel width through lon / lat / altitude. Each segment is a quad carrying both
// of its end points, on the sphere and in mercator: the vertex shader blends them like the map does
// and pushes the corners sideways in screen space. The globe hides it per pixel, so an orbit
// disappears exactly at the edge of the Earth.

const VERTEX = `
attribute vec3 aGlobeStart;
attribute vec3 aGlobeEnd;
attribute vec3 aMercStart;
attribute vec3 aMercEnd;
attribute vec2 aCorner;
uniform mat4 uGlobe;
uniform mat4 uMerc;
uniform float uT;
uniform vec2 uRes;
uniform float uWidth;
varying vec3 vSphere;
vec4 blend(vec3 g, vec3 m) {
  if (uT >= 1.0) return uGlobe * vec4(g, 1.0);
  vec4 f = uMerc * vec4(m, 1.0);
  if (uT <= 0.0) return f;
  vec4 p = uGlobe * vec4(g, 1.0);
  vec4 r;
  r.xyw = mix(f.xyw, p.xyw, uT);
  r.z = p.z / p.w * r.w;
  return r;
}
void main() {
  vec4 cs = blend(aGlobeStart, aMercStart);
  vec4 ce = blend(aGlobeEnd, aMercEnd);
  vSphere = mix(aGlobeStart, aGlobeEnd, aCorner.x);
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
uniform float uHide;
uniform vec3 uCam;
uniform vec3 uCentre;
varying vec3 vSphere;
void main() {
  if (uHide > 0.5) {
    // the ray from the camera enters the unit sphere before it gets here; the tolerance keeps lines on the surface
    vec3 d = vSphere - uCam;
    vec3 o = uCam - uCentre;
    float a = dot(d, d);
    float b = 2.0 * dot(o, d);
    float disc = b * b - 4.0 * a * (dot(o, o) - 1.0);
    if (disc > 0.0) {
      float t = (-b - sqrt(disc)) / (2.0 * a);
      if (t > 0.0 && t < 0.9998) discard;
    }
  }
  gl_FragColor = vec4(uColor, uOpacity);
  #include <colorspace_fragment>
}`;

export interface GeoLineOptions {
  color: string;
  /** CSS pixels */
  width: number;
  opacity?: number;
  /** only makes sense in 3D (orbits): fades out with the globe instead of being flattened onto the map */
  globeOnly?: boolean;
}

export class GeoLine implements GeoPart {
  readonly object: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private globeAnchor: Vec3;
  private mercAnchor: Vec3;
  private opacity: number;
  private globeOnly: boolean;
  private m = new THREE.Matrix4();

  /** `points`: [lon, lat, altitude m] with longitudes continuous along the line (no jump at ±180°). */
  constructor(points: Vec3[], opts: GeoLineOptions) {
    this.opacity = opts.opacity ?? 1;
    this.globeOnly = !!opts.globeOnly;
    this.globeAnchor = toUnit(points[0][0], points[0][1], points[0][2]);
    this.mercAnchor = toMercator(points[0][0], points[0][1], points[0][2]);
    const rel = (p: Vec3, a: Vec3): Vec3 => [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
    const globe = points.map((p) => rel(toUnit(p[0], p[1], p[2]), this.globeAnchor));
    const merc = points.map((p) => rel(toMercator(p[0], p[1], p[2]), this.mercAnchor));
    const segs = points.length - 1;
    const attr = (n: number) => new Float32Array(segs * 4 * n);
    const [gs, ge, ms, me, corner] = [attr(3), attr(3), attr(3), attr(3), attr(2)];
    const index = new Uint32Array(segs * 6);
    for (let i = 0; i < segs; i++) {
      for (let v = 0; v < 4; v++) {
        const at = i * 4 + v;
        gs.set(globe[i], at * 3);
        ge.set(globe[i + 1], at * 3);
        ms.set(merc[i], at * 3);
        me.set(merc[i + 1], at * 3);
        corner.set([v >> 1, v & 1 ? 1 : -1], at * 2);
      }
      index.set([0, 1, 2, 2, 1, 3].map((k) => i * 4 + k), i * 6);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(gs, 3));
    g.setAttribute('aGlobeStart', new THREE.BufferAttribute(gs, 3));
    g.setAttribute('aGlobeEnd', new THREE.BufferAttribute(ge, 3));
    g.setAttribute('aMercStart', new THREE.BufferAttribute(ms, 3));
    g.setAttribute('aMercEnd', new THREE.BufferAttribute(me, 3));
    g.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2));
    g.setIndex(new THREE.BufferAttribute(index, 1));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        uGlobe: { value: new THREE.Matrix4() },
        uMerc: { value: new THREE.Matrix4() },
        uT: { value: 1 },
        uRes: { value: new THREE.Vector2(1, 1) },
        uWidth: { value: opts.width * (window.devicePixelRatio || 1) },
        uColor: { value: new THREE.Color(opts.color) },
        uOpacity: { value: this.opacity },
        uHide: { value: 1 },
        uCam: { value: new THREE.Vector3() },
        uCentre: { value: new THREE.Vector3() },
      },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.object = new THREE.Mesh(g, this.mat);
    this.object.matrixAutoUpdate = false;
    this.object.frustumCulled = false;
    this.object.renderOrder = 2;
  }

  update(frame: GeoFrame) {
    const u = this.mat.uniforms;
    this.object.visible = !this.globeOnly || frame.globe;
    u.uT.value = frame.t;
    u.uHide.value = frame.globe ? 1 : 0;
    u.uOpacity.value = this.opacity * (this.globeOnly ? frame.t : 1);
    const canvas = frame.pixels;
    u.uRes.value.set(canvas[0], canvas[1]);
    const a = this.globeAnchor;
    u.uGlobe.value.copy(frame.globeMatrix).multiply(this.m.makeTranslation(a[0], a[1], a[2]));
    // the line stays in the copy of the world next to the map centre
    const b = this.mercAnchor;
    u.uMerc.value.copy(frame.mercMatrix).multiply(this.m.makeTranslation(b[0] + frame.worldCopy(b[0]), b[1], b[2]));
    u.uCam.value.set(frame.camera[0] - a[0], frame.camera[1] - a[1], frame.camera[2] - a[2]);
    u.uCentre.value.set(-a[0], -a[1], -a[2]);
  }

  dispose() {
    this.object.geometry.dispose();
    this.mat.dispose();
  }
}
