import * as THREE from 'three';
import { toMercator, toUnit, type GeoFrame, type Vec3 } from './frame';
import { anchorUniforms, BEHIND_GLOBE_GLSL, BLEND_GLSL, setAnchor } from './line';

// A faint curtain from a line down to the ground: two triangles per segment, on the sphere and in mercator.
// It fades with the height and, like the line above it, with the age of its points.

const VERTEX = `
attribute vec3 aMerc;
attribute float aTime; // < 0: the moving head = now
attribute float aAlt;
uniform float uNow;
uniform float uFade; // 0: no fading
uniform float uFull; // full below this altitude, gone above uGone
uniform float uGone;
varying vec3 vSphere;
varying float vFade;
${BLEND_GLSL}
void main() {
  vSphere = position;
  float t = aTime < 0.0 ? uNow : aTime;
  vFade = uFade > 0.0 ? clamp(1.0 - (uNow - t) / uFade, 0.0, 1.0) : 1.0;
  vFade *= 1.0 - smoothstep(uFull, uGone, aAlt);
  gl_Position = blend(position, aMerc);
}`;
const FRAGMENT = `
uniform vec3 uColor;
uniform float uOpacity;
varying vec3 vSphere;
varying float vFade;
${BEHIND_GLOBE_GLSL}
void main() {
  if (behindGlobe(vSphere)) discard;
  gl_FragColor = vec4(uColor, uOpacity * vFade);
  #include <colorspace_fragment>
}`;

export interface GeoWallOptions {
  color: string;
  /** full below this altitude, gone above `goneM` */
  fullM: number;
  goneM: number;
}

export class GeoWall {
  readonly object: THREE.Mesh;
  private mat: THREE.ShaderMaterial;
  private globeAnchor: Vec3 = [0, 0, 1];
  private mercAnchor: Vec3 = [0, 0, 0];
  private count = 0;

  constructor(opts: GeoWallOptions) {
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      uniforms: {
        ...anchorUniforms(),
        uColor: { value: new THREE.Color(opts.color) },
        uOpacity: { value: 1 },
        uNow: { value: 0 },
        uFade: { value: 0 },
        uFull: { value: opts.fullM },
        uGone: { value: opts.goneM },
      },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.object = new THREE.Mesh(new THREE.BufferGeometry(), this.mat);
    this.object.matrixAutoUpdate = false;
    this.object.frustumCulled = false;
    this.object.renderOrder = 1;
  }

  /** `points`: the top edge; `times`: per point, -1 at the last one. */
  setPoints(points: Vec3[], times: number[]) {
    this.count = points.length;
    this.globeAnchor = toUnit(points[0][0], points[0][1], points[0][2]);
    this.mercAnchor = toMercator(points[0][0], points[0][1], points[0][2]);
    const segs = points.length - 1;
    const [pos, merc, time, alt] = [new Float32Array(segs * 18), new Float32Array(segs * 18), new Float32Array(segs * 6), new Float32Array(segs * 6)];
    for (let i = 0; i < segs; i++) {
      const [a, b] = [points[i], points[i + 1]];
      const verts: [Vec3, number][] = [
        [a, times[i]],
        [b, times[i + 1]],
        [[a[0], a[1], 0], times[i]],
        [b, times[i + 1]],
        [[b[0], b[1], 0], times[i + 1]],
        [[a[0], a[1], 0], times[i]],
      ];
      verts.forEach(([p, t], v) => this.write(pos, merc, i * 6 + v, p, time, t, alt));
    }
    this.object.geometry.dispose();
    this.object.geometry = new THREE.BufferGeometry()
      .setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage))
      .setAttribute('aMerc', new THREE.BufferAttribute(merc, 3).setUsage(THREE.DynamicDrawUsage))
      .setAttribute('aTime', new THREE.BufferAttribute(time, 1))
      .setAttribute('aAlt', new THREE.BufferAttribute(alt, 1).setUsage(THREE.DynamicDrawUsage));
  }

  private write(pos: Float32Array, merc: Float32Array, at: number, p: Vec3, time: Float32Array, t: number, alt: Float32Array) {
    const u = toUnit(p[0], p[1], p[2]);
    const m = toMercator(p[0], p[1], p[2]);
    for (let k = 0; k < 3; k++) {
      pos[at * 3 + k] = u[k] - this.globeAnchor[k];
      merc[at * 3 + k] = m[k] - this.mercAnchor[k];
    }
    time[at] = t;
    alt[at] = p[2];
  }

  /** Moves the last point of the top edge. */
  setHead(p: Vec3) {
    if (this.count < 2) return;
    const g = this.object.geometry;
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const merc = g.getAttribute('aMerc') as THREE.BufferAttribute;
    const alt = g.getAttribute('aAlt') as THREE.BufferAttribute;
    const time = g.getAttribute('aTime') as THREE.BufferAttribute;
    const first = (this.count - 2) * 6;
    // vertices of the last segment that belong to the head: its top twice, its foot once
    for (const [v, a] of [[1, p[2]], [3, p[2]], [4, 0]] as const) {
      const here: Vec3 = [p[0], p[1], a];
      this.write(pos.array as Float32Array, merc.array as Float32Array, first + v, here, time.array as Float32Array, -1, alt.array as Float32Array);
    }
    pos.needsUpdate = merc.needsUpdate = alt.needsUpdate = true;
  }

  setStyle(opacity: number, fadeMs: number) {
    this.mat.uniforms.uOpacity.value = opacity;
    this.mat.uniforms.uFade.value = fadeMs;
  }

  update(frame: GeoFrame, now: number, liftM = 0) {
    this.mat.uniforms.uNow.value = now;
    setAnchor(this.mat.uniforms as unknown as ReturnType<typeof anchorUniforms>, frame, this.globeAnchor, this.mercAnchor, liftM);
  }

  dispose() {
    this.object.geometry.dispose();
    this.mat.dispose();
  }
}
