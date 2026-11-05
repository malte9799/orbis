import * as THREE from 'three';
import { toMercator, toUnit, type GeoFrame } from './frame';
import { BEHIND_GLOBE_GLSL, BLEND_GLSL } from './line';

// Thousands of moving dots with a fading trail, on the globe and on the flat map (GeoPoints only does the globe).
// The trails are fixed: all track points go to the GPU once (lon / lat as sphere and mercator position, plus two
// times per point) and the fragment shader shows the part of a segment that lies between `now - trail` and `now`,
// so the trail ends exactly at the dot. The dots are set on the CPU every frame. On the flat map everything is
// drawn in three copies of the world so that it is there on both sides of the date line.
// Two ways to get trails: setData (known tracks, above) or setLive (freely moving dots whose route is not known in advance,
// e.g. a simulation): the last few positions go into a ring buffer on the GPU (pushLive, every few simulated days), the
// segment from the last sample to the dot is rewritten every frame in setDots. The same shader and the same times
// (here: simulated days) fade the trail; segments that touch an invisible dot or cross the date line stay hidden.

export interface SwarmData {
  /** degrees; all points of all tracks one after the other */
  lon: Float32Array;
  lat: Float32Array;
  /** per point two times (days): [mode 0, mode 1] */
  times: Float32Array;
  /** pairs of point indices: the segments of the trails */
  segments: Uint32Array;
}

const COPIES = [-1, 0, 1];
/** time of a hidden live segment: far in the past, so the shader throws it away */
const NEVER = -1e6;

interface Live {
  count: number;
  /** samples in the ring = blocks of segments (block `slots` is the head: last sample to the dot) */
  slots: number;
  /** next slot to write */
  k: number;
  /** samples written so far */
  n: number;
  lastLon: Float32Array;
  lastLat: Float32Array;
  lastOk: Uint8Array;
  lastTime: number;
  dirty: boolean[];
  /** blocks whose times (only) changed: resetLiveSlot */
  dirtyTime: boolean[];
}

const TRAIL_VERTEX = `
attribute vec3 aMerc;
attribute vec2 aTime;
uniform float uMode;
uniform float uOffset;
varying float vTime;
varying vec3 vSphere;
${BLEND_GLSL}
void main() {
  vTime = mix(aTime.x, aTime.y, uMode);
  vSphere = position;
  gl_Position = blend(position, aMerc + vec3(uOffset, 0.0, 0.0));
}`;
const TRAIL_FRAGMENT = `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uNow;
uniform float uTrail;
varying float vTime;
varying vec3 vSphere;
${BEHIND_GLOBE_GLSL}
void main() {
  float age = uNow - vTime;
  if (age < 0.0 || age > uTrail) discard;
  if (behindGlobe(vSphere)) discard;
  gl_FragColor = vec4(uColor, uOpacity * (1.0 - age / uTrail));
  #include <colorspace_fragment>
}`;
const DOT_VERTEX = `
attribute vec3 aMerc;
attribute float aAlpha;
uniform float uSize;
uniform float uRatio;
uniform float uOffset;
varying float vAlpha;
${BLEND_GLSL}
${BEHIND_GLOBE_GLSL}
void main() {
  vAlpha = aAlpha;
  if (aAlpha <= 0.0 || behindGlobe(position)) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  gl_Position = blend(position, aMerc + vec3(uOffset, 0.0, 0.0));
  gl_PointSize = uSize * uRatio;
}`;
const DOT_FRAGMENT = `
uniform vec3 uColor;
uniform float uOpacity;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  if (d > 1.0) discard;
  vec3 c = mix(uColor, vec3(1.0), smoothstep(0.7, 0.0, d) * 0.55);
  gl_FragColor = vec4(c, uOpacity * vAlpha * smoothstep(1.0, 0.75, d));
  #include <colorspace_fragment>
}`;

const sharedUniforms = () => ({
  uGlobe: { value: new THREE.Matrix4() },
  uMerc: { value: new THREE.Matrix4() },
  uT: { value: 1 },
  uHide: { value: 1 },
  uCam: { value: new THREE.Vector3() },
  uCentre: { value: new THREE.Vector3() },
  uOffset: { value: 0 },
  uColor: { value: new THREE.Color() },
  uOpacity: { value: 1 },
});

export class GeoSwarm {
  readonly object = new THREE.Group();
  private trailGeometry = new THREE.BufferGeometry();
  private dotGeometry = new THREE.BufferGeometry();
  private trails: THREE.LineSegments[] = [];
  private dots: THREE.Points[] = [];
  private mats: THREE.ShaderMaterial[] = [];
  private opacity = 1;
  private dotPx = 4;
  private dotCount = 0;
  private live: Live | null = null;

  constructor(
    private color: string,
    private trailOpacity = 0.6,
  ) {}

  private material(vertex: string, fragment: string, extra: Record<string, { value: unknown }>) {
    const m = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms: { ...sharedUniforms(), ...extra },
      transparent: true,
      depthWrite: false,
    });
    m.uniforms.uColor.value.set(this.color);
    this.mats.push(m);
    return m;
  }

  /** The tracks: trail geometry once; `dots` is the number of moving dots (one per track). */
  setData(d: SwarmData, dots: number) {
    const n = d.lon.length;
    const pos = new Float32Array(n * 3);
    const merc = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const [ux, uy, uz] = toUnit(d.lon[i], d.lat[i]);
      pos.set([ux, uy, uz], i * 3);
      const [mx, my] = toMercator(d.lon[i], d.lat[i]);
      merc.set([mx, my, 0], i * 3);
    }
    this.trailGeometry.dispose();
    this.trailGeometry = new THREE.BufferGeometry()
      .setAttribute('position', new THREE.BufferAttribute(pos, 3))
      .setAttribute('aMerc', new THREE.BufferAttribute(merc, 3))
      .setAttribute('aTime', new THREE.BufferAttribute(d.times, 2))
      .setIndex(new THREE.BufferAttribute(d.segments, 1));
    this.live = null;
    this.makeDots(dots);
    this.build();
  }

  private makeDots(dots: number) {
    this.dotCount = dots;
    this.dotGeometry.dispose();
    this.dotGeometry = new THREE.BufferGeometry()
      .setAttribute('position', new THREE.BufferAttribute(new Float32Array(dots * 3), 3).setUsage(THREE.DynamicDrawUsage))
      .setAttribute('aMerc', new THREE.BufferAttribute(new Float32Array(dots * 3), 3).setUsage(THREE.DynamicDrawUsage))
      .setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(dots), 1).setUsage(THREE.DynamicDrawUsage));
  }

  /** `dots` freely moving dots whose trail is the last `slots` samples (see pushLive); all trails hidden at first. */
  setLive(dots: number, slots = 10) {
    const verts = (slots + 1) * dots * 2;
    const dynamic = (n: number, size: number) => new THREE.BufferAttribute(new Float32Array(n * size), size).setUsage(THREE.DynamicDrawUsage);
    this.trailGeometry.dispose();
    this.trailGeometry = new THREE.BufferGeometry()
      .setAttribute('position', dynamic(verts, 3))
      .setAttribute('aMerc', dynamic(verts, 3))
      .setAttribute('aTime', dynamic(verts, 2));
    this.live = {
      count: dots,
      slots,
      k: 0,
      n: 0,
      lastLon: new Float32Array(dots),
      lastLat: new Float32Array(dots),
      lastOk: new Uint8Array(dots),
      lastTime: 0,
      dirty: new Array(slots + 1).fill(false),
      dirtyTime: new Array(slots + 1).fill(false),
    };
    (this.trailGeometry.getAttribute('aTime') as THREE.BufferAttribute).array.fill(NEVER);
    this.makeDots(dots);
    this.build();
  }

  /** Live mode: forget all trails (new seeding). */
  resetLive() {
    const L = this.live;
    if (!L) return;
    (this.trailGeometry.getAttribute('aTime') as THREE.BufferAttribute).array.fill(NEVER);
    L.k = 0;
    L.n = 0;
    L.lastOk.fill(0);
    L.dirty.fill(true);
    L.dirtyTime.fill(true);
  }

  /**
   * Live mode: dot `i` is a different particle from now on (its slot was reused). Its old trail is wiped and the next segment starts
   * at the new position, so no line is drawn from the old position to the new one. Call between two pushLive calls.
   */
  resetLiveSlot(i: number) {
    const L = this.live;
    if (!L) return;
    const tm = this.trailGeometry.getAttribute('aTime') as THREE.BufferAttribute;
    L.lastOk[i] = 0;
    for (let b = 0; b <= L.slots; b++) {
      tm.setXY((b * L.count + i) * 2, NEVER, NEVER);
      tm.setXY((b * L.count + i) * 2 + 1, NEVER, NEVER);
      L.dirtyTime[b] = true;
    }
  }

  /** Live mode: store the positions of all dots as the next sample of the trails; `ok[i]` 0 = dot not visible. `time` in days. */
  pushLive(lon: Float32Array, lat: Float32Array, ok: ArrayLike<number>, time: number) {
    const L = this.live;
    if (!L) return;
    const pos = this.trailGeometry.getAttribute('position') as THREE.BufferAttribute;
    const merc = this.trailGeometry.getAttribute('aMerc') as THREE.BufferAttribute;
    const tm = this.trailGeometry.getAttribute('aTime') as THREE.BufferAttribute;
    const k = L.k;
    const prev = (k + L.slots - 1) % L.slots;
    const v = (block: number, i: number, end: number) => (block * L.count + i) * 2 + end;
    for (let i = 0; i < L.count; i++) {
      const visible = ok[i] > 0;
      const [ux, uy, uz] = toUnit(lon[i], lat[i]);
      const [mx, my] = toMercator(lon[i], lat[i]);
      // this sample starts the block k and ends the block before it
      pos.setXYZ(v(k, i, 0), ux, uy, uz);
      merc.setXYZ(v(k, i, 0), mx, my, 0);
      pos.setXYZ(v(prev, i, 1), ux, uy, uz);
      merc.setXYZ(v(prev, i, 1), mx, my, 0);
      // block k leads to the oldest sample: never drawn; block `prev` (last sample -> this one) is if both ends are
      tm.setXY(v(k, i, 0), NEVER, NEVER);
      tm.setXY(v(k, i, 1), NEVER, NEVER);
      const draw = L.n > 0 && visible && L.lastOk[i] > 0 && Math.abs(lon[i] - L.lastLon[i]) < 180;
      tm.setXY(v(prev, i, 0), draw ? L.lastTime : NEVER, draw ? L.lastTime : NEVER);
      tm.setXY(v(prev, i, 1), draw ? time : NEVER, draw ? time : NEVER);
      L.lastLon[i] = lon[i];
      L.lastLat[i] = lat[i];
      L.lastOk[i] = visible ? 1 : 0;
    }
    L.dirty[k] = L.dirty[prev] = true;
    L.lastTime = time;
    L.k = (k + 1) % L.slots;
    L.n++;
  }

  /** Live mode: the segment from the last sample to the dots, and upload what changed. */
  private liveHead(lon: Float32Array, lat: Float32Array, alpha: Float32Array, now: number) {
    const L = this.live!;
    const pos = this.trailGeometry.getAttribute('position') as THREE.BufferAttribute;
    const merc = this.trailGeometry.getAttribute('aMerc') as THREE.BufferAttribute;
    const tm = this.trailGeometry.getAttribute('aTime') as THREE.BufferAttribute;
    const last = (L.k + L.slots - 1) % L.slots;
    const head = L.slots;
    for (let i = 0; i < L.count; i++) {
      const a = (head * L.count + i) * 2;
      const draw = L.n > 0 && alpha[i] > 0 && L.lastOk[i] > 0 && Math.abs(lon[i] - L.lastLon[i]) < 180;
      if (!draw) {
        tm.setXY(a, NEVER, NEVER);
        tm.setXY(a + 1, NEVER, NEVER);
        continue;
      }
      const s = (last * L.count + i) * 2;
      pos.setXYZ(a, pos.getX(s), pos.getY(s), pos.getZ(s));
      merc.setXYZ(a, merc.getX(s), merc.getY(s), 0);
      const [ux, uy, uz] = toUnit(lon[i], lat[i]);
      const [mx, my] = toMercator(lon[i], lat[i]);
      pos.setXYZ(a + 1, ux, uy, uz);
      merc.setXYZ(a + 1, mx, my, 0);
      tm.setXY(a, L.lastTime, L.lastTime);
      tm.setXY(a + 1, now, now);
    }
    L.dirty[head] = true;
    // upload only the blocks that changed (a block = all dots, both ends of one segment)
    for (const attr of [pos, merc, tm]) {
      const block = L.count * 2 * attr.itemSize;
      for (let b = 0; b <= L.slots; b++) if (L.dirty[b] || (attr === tm && L.dirtyTime[b])) attr.addUpdateRange(b * block, block);
      attr.needsUpdate = true;
    }
    L.dirty.fill(false);
    L.dirtyTime.fill(false);
  }

  private build() {
    for (const o of [...this.trails, ...this.dots]) this.object.remove(o);
    for (const m of this.mats) m.dispose();
    this.mats = [];
    this.trails = [];
    this.dots = [];
    for (const k of COPIES) {
      const trail = new THREE.LineSegments(
        this.trailGeometry,
        this.material(TRAIL_VERTEX, TRAIL_FRAGMENT, { uMode: { value: 0 }, uNow: { value: 0 }, uTrail: { value: 90 } }),
      );
      const dot = new THREE.Points(this.dotGeometry, this.material(DOT_VERTEX, DOT_FRAGMENT, { uSize: { value: this.dotPx }, uRatio: { value: 1 } }));
      trail.userData.copy = dot.userData.copy = k;
      for (const o of [trail, dot]) {
        o.matrixAutoUpdate = false;
        o.frustumCulled = false;
      }
      trail.renderOrder = 2;
      dot.renderOrder = 3;
      this.trails.push(trail);
      this.dots.push(dot);
      this.object.add(trail, dot);
    }
  }

  /** The dots at their positions now; `alpha` 0 hides one. Live mode: `now` (days) also redraws the end of the trails. */
  setDots(lon: Float32Array, lat: Float32Array, alpha: Float32Array, now = 0) {
    const g = this.dotGeometry;
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const merc = g.getAttribute('aMerc') as THREE.BufferAttribute;
    const a = g.getAttribute('aAlpha') as THREE.BufferAttribute;
    for (let i = 0; i < this.dotCount; i++) {
      a.setX(i, alpha[i]);
      if (alpha[i] <= 0) continue;
      const [ux, uy, uz] = toUnit(lon[i], lat[i]);
      pos.setXYZ(i, ux, uy, uz);
      const [mx, my] = toMercator(lon[i], lat[i]);
      merc.setXYZ(i, mx, my, 0);
    }
    pos.needsUpdate = merc.needsUpdate = a.needsUpdate = true;
    if (this.live) this.liveHead(lon, lat, alpha, now);
  }

  /** `mode`: which of the two times counts (0 / 1); `now` and `trailDays` in the days of that time. */
  update(frame: GeoFrame, now: number, mode: number, trailDays: number) {
    const centreCopy = frame.worldCopy(0.5);
    for (const o of [...this.trails, ...this.dots]) {
      const k = o.userData.copy as number;
      // copies of the world only on the flat map
      o.visible = k === 0 || frame.t <= 0;
      const m = (o.material as THREE.ShaderMaterial).uniforms;
      m.uGlobe.value.copy(frame.globeMatrix);
      m.uMerc.value.copy(frame.mercMatrix);
      m.uT.value = frame.t;
      m.uHide.value = frame.globe ? 1 : 0;
      m.uCam.value.set(frame.camera[0], frame.camera[1], frame.camera[2]);
      m.uOffset.value = centreCopy + k;
      m.uOpacity.value = this.opacity * (o instanceof THREE.LineSegments ? this.trailOpacity : 1);
      if (o instanceof THREE.LineSegments) {
        m.uMode.value = mode;
        m.uNow.value = now;
        m.uTrail.value = trailDays;
      } else {
        m.uSize.value = this.dotPx;
        m.uRatio.value = frame.pixels[0] / frame.width;
      }
    }
  }

  setOpacity(f: number) {
    this.opacity = f;
  }

  setDotSize(px: number) {
    this.dotPx = px;
  }

  dispose() {
    this.trailGeometry.dispose();
    this.dotGeometry.dispose();
    for (const m of this.mats) m.dispose();
  }
}
