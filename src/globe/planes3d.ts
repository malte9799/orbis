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
  /** [lon, lat, altitude m] of the positions reported so far */
  trail: [number, number, number][];
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

const EXPIRE_MS = 60000;
const PULSE_MS = 1300;
const TRAIL_MAX = 150;
/** share of the reported ground speed used to move an aircraft between two reports */
const EXTRAPOLATE = 0.9;
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

  feed(reports: PlaneReport[], now: number) {
    for (const r of reports) {
      const prev = this.planes.get(r.hex);
      if (!prev) {
        this.planes.set(r.hex, { ...r, dLon: r.lon, dLat: r.lat, dAlt: r.altM, dTrack: r.track, at: now, seen: now, pulseAt: now, trail: [[r.lon, r.lat, trailAlt(r)]] });
        continue;
      }
      // a plane that did not move since the last report keeps its old fix time → no new trail point
      const last = prev.trail[prev.trail.length - 1];
      if (metres(last[0], last[1], r.lon, r.lat) >= (r.ground ? 5 : 30)) {
        prev.trail.push([r.lon, r.lat, trailAlt(r)]);
        if (prev.trail.length > TRAIL_MAX) prev.trail.shift();
      }
      Object.assign(prev, r, { at: now, seen: now, pulseAt: now });
    }
    for (const [hex, p] of this.planes) if (now - p.seen > EXPIRE_MS) this.remove(hex, p);
  }

  /** Advance the displayed state to `now` (ms). */
  step(now: number) {
    const dt = this.lastStep ? Math.min(0.25, (now - this.lastStep) / 1000) : 0;
    this.lastStep = now;
    const kPos = 1 - Math.exp(-dt / 1.0);
    const kAlt = 1 - Math.exp(-dt / 1.5);
    const kHdg = 1 - Math.exp(-dt / 0.7);
    for (const p of this.planes.values()) {
      const elapsed = Math.min(30, (now - p.at) / 1000);
      // a little slower than reported: running ahead of the next report would pull the plane back
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
      p.dLon += (dx * kPos) / (M_PER_DEG * cosLat);
      p.dLat += (dy * kPos) / M_PER_DEG;
      p.dAlt += (p.altM - p.dAlt) * kAlt;
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

function heliParts(): { body: THREE.BufferGeometry; rotor: THREE.BufferGeometry } {
  const parts: THREE.BufferGeometry[] = [];
  parts.push(new THREE.SphereGeometry(1, 14, 10).scale(1.5, 3.6, 1.6).translate(0, 0.6, 2.4));
  parts.push(new THREE.CylinderGeometry(0.45, 0.22, 6.5, 8).translate(0, -5.6, 2.9));
  parts.push(new THREE.BoxGeometry(0.25, 1.2, 1.8).translate(0, -8.7, 3.5));
  parts.push(new THREE.BoxGeometry(0.2, 0.6, 0.6).translate(0, -1.5, 4.1));
  // skids
  for (const side of [-1, 1]) parts.push(new THREE.BoxGeometry(0.15, 5, 0.15).translate(side * 1.3, 0.4, 0.4));
  const flat = parts.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    n.deleteAttribute('uv');
    return n;
  });
  const rotor = new THREE.CylinderGeometry(6.2, 6.2, 0.06, 28).rotateX(Math.PI / 2).translate(0, 0.4, 4.3);
  return { body: mergeGeometries(flat)!, rotor };
}

let geoCache: { narrow: THREE.BufferGeometry; wide: THREE.BufferGeometry; heli: { body: THREE.BufferGeometry; rotor: THREE.BufferGeometry } } | null = null;
const geos = () => (geoCache ??= { narrow: airliner(1), wide: airliner(1.68), heli: heliParts() });

function makeModel(model: PlaneModel, emergency: boolean): THREE.Object3D {
  const color = emergency ? RED : YELLOW;
  const mat = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide });
  const g = geos();
  if (model === 'heli') {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(g.heli.body, mat));
    group.add(new THREE.Mesh(g.heli.rotor, new THREE.MeshBasicMaterial({ color: 0x20242b, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })));
    return group;
  }
  return new THREE.Mesh(g[model], mat);
}

// ---------------------------------------------------------------------------

const TRAIL_COLOUR = 0xff6a2b;

// Thick lines of constant pixel width. Each segment is a quad (4 vertices) that carries both of
// its end points; the vertex shader projects them and pushes the corners sideways in screen space.
const LINE_VERTEX = `
attribute vec3 aStart;
attribute vec3 aEnd;
attribute vec2 aCorner;
uniform vec2 uRes;
uniform float uWidth;
void main() {
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
void main() {
  gl_FragColor = vec4(1.0, 0.416, 0.169, uOpacity);
}`;

interface Mats {
  line: THREE.ShaderMaterial;
  lineSel: THREE.ShaderMaterial;
  wall: THREE.MeshBasicMaterial;
  wallSel: THREE.MeshBasicMaterial;
  shadow: THREE.MeshBasicMaterial;
  drop: THREE.LineBasicMaterial;
}

function makeMats(): Mats {
  const dpr = window.devicePixelRatio || 1;
  const line = (width: number, opacity: number) =>
    new THREE.ShaderMaterial({
      vertexShader: LINE_VERTEX,
      fragmentShader: LINE_FRAGMENT,
      uniforms: { uRes: { value: new THREE.Vector2(1, 1) }, uWidth: { value: width * dpr }, uOpacity: { value: opacity } },
      transparent: true,
      depthWrite: false,
    });
  const wall = (opacity: number) => new THREE.MeshBasicMaterial({ color: TRAIL_COLOUR, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false });
  return {
    // all trails faint, the one of the selected aircraft at full strength
    line: line(2, 0.55),
    lineSel: line(3, 1),
    wall: wall(0.06),
    wallSel: wall(0.15),
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

  private build(trail: [number, number, number][], flat: boolean) {
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
    const index = new Uint32Array(segs * 6);
    for (let i = 0; i < segs; i++) {
      for (let v = 0; v < 4; v++) {
        start.set(pts[i], (i * 4 + v) * 3);
        end.set(pts[i + 1], (i * 4 + v) * 3);
        corner.set([v >> 1, v & 1 ? 1 : -1], (i * 4 + v) * 2);
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
    g.setIndex(new THREE.BufferAttribute(index, 1));
    this.line.geometry = g;
    // wall: two triangles per segment, from the trail down to z = 0
    const w = new Float32Array(segs * 18);
    for (let i = 0; i < segs; i++) {
      const [ax, ay, az] = pts[i];
      const [bx, by, bz] = pts[i + 1];
      w.set([ax, ay, az, bx, by, bz, ax, ay, 0, bx, by, bz, bx, by, 0, ax, ay, 0], i * 18);
    }
    this.wallPos = w;
    this.wall.geometry.dispose();
    this.wall.geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(w, 3));
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

export interface PlanesLayerHooks {
  /** 'off': nothing drawn; 'flat': map not tilted (flat trails, models only without 2D icons); '3d': tilted */
  mode(): 'off' | 'flat' | '3d';
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
  }

  onRemove() {
    this.tracker.clear();
    this.renderer?.dispose();
    this.drop.dispose();
    this.pulseGeo.dispose();
    for (const m of Object.values(this.mats ?? {})) m.dispose();
  }

  render(_gl: WebGL2RenderingContext, args: { defaultProjectionData: { mainMatrix: ArrayLike<number> } }) {
    const mode = this.hooks.mode();
    if (mode === 'off') {
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
      const inView = p.dLon > b.getWest() - padLon && p.dLon < b.getEast() + padLon && p.dLat > b.getSouth() - padLat && p.dLat < b.getNorth() + padLat;
      if (!inView) {
        for (const o of [p.obj, p.shadow, p.drop, p.rig?.line, p.rig?.wall]) if (o) o.visible = false;
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
        this.syncShadow(p, air, elev, s, rot, m);
        this.syncDrop(p, air, elev);
        drawn.push(p);
      } else {
        for (const o of [p.obj, p.shadow, p.drop]) if (o) o.visible = false;
      }
      this.syncTrail(p, elev, flat);
      this.syncPulse(p, now, mpp, elev, flat);
    }
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
      const pts: [number, number, number][] = [...p.trail.map((t) => [t[0], t[1], flat ? 0.3 : t[2]] as [number, number, number]), [p.dLon, p.dLat, flat || p.ground ? 0.3 : p.dAlt]];
      let prevTop: [number, number] | null = null;
      let prevBot: [number, number] | null = null;
      for (const [lon, lat, alt] of pts) {
        const top = screen(lon, lat, alt);
        const bot = air ? screen(lon, lat, 0) : null;
        if (top && prevTop) {
          consider(p.hex, Math.max(0, segDist(prevTop, top) - 5));
          // the wall: two triangles between the trail and the ground
          if (bot && prevBot && (inTri(prevTop, top, prevBot) || inTri(top, bot, prevBot))) consider(p.hex, 12);
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
    // radius in screen pixels; the further out, the smaller (35 % at zoom 6.5, full size from zoom 13)
    const zoomK = 0.35 + 0.65 * Math.min(1, Math.max(0, (this.map.getZoom() - 6.5) / 6.5));
    const px = (8 + 38 * (1 - (1 - t) ** 2)) * zoomK;
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
