import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MercatorCoordinate, type CustomLayerInterface, type Map as MlMap } from 'maplibre-gl';

// 3D aircraft near airports: a three.js layer inside MapLibre's GL context. Positions are
// reported every ~10 s, so every aircraft keeps a small state that is dead-reckoned from its
// ground speed and heading and eased towards each new report (no visible jumps).

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
  /** close enough to a known airport to be drawn as 3D model */
  near: boolean;
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
  trail: [number, number][];
  obj?: THREE.Object3D;
  objModel?: PlaneModel;
  objEmergency?: boolean;
}

const EXPIRE_MS = 60000;
const TRAIL_MAX = 150;
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
        this.planes.set(r.hex, { ...r, dLon: r.lon, dLat: r.lat, dAlt: r.altM, dTrack: r.track, at: now, seen: now, trail: [[r.lon, r.lat]] });
        continue;
      }
      // a plane that did not move since the last report keeps its old fix time → no new trail point
      const last = prev.trail[prev.trail.length - 1];
      if (metres(last[0], last[1], r.lon, r.lat) >= (r.ground ? 5 : 30)) {
        prev.trail.push([r.lon, r.lat]);
        if (prev.trail.length > TRAIL_MAX) prev.trail.shift();
      }
      Object.assign(prev, r, { at: now, seen: now });
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
      const dist = p.speedMs * elapsed;
      const tLat = p.lat + (dist * Math.cos(rad(p.track))) / M_PER_DEG;
      const tLon = p.lon + (dist * Math.sin(rad(p.track))) / (M_PER_DEG * Math.max(0.2, Math.cos(rad(p.lat))));
      p.dLat += (tLat - p.dLat) * kPos;
      p.dLon += (tLon - p.dLon) * kPos;
      p.dAlt += (p.altM - p.dAlt) * kAlt;
      p.dTrack = (p.dTrack + shortestDelta(p.dTrack, p.track) * kHdg + 360) % 360;
    }
  }

  private remove(hex: string, p: PlaneState) {
    this.planes.delete(hex);
    if (p.obj) {
      p.obj.parent?.remove(p.obj);
      disposeMaterials(p.obj);
    }
  }

  clear() {
    for (const [hex, p] of this.planes) this.remove(hex, p);
    this.lastStep = 0;
  }
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

export interface PlanesLayerHooks {
  /** is the 3D view currently wanted (layer on, zoomed in, mercator)? */
  active(): boolean;
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
  }

  onRemove() {
    this.tracker.clear();
    this.renderer?.dispose();
  }

  render(_gl: WebGL2RenderingContext, args: { defaultProjectionData: { mainMatrix: ArrayLike<number> } }) {
    if (!this.hooks.active()) {
      if (this.tracker.planes.size && this.lastFrameHook) {
        this.lastFrameHook = 0;
        this.hooks.frame([]);
      }
      return;
    }
    const now = performance.now();
    this.tracker.step(now);
    const drawn: PlaneState[] = [];
    const zoom = this.map.getZoom();
    // slightly enlarged when zoomed out so the planes stay recognisable
    const boost = zoom < 15 ? 2 ** ((15 - zoom) * 0.7) : 1;
    const terrain = this.map.getTerrain();
    const m = new THREE.Matrix4();
    const rot = new THREE.Matrix4();
    for (const p of this.tracker.planes.values()) {
      if (!p.near) {
        if (p.obj) p.obj.visible = false;
        continue;
      }
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
      const ground = p.ground ? 0.2 : 0;
      const elev = terrain ? (this.map.queryTerrainElevation([p.dLon, p.dLat]) ?? 0) : 0;
      const mc = MercatorCoordinate.fromLngLat([p.dLon, p.dLat], p.dAlt + elev + ground);
      const s = mc.meterInMercatorCoordinateUnits() * boost;
      // y is flipped between mercator space (south = +y) and the model (north = +y)
      m.makeTranslation(mc.x, mc.y, mc.z).scale(new THREE.Vector3(s, -s, s));
      rot.makeRotationZ(-rad(p.dTrack));
      m.multiply(rot);
      p.obj.matrix.copy(m);
      p.obj.visible = true;
      drawn.push(p);
    }
    this.camera.projectionMatrix.fromArray(args.defaultProjectionData.mainMatrix as number[]);
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    if (now - this.lastFrameHook > 250) {
      this.lastFrameHook = now;
      this.hooks.frame(drawn);
    }
    if (drawn.length && !document.hidden) this.map.triggerRepaint();
  }
}
