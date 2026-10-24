import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MercatorCoordinate, type CustomLayerInterface, type Map as MlMap } from 'maplibre-gl';

// 3D aircraft: a three.js layer inside MapLibre's GL context. Positions are
// reported every ~10 s, so every aircraft keeps a small state that is dead-reckoned from its
// ground speed and heading and eased towards each new report (no visible jumps). Around each
// aircraft: its trail at the real altitude, a faint wall from the trail down to the ground,
// a thin line from the aircraft to the ground and its shadow.

export type PlaneModel = 'narrow' | 'wide' | 'heli';

export interface PlaneReport {
  hex: string;
  lon: number;
  lat: number;
  altM: number;
  /** climb rate (m/s, negative: descending) */
  vsMs: number;
  track: number;
  speedMs: number;
  ground: boolean;
  model: PlaneModel;
  emergency: boolean;
  /** properties shown in the popup, copied onto the label/hit features */
  props: Record<string, unknown>;
}

export interface PlaneState extends PlaneReport {
  /** displayed (smoothed) state */
  dLon: number;
  dLat: number;
  dAlt: number;
  dTrack: number;
  /** when the last report arrived (ms) */
  at: number;
  seen: number;
  /** [lon, lat, altitude m, time (performance.now ms)] of the positions reported so far */
  trail: [number, number, number, number][];
  obj?: THREE.Object3D;
  objModel?: PlaneModel;
  objEmergency?: boolean;
  shadow?: THREE.Mesh;
  shadowModel?: PlaneModel;
  drop?: THREE.Line;
  rig?: TrailRig;
  /** when the last position report arrived (performance.now): a white pulse shows it */
  pulseAt?: number;
  pulse?: THREE.Mesh;
}

/** an aircraft inside the area of the last request that is no longer reported has landed or left: gone after this */
const EXPIRE_MS = 60000;
/** outside that area (map moved or zoomed) the aircraft stays cached and keeps flying on its course this long */
const CACHE_MS = 300000;
const PULSE_MS = 1300;
const TRAIL_MAX = 150;
/** a trail fades out over this time (the one of the selected aircraft stays complete) */
const TRAIL_FADE_MS = 60000;
/** the wall below a trail only exists at low altitude (take-off, landing, helicopters): full below, gone above */
const WALL_FULL_M = 800;
const WALL_MAX_M = 1500;
/** share of the reported speed used to move an aircraft between two reports (1: not slowed down) */
const EXTRAPOLATE = 1;
const M_PER_DEG = 111320;
const YELLOW = 0xf2c94c;
const RED = 0xff2d55;

const rad = (d: number) => (d * Math.PI) / 180;
const shortestDelta = (from: number, to: number) => ((((to - from) % 360) + 540) % 360) - 180;

/** Metres between two nearby points. */
function metres(aLon: number, aLat: number, bLon: number, bLat: number) {
  return Math.hypot((bLon - aLon) * Math.cos(rad(aLat)), bLat - aLat) * M_PER_DEG;
}

export class PlaneTracker {
  readonly planes = new Map<string, PlaneState>();
  private lastStep = 0;
  /** the selected aircraft is never dropped as long as it flies on (cached) */
  keep: string | null = null;
  /** area of the latest request: [lat, lon, radius nm] */
  private area: { lat: number; lon: number; nm: number } | null = null;

  feed(reports: PlaneReport[], now: number, area?: { lat: number; lon: number; nm: number }) {
    if (area) this.area = area;
    for (const r of reports) {
      const prev = this.planes.get(r.hex);
      if (!prev) {
        this.planes.set(r.hex, { ...r, dLon: r.lon, dLat: r.lat, dAlt: r.altM, dTrack: r.track, at: now, seen: now, pulseAt: now, trail: [[r.lon, r.lat, trailAlt(r), now]] });
        continue;
      }
      // a plane that did not move since the last report keeps its old fix time → no new trail point
      const last = prev.trail[prev.trail.length - 1];
      if (metres(last[0], last[1], r.lon, r.lat) >= (r.ground ? 5 : 30)) {
        prev.trail.push([r.lon, r.lat, trailAlt(r), now]);
        if (prev.trail.length > TRAIL_MAX) prev.trail.shift();
      }
      Object.assign(prev, r, { at: now, seen: now, pulseAt: now });
    }
    for (const [hex, p] of this.planes) {
      const age = now - p.seen;
      if (hex === this.keep && age < 3600_000) continue;
      if (age > CACHE_MS || (age > EXPIRE_MS && this.inArea(p.lat, p.lon))) this.remove(hex, p);
    }
  }

  /** Was this position inside the area of the latest request (then a missing report means: gone)? */
  private inArea(lat: number, lon: number) {
    const a = this.area;
    if (!a) return true;
    const nm = Math.hypot((lon - a.lon) * Math.cos(rad(a.lat)), lat - a.lat) * 60;
    return nm < a.nm * 0.95;
  }

  /** Advance the displayed state to `now` (ms). */
  step(now: number) {
    // after a longer pause (layer off, tab hidden) the cached aircraft jump to where they must be by now
    const snap = this.lastStep > 0 && now - this.lastStep > 2000;
    const dt = this.lastStep ? Math.min(0.25, (now - this.lastStep) / 1000) : 0;
    this.lastStep = now;
    const kPos = 1 - Math.exp(-dt / 1.0);
    const kAlt = 1 - Math.exp(-dt / 1.5);
    const kHdg = 1 - Math.exp(-dt / 0.7);
    for (const p of this.planes.values()) {
      const elapsed = Math.min(CACHE_MS / 1000, (now - p.at) / 1000);
      // an aircraft running ahead of the next report is never pulled back along its track (see below)
      const dist = p.speedMs * EXTRAPOLATE * elapsed;
      const cosLat = Math.max(0.2, Math.cos(rad(p.lat)));
      const tLat = p.lat + (dist * Math.cos(rad(p.track))) / M_PER_DEG;
      const tLon = p.lon + (dist * Math.sin(rad(p.track))) / (M_PER_DEG * cosLat);
      // correction towards the target in metres (east, north); never backwards along the track
      let dx = (tLon - p.dLon) * cosLat * M_PER_DEG;
      let dy = (tLat - p.dLat) * M_PER_DEG;
      const along = dx * Math.sin(rad(p.track)) + dy * Math.cos(rad(p.track));
      if (along < 0) {
        dx -= along * Math.sin(rad(p.track));
        dy -= along * Math.cos(rad(p.track));
      }
      if (snap) {
        p.dLon = tLon;
        p.dLat = tLat;
      } else {
        p.dLon += (dx * kPos) / (M_PER_DEG * cosLat);
        p.dLat += (dy * kPos) / M_PER_DEG;
      }
      // the altitude runs on with the climb / sink rate (for a minute at most: the aircraft levels off sometime)
      const tAlt = p.ground ? 0 : Math.max(0, p.altM + p.vsMs * EXTRAPOLATE * Math.min(60, elapsed));
      p.dAlt += (tAlt - p.dAlt) * kAlt;
      p.dTrack = (p.dTrack + shortestDelta(p.dTrack, p.track) * kHdg + 360) % 360;
    }
  }

  private remove(hex: string, p: PlaneState) {
    this.planes.delete(hex);
    disposePlane(p);
  }

  clear() {
    for (const [hex, p] of this.planes) this.remove(hex, p);
    this.lastStep = 0;
  }
}

/** altitude of a trail point: aircraft on the ground are lifted a little to stay above the map */
const trailAlt = (r: { ground: boolean; altM: number }) => (r.ground ? 0.3 : r.altM);

/** Take everything of an aircraft out of the scene and free what it owns (models share geometry). */
function disposePlane(p: PlaneState) {
  for (const o of [p.obj, p.shadow, p.drop, p.rig?.line, p.rig?.wall, p.pulse]) o?.parent?.remove(o);
  if (p.obj) disposeMaterials(p.obj);
  (p.pulse?.material as THREE.Material | undefined)?.dispose();
  p.rig?.dispose();
  p.obj = p.shadow = p.drop = p.rig = p.pulse = undefined;
}

function disposeMaterials(o: THREE.Object3D) {
  o.traverse((c) => {
    const m = (c as THREE.Mesh).material;
    if (m) (Array.isArray(m) ? m : [m]).forEach((x) => x.dispose());
  });
}

// ---------------------------------------------------------------------------
// Procedural low-poly models (metres, nose towards +y, x east, z up, wheels at z = 0).

/** A swept, flat wing panel on the +x side; `mirror` gives the other side. */
function wingPanel(rootX: number, tipX: number, rootLeadY: number, rootChord: number, tipChord: number, sweep: number, thick: number, z: number): THREE.BufferGeometry[] {
  const s = new THREE.Shape();
  const tipLeadY = rootLeadY - sweep;
  s.moveTo(rootX, rootLeadY);
  s.lineTo(tipX, tipLeadY);
  s.lineTo(tipX, tipLeadY - tipChord);
  s.lineTo(rootX, rootLeadY - rootChord);
  s.closePath();
  const right = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false }).translate(0, 0, z);
  const left = right.clone().scale(-1, 1, 1);
  return [right, left];
}

function airliner(k: number): THREE.BufferGeometry {
  const L = 37.6 * k;
  const r = 1.95 * k;
  const zc = 3.3 * k;
  const noseH = 0.14 * L;
  const tailH = 0.24 * L;
  const bodyL = L - noseH - tailH;
  const bodyMid = (tailH - noseH) / 2; // body centre so the whole fuselage is centred on y = 0
  const parts: THREE.BufferGeometry[] = [];
  parts.push(new THREE.CylinderGeometry(r, r, bodyL, 14).translate(0, bodyMid, zc));
  parts.push(new THREE.CylinderGeometry(r * 0.22, r, noseH, 14).translate(0, bodyMid + bodyL / 2 + noseH / 2, zc));
  parts.push(new THREE.CylinderGeometry(r, r * 0.18, tailH, 14).translate(0, bodyMid - bodyL / 2 - tailH / 2, zc + r * 0.1));
  // wings (low wing), horizontal tail
  parts.push(...wingPanel(r * 0.7, 17.9 * k, 3.2 * k, 6.5 * k, 1.6 * k, 7.5 * k, 0.5 * k, zc - r * 0.55));
  parts.push(...wingPanel(r * 0.5, 6.2 * k, -L * 0.34, 4.2 * k, 1.3 * k, 3.4 * k, 0.35 * k, zc + r * 0.25));
  // engines
  for (const side of [-1, 1]) {
    parts.push(new THREE.CylinderGeometry(1.05 * k, 1.0 * k, 3.6 * k, 10).translate(side * 5.8 * k, 3.3 * k, zc - r * 0.55 - 1.0 * k));
  }
  // vertical fin: drawn in (y, z), extruded along x
  const fin = new THREE.Shape();
  const fz = zc + r * 0.55;
  fin.moveTo(-L * 0.28, fz);
  fin.lineTo(-L * 0.4, fz + 6.4 * k);
  fin.lineTo(-L * 0.4 - 2.6 * k, fz + 6.4 * k);
  fin.lineTo(-L * 0.47, fz);
  fin.closePath();
  const finGeo = new THREE.ExtrudeGeometry(fin, { depth: 0.5 * k, bevelEnabled: false }).translate(0, 0, -0.25 * k);
  // (x, y, z) → (z, x, y): shape x becomes the plane's y axis, shape y its z axis
  finGeo.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1));
  parts.push(finGeo);
  // only position + normal are needed; keep attributes identical so they can be merged
  const flat = parts.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    n.deleteAttribute('uv');
    return n;
  });
  return mergeGeometries(flat)!;
}

/** Parts of the helicopter: body, windscreen, main rotor blades, tail rotor blades (x right, y nose, z up). */
interface HeliGeos {
  body: THREE.BufferGeometry;
  glass: THREE.BufferGeometry;
  rotor: THREE.BufferGeometry;
  tail: THREE.BufferGeometry;
}

function heliParts(): HeliGeos {
  // only position + normal are needed; keep attributes identical so they can be merged
  const merge = (list: THREE.BufferGeometry[]) =>
    mergeGeometries(
      list.map((g) => {
        const n = g.index ? g.toNonIndexed() : g;
        n.deleteAttribute('uv');
        return n;
      }),
    )!;
  const parts: THREE.BufferGeometry[] = [
    new THREE.SphereGeometry(1, 16, 12).scale(1.5, 3.2, 1.55).translate(0, 0.8, 2.0), // cabin
    new THREE.SphereGeometry(1, 12, 8).scale(0.95, 1.8, 0.8).translate(0, -0.6, 3.5), // engine housing
    new THREE.CylinderGeometry(0.5, 0.2, 7, 10).translate(0, -5.3, 2.6), // tail boom
    new THREE.BoxGeometry(0.16, 1.3, 1.9).translate(0, -8.6, 3.4), // fin
    new THREE.BoxGeometry(2.4, 0.8, 0.12).translate(0, -7.6, 2.7), // stabiliser
    new THREE.CylinderGeometry(0.17, 0.2, 1.2, 8).rotateX(Math.PI / 2).translate(0, 0.2, 4.2), // rotor mast
  ];
  for (const side of [-1, 1]) {
    parts.push(new THREE.CylinderGeometry(0.12, 0.12, 5.4, 6).translate(side * 1.35, 0.6, 0.3)); // skid
    for (const y of [-0.9, 1.9]) parts.push(new THREE.BoxGeometry(0.12, 0.12, 1.5).translate(side * 1.25, y, 1.0)); // strut
  }
  const blades = (n: number) => merge(Array.from({ length: n }, (_, i) => new THREE.BoxGeometry(0.45, 6.3, 0.05).translate(0, 3.35, 0).rotateZ((i * 2 * Math.PI) / n)));
  return {
    body: merge(parts),
    glass: merge([new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, 1.0).scale(1.53, 3.26, 1.58).translate(0, 0.8, 2.0)]), // front cap of the cabin: the canopy
    rotor: blades(4),
    tail: merge([new THREE.BoxGeometry(0.05, 1.5, 0.16), new THREE.BoxGeometry(0.05, 1.5, 0.16).rotateX(Math.PI / 2)]),
  };
}

let geoCache: { narrow: THREE.BufferGeometry; wide: THREE.BufferGeometry; heli: HeliGeos } | null = null;
const geos = () => (geoCache ??= { narrow: airliner(1), wide: airliner(1.68), heli: heliParts() });

function makeModel(model: PlaneModel, emergency: boolean): THREE.Object3D {
  const color = emergency ? RED : YELLOW;
  const mat = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide });
  const g = geos();
  if (model === 'heli') {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(g.heli.body, mat));
    group.add(new THREE.Mesh(g.heli.glass, mat));
    // the rotors turn: main rotor around z at the mast, tail rotor around x at the end of the boom
    const main = new THREE.Group();
    main.position.set(0, 0.2, 4.85);
    main.add(new THREE.Mesh(g.heli.rotor, mat));
    const tail = new THREE.Group();
    tail.position.set(0.3, -8.9, 3.5);
    tail.add(new THREE.Mesh(g.heli.tail, mat));
    group.add(main, tail);
    group.userData = { main, tail };
    return group;
  }
  return new THREE.Mesh(g[model], mat);
}

// ---------------------------------------------------------------------------


// Thick lines of constant pixel width. Each segment is a quad (4 vertices) that carries both of
// its end points; the vertex shader projects them and pushes the corners sideways in screen space.
const LINE_VERTEX = `
attribute vec3 aStart;
attribute vec3 aEnd;
attribute vec2 aCorner;
attribute vec2 aT; // report time of start / end (end < 0: the moving head = now)
uniform vec2 uRes;
uniform float uWidth;
uniform float uNow;
uniform float uFade; // 0: no fading
varying float vFade;
varying float vD;
void main() {
  vD = mix(aT.x, aT.y, aCorner.x); // distance along a dashed line (forecast)
  float te = aT.y < 0.0 ? uNow : aT.y;
  vFade = uFade > 0.0 ? clamp(1.0 - (uNow - mix(aT.x, te, aCorner.x)) / uFade, 0.0, 1.0) : 1.0;
  vec4 cs = projectionMatrix * modelViewMatrix * vec4(aStart, 1.0);
  vec4 ce = projectionMatrix * modelViewMatrix * vec4(aEnd, 1.0);
  if (cs.w <= 0.0 || ce.w <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vec2 d = (ce.xy / ce.w - cs.xy / cs.w) * uRes;
  float len = length(d);
  vec2 dir = len > 0.0001 ? d / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  vec4 c = mix(cs, ce, aCorner.x);
  c.xy += nrm * aCorner.y * uWidth / uRes * c.w;
  gl_Position = c;
}`;
const LINE_FRAGMENT = `
uniform float uOpacity;
uniform vec3 uColor;
uniform float uDash; // dash period in metres, 0: solid
varying float vFade;
varying float vD;
void main() {
  if (uDash > 0.0 && mod(vD, uDash) > uDash * 0.55) discard;
  gl_FragColor = vec4(uColor, uOpacity * vFade);
}`;
const WALL_VERTEX = `
attribute float aT;
uniform float uNow;
uniform float uFade;
varying float vFade;
varying float vD;
void main() {
  vD = 0.0;
  float t = aT < 0.0 ? uNow : aT;
  vFade = uFade > 0.0 ? clamp(1.0 - (uNow - t) / uFade, 0.0, 1.0) : 1.0;
  vFade *= 1.0 - smoothstep(${WALL_FULL_M.toFixed(1)}, ${WALL_MAX_M.toFixed(1)}, position.z);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

interface Mats {
  line: THREE.ShaderMaterial;
  lineSel: THREE.ShaderMaterial;
  wall: THREE.ShaderMaterial;
  wallSel: THREE.ShaderMaterial;
  /** grey dashed line to the airports of the route */
  forecast: THREE.ShaderMaterial;
  /** current time (performance.now ms), shared by the trail shaders */
  now: { value: number };
  shadow: THREE.MeshBasicMaterial;
  drop: THREE.LineBasicMaterial;
}

function makeMats(): Mats {
  const dpr = window.devicePixelRatio || 1;
  const now = { value: 0 };
  const line = (width: number, opacity: number, fade: number, colour = new THREE.Vector3(1, 0.416, 0.169)) =>
    new THREE.ShaderMaterial({
      vertexShader: LINE_VERTEX,
      fragmentShader: LINE_FRAGMENT,
      uniforms: { uRes: { value: new THREE.Vector2(1, 1) }, uWidth: { value: width * dpr }, uOpacity: { value: opacity }, uNow: now, uFade: { value: fade }, uColor: { value: colour }, uDash: { value: 0 } },
      transparent: true,
      // the trail rigs are mirrored (y flipped), which flips the triangle winding; the forecast line is not
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  const wall = (opacity: number, fade: number) =>
    new THREE.ShaderMaterial({
      vertexShader: WALL_VERTEX,
      fragmentShader: LINE_FRAGMENT,
      uniforms: { uOpacity: { value: opacity }, uNow: now, uFade: { value: fade }, uColor: { value: new THREE.Vector3(1, 0.416, 0.169) }, uDash: { value: 0 } },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  return {
    now,
    // all trails faint and fading out, the one of the selected aircraft complete and at full strength
    line: line(2, 0.55, TRAIL_FADE_MS),
    lineSel: line(3, 1, 0),
    wall: wall(0.06, TRAIL_FADE_MS),
    wallSel: wall(0.15, 0),
    forecast: line(2.5, 0.85, 0, new THREE.Vector3(0.72, 0.75, 0.8)),
    shadow: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }),
    drop: new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }),
  };
}

/** the line from an aircraft to the ground: unit height, scaled to the altitude */
const dropGeometry = () => new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 1], 3));

/**
 * Trail of one aircraft in local metres around its first point (x east, y north, z up): a fat
 * line plus a wall down to the ground. The last vertex follows the aircraft and is moved in place
 * every frame; the rest is rebuilt only when a new position was reported.
 */
class TrailRig {
  line = new THREE.Mesh(new THREE.BufferGeometry());
  wall = new THREE.Mesh(new THREE.BufferGeometry());
  lon0 = 0;
  lat0 = 0;
  private count = -1;
  private flatBuilt = false;
  private points = 0;
  private aEnd: THREE.BufferAttribute | null = null;
  private wallPos: Float32Array = new Float32Array(0);

  constructor() {
    for (const o of [this.line, this.wall]) {
      o.matrixAutoUpdate = false;
      o.frustumCulled = false;
    }
    this.wall.renderOrder = 1;
    this.line.renderOrder = 2;
  }

  private local(lon: number, lat: number, alt: number): [number, number, number] {
    return [(lon - this.lon0) * Math.cos(rad(this.lat0)) * M_PER_DEG, (lat - this.lat0) * M_PER_DEG, alt];
  }

  private build(trail: [number, number, number, number][], flat: boolean) {
    this.lon0 = trail[0][0];
    this.lat0 = trail[0][1];
    const pts = trail.map((t) => this.local(t[0], t[1], flat ? 0.3 : t[2]));
    pts.push(pts[pts.length - 1]); // the head, moved every frame
    this.points = pts.length;
    const segs = pts.length - 1;
    // line: one quad per segment, corners (along, side) = (0,-1) (0,1) (1,-1) (1,1)
    const start = new Float32Array(segs * 12);
    const end = new Float32Array(segs * 12);
    const corner = new Float32Array(segs * 8);
    const times = new Float32Array(segs * 8);
    const index = new Uint32Array(segs * 6);
    for (let i = 0; i < segs; i++) {
      for (let v = 0; v < 4; v++) {
        start.set(pts[i], (i * 4 + v) * 3);
        end.set(pts[i + 1], (i * 4 + v) * 3);
        corner.set([v >> 1, v & 1 ? 1 : -1], (i * 4 + v) * 2);
        times.set([trail[i][3], i + 1 < trail.length ? trail[i + 1][3] : -1], (i * 4 + v) * 2);
      }
      index.set([0, 1, 2, 2, 1, 3].map((k) => i * 4 + k), i * 6);
    }
    this.line.geometry.dispose();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(start, 3));
    g.setAttribute('aStart', new THREE.BufferAttribute(start, 3));
    this.aEnd = new THREE.BufferAttribute(end, 3);
    g.setAttribute('aEnd', this.aEnd);
    g.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2));
    g.setAttribute('aT', new THREE.BufferAttribute(times, 2));
    g.setIndex(new THREE.BufferAttribute(index, 1));
    this.line.geometry = g;
    // wall: two triangles per segment, from the trail down to z = 0
    const w = new Float32Array(segs * 18);
    const wt = new Float32Array(segs * 6);
    for (let i = 0; i < segs; i++) {
      const [ax, ay, az] = pts[i];
      const [bx, by, bz] = pts[i + 1];
      w.set([ax, ay, az, bx, by, bz, ax, ay, 0, bx, by, bz, bx, by, 0, ax, ay, 0], i * 18);
      const ta = trail[i][3];
      const tb = i + 1 < trail.length ? trail[i + 1][3] : -1;
      wt.set([ta, tb, ta, tb, tb, ta], i * 6);
    }
    this.wallPos = w;
    this.wall.geometry.dispose();
    this.wall.geometry = new THREE.BufferGeometry()
      .setAttribute('position', new THREE.BufferAttribute(w, 3))
      .setAttribute('aT', new THREE.BufferAttribute(wt, 1));
    this.count = trail.length;
    this.flatBuilt = flat;
  }

  /** Bring the geometry to the aircraft's trail and current (displayed) position. */
  sync(p: PlaneState, flat: boolean) {
    if (p.trail.length !== this.count || flat !== this.flatBuilt) this.build(p.trail, flat);
    const [x, y, z] = this.local(p.dLon, p.dLat, flat || p.ground ? 0.3 : p.dAlt);
    // the last quad's four vertices end at the head
    const end = this.aEnd!;
    const first = (this.points - 2) * 4;
    for (let v = 0; v < 4; v++) end.setXYZ(first + v, x, y, z);
    end.needsUpdate = true;
    const w = this.wallPos;
    const wb = (this.points - 2) * 18;
    // head vertices of the last wall quad: B top (1st triangle 2nd, 2nd triangle 1st), B bottom
    for (const v of [1, 3]) w.set([x, y, z], wb + v * 3);
    w.set([x, y, 0], wb + 12);
    (this.wall.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    this.wall.visible = !flat && !p.ground && p.dAlt > 3;
  }

  dispose() {
    this.line.geometry.dispose();
    this.wall.geometry.dispose();
  }
}

// ---------------------------------------------------------------------------

interface ForecastLeg {
  /** [lon, lat, altitude m] */
  from: [number, number, number];
  to: [number, number, number];
  /** dashes are anchored at the airport end so they stay put while the aircraft moves */
  anchor: 'from' | 'to';
}

const FC_SEGS = 48; // straight pieces per leg
const FC_LEGS = 2;

/** Great circle between two points, `n` pieces, with altitude ramped linearly; lon unwrapped around `refLon`. */
function greatCircle(a: [number, number, number], b: [number, number, number], n: number, refLon: number) {
  const [lo1, la1] = [rad(a[0]), rad(a[1])];
  const [lo2, la2] = [rad(b[0]), rad(b[1])];
  const h = Math.sin((la2 - la1) / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin((lo2 - lo1) / 2) ** 2;
  const delta = 2 * Math.asin(Math.min(1, Math.sqrt(h)));
  const pts: [number, number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    let lon: number;
    let lat: number;
    if (delta < 1e-9) {
      lon = a[0];
      lat = a[1];
    } else {
      const k1 = Math.sin((1 - t) * delta) / Math.sin(delta);
      const k2 = Math.sin(t * delta) / Math.sin(delta);
      const x = k1 * Math.cos(la1) * Math.cos(lo1) + k2 * Math.cos(la2) * Math.cos(lo2);
      const y = k1 * Math.cos(la1) * Math.sin(lo1) + k2 * Math.cos(la2) * Math.sin(lo2);
      const z = k1 * Math.sin(la1) + k2 * Math.sin(la2);
      lat = (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI;
      lon = (Math.atan2(y, x) * 180) / Math.PI;
    }
    lon += 360 * Math.round((refLon - lon) / 360);
    pts.push([lon, lat, a[2] + (b[2] - a[2]) * t]);
  }
  return { pts, metres: delta * 6371008.8 };
}

/**
 * Grey dashed lines of the selected aircraft: from the departure airport to where its trail
 * begins (no data there) and from its position to the destination airport. Positions are in
 * Mercator units relative to the aircraft, so far-away airports keep their precision.
 */
class ForecastRig {
  line: THREE.Mesh;
  private start = new Float32Array(FC_LEGS * FC_SEGS * 12);
  private end = new Float32Array(FC_LEGS * FC_SEGS * 12);
  private times = new Float32Array(FC_LEGS * FC_SEGS * 8);
  private aStart: THREE.BufferAttribute;
  private aEnd: THREE.BufferAttribute;
  private aT: THREE.BufferAttribute;

  constructor(material: THREE.Material) {
    const total = FC_LEGS * FC_SEGS;
    const corner = new Float32Array(total * 8);
    const index = new Uint32Array(total * 6);
    for (let i = 0; i < total; i++) {
      for (let v = 0; v < 4; v++) corner.set([v >> 1, v & 1 ? 1 : -1], (i * 4 + v) * 2);
      index.set([0, 1, 2, 2, 1, 3].map((k) => i * 4 + k), i * 6);
    }
    const g = new THREE.BufferGeometry();
    const dyn = (a: Float32Array, n: number) => new THREE.BufferAttribute(a, n).setUsage(THREE.DynamicDrawUsage);
    this.aStart = dyn(this.start, 3);
    this.aEnd = dyn(this.end, 3);
    this.aT = dyn(this.times, 2);
    g.setAttribute('position', this.aStart);
    g.setAttribute('aStart', this.aStart);
    g.setAttribute('aEnd', this.aEnd);
    g.setAttribute('aT', this.aT);
    g.setAttribute('aCorner', new THREE.BufferAttribute(corner, 2));
    g.setIndex(new THREE.BufferAttribute(index, 1));
    g.setDrawRange(0, 0);
    this.line = new THREE.Mesh(g, material);
    this.line.matrixAutoUpdate = false;
    this.line.frustumCulled = false;
    this.line.renderOrder = 2;
  }

  /** `origin`: the aircraft [lon, lat]; `mpu`: Mercator units per metre there. Returns the Mercator origin. */
  update(origin: [number, number], legs: ForecastLeg[], mpu: number): MercatorCoordinate {
    const o = MercatorCoordinate.fromLngLat(origin, 0);
    let seg = 0;
    for (const leg of legs) {
      const { pts, metres: total } = greatCircle(leg.from, leg.to, FC_SEGS, origin[0]);
      const m = pts.map(([lon, lat, alt]) => {
        const c = MercatorCoordinate.fromLngLat([lon, lat], 0);
        return [c.x - o.x, c.y - o.y, alt * mpu];
      });
      for (let k = 0; k < FC_SEGS; k++, seg++) {
        const d0 = leg.anchor === 'from' ? (total * k) / FC_SEGS : (total * (FC_SEGS - k)) / FC_SEGS;
        const d1 = leg.anchor === 'from' ? (total * (k + 1)) / FC_SEGS : (total * (FC_SEGS - k - 1)) / FC_SEGS;
        for (let v = 0; v < 4; v++) {
          this.start.set(m[k], (seg * 4 + v) * 3);
          this.end.set(m[k + 1], (seg * 4 + v) * 3);
          this.times.set([d0, d1], (seg * 4 + v) * 2);
        }
      }
    }
    for (const a of [this.aStart, this.aEnd, this.aT]) a.needsUpdate = true;
    this.line.geometry.setDrawRange(0, seg * 6);
    this.line.visible = seg > 0;
    return o;
  }

  dispose() {
    this.line.geometry.dispose();
  }
}

export interface PlanesLayerHooks {
  /** 'off': nothing drawn; 'flat': map not tilted (flat trails, models only without 2D icons); '3d': tilted */
  mode(): 'off' | 'flat' | '3d';
  /** far out only this aircraft (the selected one) is drawn, with its trail and route; null: all */
  only(): string | null;
  /** are the 2D aircraft icons shown (then the models are left out in flat mode)? */
  icons(): boolean;
  /** about 10× a second while the 2D icons are shown on a flat map: move them with the smoothed positions */
  tick(): void;
  /** called about 4× a second with the planes that are drawn */
  frame(planes: PlaneState[]): void;
}

export class PlanesLayer implements CustomLayerInterface {
  readonly id = 'ap3d-planes';
  readonly type = 'custom' as const;
  readonly renderingMode = '3d' as const;
  private map!: MlMap;
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.Camera();
  private lastFrameHook = 0;
  private lastTick = 0;
  private mats!: Mats;
  private proj = new THREE.Matrix4();
  /** Mercator position of the map centre: everything is placed relative to it (see render) */
  private cx = 0;
  private cy = 0;
  private flatNow = false;
  private drop = dropGeometry();
  private pulseGeo = new THREE.SphereGeometry(1, 20, 14);
  /** hex of the aircraft whose trail is drawn at full strength */
  selected: string | null = null;
  /** departure / destination airport [lon, lat] of the selected aircraft, if known */
  private route: { hex: string; origin: [number, number]; destination: [number, number] } | null = null;
  private forecast?: ForecastRig;
  /** callsign labels: plain elements moved every frame with the same matrix as the models (no lag when zooming) */
  private labelBox?: HTMLDivElement;
  private labels = new Map<string, HTMLDivElement>();

  /** Route of an aircraft (null: none): a grey dashed line is drawn while it is the selected one. */
  setRoute(hex: string, route: { origin: [number, number]; destination: [number, number] } | null) {
    this.route = route ? { hex, ...route } : null;
    this.map?.triggerRepaint();
  }

  constructor(
    readonly tracker: PlaneTracker,
    private hooks: PlanesLayerHooks,
  ) {
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(0.4, -0.6, 1);
    this.scene.add(sun);
  }

  onAdd(map: MlMap, gl: WebGL2RenderingContext) {
    this.map = map;
    this.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
    this.renderer.autoClear = false;
    this.mats = makeMats();
    this.labelBox = document.createElement('div');
    this.labelBox.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:1';
    map.getCanvasContainer().appendChild(this.labelBox);
  }

  onRemove() {
    this.tracker.clear();
    this.renderer?.dispose();
    this.drop.dispose();
    this.pulseGeo.dispose();
    for (const m of Object.values(this.mats ?? {})) if ('dispose' in m) m.dispose();
    this.forecast?.dispose();
    this.labelBox?.remove();
    this.labels.clear();
  }

  render(_gl: WebGL2RenderingContext, args: { defaultProjectionData: { mainMatrix: ArrayLike<number> } }) {
    const mode = this.hooks.mode();
    if (mode === 'off') {
      this.syncLabels([]);
      if (this.tracker.planes.size && this.lastFrameHook) {
        this.lastFrameHook = 0;
        this.hooks.frame([]);
      }
      return;
    }
    const flat = mode === 'flat';
    this.flatNow = flat;
    // Float32 on the GPU cannot place metre-sized detail at world coordinates (~0.5, one metre is
    // ~1e-8): the models jitter when zoomed in. So every object is positioned relative to the map
    // centre and the projection gets the centre's offset folded in (computed in double precision).
    const centre = MercatorCoordinate.fromLngLat(this.map.getCenter(), 0);
    this.cx = centre.x;
    this.cy = centre.y;
    this.proj.fromArray(args.defaultProjectionData.mainMatrix as number[]).multiply(new THREE.Matrix4().makeTranslation(this.cx, this.cy, 0));
    const models = !flat || !this.hooks.icons();
    const only = this.hooks.only();
    const now = performance.now();
    this.tracker.step(now);
    const drawn: PlaneState[] = [];
    const map = this.map;
    const center = map.getCenter();
    // metres per screen pixel: models keep a readable size when zoomed out (about 26 px long)
    const mpp = (40075016 * Math.cos(rad(center.lat))) / (512 * 2 ** map.getZoom());
    const boost = Math.max(1, 0.65 * mpp);
    const terrain = map.getTerrain();
    // only what is (nearly) in view is built and drawn
    if (flat && !models && now - this.lastTick > 100) {
      this.lastTick = now;
      this.hooks.tick();
    }
    const b = map.getBounds();
    const padLon = (b.getEast() - b.getWest()) * 0.5;
    const padLat = (b.getNorth() - b.getSouth()) * 0.5;
    const m = new THREE.Matrix4();
    const rot = new THREE.Matrix4();
    for (const p of this.tracker.planes.values()) {
      if (only && p.hex !== only) {
        for (const o of [p.obj, p.shadow, p.drop, p.rig?.line, p.rig?.wall, p.pulse]) if (o) o.visible = false;
        continue;
      }
      const inView = p.dLon > b.getWest() - padLon && p.dLon < b.getEast() + padLon && p.dLat > b.getSouth() - padLat && p.dLat < b.getNorth() + padLat;
      if (!inView) {
        for (const o of [p.obj, p.shadow, p.drop, p.rig?.line, p.rig?.wall, p.pulse]) if (o) o.visible = false;
        continue;
      }
      const elev = terrain ? (map.queryTerrainElevation([p.dLon, p.dLat]) ?? 0) : 0;
      const air = !flat && !p.ground && p.dAlt > 3;
      if (models) {
        if (!p.obj || p.objModel !== p.model || p.objEmergency !== p.emergency) {
          if (p.obj) {
            this.scene.remove(p.obj);
            disposeMaterials(p.obj);
          }
          p.obj = makeModel(p.model, p.emergency);
          p.obj.matrixAutoUpdate = false;
          p.objModel = p.model;
          p.objEmergency = p.emergency;
          this.scene.add(p.obj);
        }
        const alt = flat ? (p.ground ? 0.2 : 1) : p.dAlt + (p.ground ? 0.2 : 0);
        const mc = MercatorCoordinate.fromLngLat([p.dLon, p.dLat], alt + elev);
        const s = mc.meterInMercatorCoordinateUnits() * boost;
        // y is flipped between mercator space (south = +y) and the model (north = +y)
        m.makeTranslation(mc.x - this.cx, mc.y - this.cy, mc.z).scale(new THREE.Vector3(s, -s, s));
        rot.makeRotationZ(-rad(p.dTrack));
        m.multiply(rot);
        p.obj.matrix.copy(m);
        p.obj.visible = true;
        if (p.model === 'heli') {
          // the blades turn (a little different per helicopter so a fleet does not run in step)
          const { main, tail } = p.obj.userData as { main: THREE.Object3D; tail: THREE.Object3D };
          const phase = (p.hex.charCodeAt(0) + p.hex.charCodeAt(p.hex.length - 1)) % 7;
          main.rotation.z = now * 0.011 + phase;
          tail.rotation.x = now * 0.025 + phase;
        }
        this.syncShadow(p, air, elev, s, rot, m);
        this.syncDrop(p, air, elev);
        drawn.push(p);
      } else {
        for (const o of [p.obj, p.shadow, p.drop]) if (o) o.visible = false;
      }
      this.syncTrail(p, elev, flat);
      this.syncPulse(p, now, mpp, elev, flat);
    }
    this.mats.now.value = now;
    this.syncLabels(drawn);
    this.syncForecast(mpp, flat);
    for (const mat of [this.mats.line, this.mats.lineSel]) mat.uniforms.uRes.value.set(map.getCanvas().width, map.getCanvas().height);
    this.camera.projectionMatrix.copy(this.proj);
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    if (now - this.lastFrameHook > 250) {
      this.lastFrameHook = now;
      this.hooks.frame(drawn);
    }
    if (this.tracker.planes.size && !document.hidden) map.triggerRepaint();
  }

  /** Screen position (CSS px) of a point with the last drawn matrix, null behind the camera. */
  private screenOf(lon: number, lat: number, alt: number, v = new THREE.Vector4()): [number, number] | null {
    const canvas = this.map.getCanvas();
    const mc = MercatorCoordinate.fromLngLat([lon, lat], alt);
    v.set(mc.x - this.cx, mc.y - this.cy, mc.z, 1).applyMatrix4(this.proj);
    if (v.w <= 0) return null;
    return [(v.x / v.w * 0.5 + 0.5) * canvas.clientWidth, (1 - (v.y / v.w * 0.5 + 0.5)) * canvas.clientHeight];
  }

  /** Callsign above every drawn model; moved here every frame so it never trails behind while zooming. */
  private syncLabels(drawn: PlaneState[]) {
    const box = this.labelBox;
    if (!box) return;
    const zoom = this.map.getZoom();
    // distance above the model: grows with the zoom (the models get bigger)
    const lift = 17 + Math.min(1, Math.max(0, (zoom - 15) / 3.5)) * 24;
    const seen = new Set<string>();
    const v = new THREE.Vector4();
    for (const p of drawn) {
      const pos = this.screenOf(p.dLon, p.dLat, this.flatNow ? 1 : p.dAlt, v);
      if (!pos) continue;
      let el = this.labels.get(p.hex);
      if (!el) {
        el = document.createElement('div');
        el.style.cssText =
          'position:absolute;left:0;top:0;white-space:pre;text-align:center;font:700 12px/1.2 system-ui,sans-serif;color:#fff;' +
          'text-shadow:0 0 3px rgba(10,12,16,.95),0 0 3px rgba(10,12,16,.95),0 0 2px rgba(10,12,16,.95);will-change:transform';
        box.append(el);
        this.labels.set(p.hex, el);
      }
      const callsign = String(p.props.callsign ?? '');
      const icao = zoom >= 16 ? String(p.props.icao ?? '') : '';
      const text = icao ? `${callsign}\n${icao}` : callsign;
      if (el.textContent !== text) el.textContent = text;
      el.style.transform = `translate(${pos[0].toFixed(1)}px,${(pos[1] - lift).toFixed(1)}px) translate(-50%,-100%)`;
      seen.add(p.hex);
    }
    for (const [hex, el] of this.labels) {
      if (seen.has(hex)) continue;
      el.remove();
      this.labels.delete(hex);
    }
  }

  /**
   * The aircraft at a screen point (CSS px): its model, its trail line or the wall below the line.
   * The models cannot be picked by MapLibre, so the shapes are projected with the last drawn matrix.
   */
  pick(x: number, y: number): string | null {
    const canvas = this.map.getCanvas();
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const v = new THREE.Vector4();
    const screen = (lon: number, lat: number, alt: number): [number, number] | null => {
      const mc = MercatorCoordinate.fromLngLat([lon, lat], alt);
      v.set(mc.x - this.cx, mc.y - this.cy, mc.z, 1).applyMatrix4(this.proj);
      if (v.w <= 0) return null;
      return [(v.x / v.w * 0.5 + 0.5) * w, (1 - (v.y / v.w * 0.5 + 0.5)) * h];
    };
    const segDist = (a: [number, number], b: [number, number]) => {
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const t = dx || dy ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy))) : 0;
      return Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy));
    };
    const inTri = (a: [number, number], b: [number, number], c: [number, number]) => {
      const d = (p: [number, number], q: [number, number]) => (x - q[0]) * (p[1] - q[1]) - (p[0] - q[0]) * (y - q[1]);
      const d1 = d(a, b);
      const d2 = d(b, c);
      const d3 = d(c, a);
      return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
    };
    const now = performance.now();
    let best: string | null = null;
    let bestD = Infinity;
    const consider = (hex: string, d: number) => {
      if (d < bestD) {
        bestD = d;
        best = hex;
      }
    };
    for (const p of this.tracker.planes.values()) {
      if (!p.rig?.line.visible) continue;
      const flat = this.flatNow;
      const air = !flat && !p.ground && p.dAlt > 3;
      if (p.obj?.visible) {
        const c = screen(p.dLon, p.dLat, flat ? 1 : p.dAlt);
        if (c) consider(p.hex, Math.max(0, Math.hypot(x - c[0], y - c[1]) - 14));
      }
      const pts: [number, number, number, number][] = [...p.trail.map((t) => [t[0], t[1], flat ? 0.3 : t[2], t[3]] as [number, number, number, number]), [p.dLon, p.dLat, flat || p.ground ? 0.3 : p.dAlt, now]];
      let prevTop: [number, number] | null = null;
      let prevBot: [number, number] | null = null;
      for (const [lon, lat, alt, t] of pts) {
        const top = screen(lon, lat, alt);
        const bot = air ? screen(lon, lat, 0) : null;
        // faded-out parts of a trail cannot be picked
        if (top && prevTop && (this.selected === p.hex || now - t < TRAIL_FADE_MS)) {
          consider(p.hex, Math.max(0, segDist(prevTop, top) - 5));
          // the wall: two triangles between the trail and the ground
          if (bot && prevBot && alt < WALL_MAX_M && (inTri(prevTop, top, prevBot) || inTri(top, bot, prevBot))) consider(p.hex, 12);
        }
        prevTop = top;
        prevBot = bot;
      }
    }
    return bestD <= 12 ? best : null;
  }

  /** Flattened black copy of the model on the ground, straight below the aircraft. */
  private syncShadow(p: PlaneState, air: boolean, elev: number, scale: number, rot: THREE.Matrix4, m: THREE.Matrix4) {
    if (!p.shadow || p.shadowModel !== p.model) {
      p.shadow?.parent?.remove(p.shadow);
      const g = geos();
      p.shadow = new THREE.Mesh(p.model === 'heli' ? g.heli.body : g[p.model], this.mats.shadow);
      p.shadow.matrixAutoUpdate = false;
      p.shadow.renderOrder = 1;
      p.shadow.frustumCulled = false;
      p.shadowModel = p.model;
      this.scene.add(p.shadow);
    }
    p.shadow.visible = air;
    if (!air) return;
    const mc = MercatorCoordinate.fromLngLat([p.dLon, p.dLat], elev + 0.1);
    m.makeTranslation(mc.x - this.cx, mc.y - this.cy, mc.z).scale(new THREE.Vector3(scale, -scale, scale * 0.002));
    m.multiply(rot);
    p.shadow.matrix.copy(m);
  }

  /** A white, see-through sphere that grows and fades around an aircraft whose position just arrived. */
  private syncPulse(p: PlaneState, now: number, mpp: number, elev: number, flat: boolean) {
    const t = p.pulseAt ? (now - p.pulseAt) / PULSE_MS : 1;
    if (t >= 1) {
      if (p.pulse) {
        p.pulse.parent?.remove(p.pulse);
        (p.pulse.material as THREE.Material).dispose();
        p.pulse = undefined;
      }
      return;
    }
    if (!p.pulse) {
      p.pulse = new THREE.Mesh(this.pulseGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, depthTest: false }));
      p.pulse.matrixAutoUpdate = false;
      p.pulse.frustumCulled = false;
      p.pulse.renderOrder = 3;
      this.scene.add(p.pulse);
    }
    (p.pulse.material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - t) ** 1.5;
    // Radius in screen pixels, tied to the drawn size of the aircraft (about 60 m long, at least ~39 px
    // when zoomed out): not too big next to a big model when close, still visible when far away.
    // With many aircraft it is smaller (they all flash at once), but never below 12 px.
    const planePx = Math.max(60 / mpp, 39);
    const crowdK = Math.min(1, Math.max(0.6, Math.sqrt(40 / Math.max(1, this.tracker.planes.size))));
    const maxPx = Math.max(12, Math.min(56, 0.5 * planePx) * crowdK);
    const px = maxPx * (0.25 + 0.75 * (1 - (1 - t) ** 2));
    const mc = MercatorCoordinate.fromLngLat([p.dLon, p.dLat], (flat || p.ground ? 1 : p.dAlt) + elev);
    const s = mc.meterInMercatorCoordinateUnits() * px * mpp;
    p.pulse.matrix.makeTranslation(mc.x - this.cx, mc.y - this.cy, mc.z).scale(new THREE.Vector3(s, s, s));
    p.pulse.visible = true;
  }

  /** Thin, faint line from the aircraft straight down to the ground. */
  private syncDrop(p: PlaneState, air: boolean, elev: number) {
    if (!p.drop) {
      p.drop = new THREE.Line(this.drop, this.mats.drop);
      p.drop.matrixAutoUpdate = false;
      p.drop.frustumCulled = false;
      p.drop.renderOrder = 2;
      this.scene.add(p.drop);
    }
    p.drop.visible = air;
    if (!air) return;
    const mc = MercatorCoordinate.fromLngLat([p.dLon, p.dLat], elev);
    const s = mc.meterInMercatorCoordinateUnits();
    p.drop.matrix.makeTranslation(mc.x - this.cx, mc.y - this.cy, mc.z).scale(new THREE.Vector3(s, -s, s * p.dAlt));
  }

  /** Grey dashed line from the departure airport to the start of the trail and on to the destination. */
  private syncForecast(mpp: number, flat: boolean) {
    const p = this.selected ? this.tracker.planes.get(this.selected) : undefined;
    const r = this.route;
    if (!p || !r || r.hex !== p.hex) {
      if (this.forecast) this.forecast.line.visible = false;
      return;
    }
    if (!this.forecast) {
      this.forecast = new ForecastRig(this.mats.forecast);
      this.scene.add(this.forecast.line);
    }
    const alt = (a: number) => (flat || p.ground ? 0.3 : a);
    const legs: ForecastLeg[] = [];
    const first = p.trail[0];
    // the departure airport is only drawn to the trail when the data begins far away from it
    if (metres(r.origin[0], r.origin[1], first[0], first[1]) > 15000) legs.push({ from: [r.origin[0], r.origin[1], 0.3], to: [first[0], first[1], alt(first[2])], anchor: 'from' });
    if (metres(p.dLon, p.dLat, r.destination[0], r.destination[1]) > 3000) legs.push({ from: [p.dLon, p.dLat, alt(p.dAlt)], to: [r.destination[0], r.destination[1], 0.3], anchor: 'to' });
    const mpu = MercatorCoordinate.fromLngLat([p.dLon, p.dLat], 0).meterInMercatorCoordinateUnits();
    const o = this.forecast.update([p.dLon, p.dLat], legs, mpu);
    this.forecast.line.matrix.makeTranslation(o.x - this.cx, o.y - this.cy, 0);
    const cw = this.map.getCanvas();
    this.mats.forecast.uniforms.uRes.value.set(cw.width, cw.height);
    this.mats.forecast.uniforms.uDash.value = 14 * mpp; // one dash period = 14 screen px
  }

  private syncTrail(p: PlaneState, elev: number, flat: boolean) {
    if (!p.rig) {
      p.rig = new TrailRig();
      this.scene.add(p.rig.line, p.rig.wall);
    }
    const rig = p.rig;
    rig.sync(p, flat);
    const sel = this.selected === p.hex;
    rig.line.material = sel ? this.mats.lineSel : this.mats.line;
    rig.wall.material = sel ? this.mats.wallSel : this.mats.wall;
    rig.line.visible = true;
    const mc = MercatorCoordinate.fromLngLat([rig.lon0, rig.lat0], elev);
    const s = mc.meterInMercatorCoordinateUnits();
    rig.line.matrix.makeTranslation(mc.x - this.cx, mc.y - this.cy, mc.z).scale(new THREE.Vector3(s, -s, s));
    rig.wall.matrix.copy(rig.line.matrix);
  }
}
