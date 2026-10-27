import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MercatorCoordinate, type CustomLayerInterface, type Map as MlMap } from 'maplibre-gl';
import type { Feature, Point } from 'geojson';

// 3D public transport vehicles: trains, S-Bahn, subway, trams, buses, coaches (and the odd GPS
// ferry). Low-poly models in a three.js layer inside MapLibre's GL context, painted in the
// livery colour of their mode (the same colour the 2D dots use). Used from VEH_ZOOM on the flat
// map; the 2D dot layers step aside then. Positions arrive every few seconds and are eased
// towards every new report; speeds with bearing are dead-reckoned in between.

/** from this zoom on the 3D models may replace the 2D dots (zoom 12 ≈ city blocks) */
const VEH_ZOOM = 12;
/** the 3D models only take over while this many vehicles are in view (active: more of them stay on) */
const VEH_MAX_ON = 120;
/** the 2D dots take back over above this many vehicles in view (hysteresis against flickering) */
const VEH_MAX_OFF = 200;
/** names are shown from this zoom on */
const LABEL_ZOOM = 8;
/** the smallest length of a model on screen (px) so vehicles stay visible when zoomed out */
const MIN_PX = 22;
/** a report older than this is no longer extrapolated (s) */
const MAX_EXTRAPOLATE_S = 90;
const KMH = 1 / 3.6;
const M_PER_DEG = 111320;

const rad = (d: number) => (d * Math.PI) / 180;
const shortestDelta = (from: number, to: number) => ((((to - from) % 360) + 540) % 360) - 180;

interface VehState {
  feature: Feature<Point>;
  props: Record<string, unknown>;
  /** matching key in the latest update and its stable match group */
  key: string;
  group: string;
  /** displayed (smoothed) position and orientation */
  dLon: number;
  dLat: number;
  dRot: number;
  seen: number;
  /** wall clock of the latest report and its dead-reckoned motion */
  at: number;
  speedMs: number;
  bearing: number;
  obj?: THREE.Mesh;
  objKey?: string;
  matched: boolean;
  /** screen position (CSS px) and radius of the model in the last drawn frame, for picking */
  sx: number;
  sy: number;
  rpx: number;
}

// ---------------------------------------------------------------------------
// Model categories

export type VehCat = 'highspeed' | 'rail' | 'sbahn' | 'subway' | 'tram' | 'bus' | 'coach' | 'ferry';

/** Model type for a vehicle: the rail modes build trains, everything else rides the road. */
export function vehicleCat(mode: string, rail: boolean): VehCat {
  switch (mode) {
    case 'HIGHSPEED_RAIL':
      return 'highspeed';
    case 'LONG_DISTANCE':
    case 'NIGHT_RAIL':
      return 'rail';
    case 'SUBURBAN':
      return 'sbahn';
    case 'SUBWAY':
    case 'METRO':
      return 'subway';
    case 'TRAM':
      return 'tram';
    case 'BUS':
      return 'bus';
    case 'COACH':
      return 'coach';
    case 'FERRY':
    case 'WATER':
      return 'ferry';
    default:
      return rail ? 'rail' : 'bus';
  }
}

// ---------------------------------------------------------------------------
// Geometry: metres, nose towards +y, x east, z up, touching z = 0. Every part
// carries its colour as a vertex colour, so each model is a single mesh that
// shares one vertex-coloured material with all the others.

const WHITE = 0xf2f4f6;
const DARK = 0x37474f; // window bands
const ROOF = 0xb8bfc6;
const DARK2 = 0x45535b; // frames, skirts
const WHEEL = 0x22262b;
const GREY = 0x9aa2a9; // pantographs

const modelMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });

/** Fill every vertex of a geometry with one colour. */
function paint(g: THREE.BufferGeometry, color: number): THREE.BufferGeometry {
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

const merge = (parts: THREE.BufferGeometry[]) =>
  mergeGeometries(
    parts.map((g) => {
      const n = g.index ? g.toNonIndexed() : g;
      n.deleteAttribute('uv');
      return n;
    }),
  )!;

/** Box: (x, y) centre, z = bottom; an optional tilt around x slants the roof. After tilting,
 * the lowest point of the part sits back on z (otherwise the outer edge would dig into the ground). */
function box(x: number, y: number, z: number, w: number, l: number, h: number, color: number, tilt = 0): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, l, h);
  if (tilt) g.rotateX(tilt);
  g.computeBoundingBox();
  g.translate(x, y, z - g.boundingBox!.min.z);
  return paint(g, color);
}

function cyl(x: number, y: number, z: number, r: number, h: number, color: number, segs = 10): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, h, segs);
  g.translate(x, y, z + h / 2);
  return paint(g, color);
}

/** Wheel lying on its side: (x, y) centre, z = axle height. */
function wheel(x: number, y: number, z: number, r: number, color: number, w = 0.28): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, w, 10).rotateZ(Math.PI / 2);
  g.translate(x, y, z);
  return paint(g, color);
}

/** Roof pantograph on a car at `cy`. */
function pantograph(cy: number, roofZ: number): THREE.BufferGeometry[] {
  return [box(0, cy, roofZ, 0.2, 0.2, 0.55, GREY), box(0, cy, roofZ + 0.55, 2.4, 0.32, 0.08, GREY)];
}

// ---------------------------------------------------------------------------

interface TrainOpts {
  cars: number;
  carLen: number;
  gap: number;
  w: number;
  h: number;
  z0: number;
  /** window bands: [z base, height] */
  bands: [number, number][];
  nose: 'wedge' | 'stream';
  wheelR?: number;
}

/** Extruded silhouette in the y–z plane: `pts` are (y, z) pairs, the extrusion of
 * `depth` runs centred along x. Exact nose profiles — no tilted boxes. */
function profile(pts: [number, number][], depth: number, color: number): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (const [a, b] of pts.slice(1)) s.lineTo(a, b);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  // (x, y, z) → (z, x, y): shape (a, b) becomes model (y, z), the extrusion runs along +x
  g.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1));
  g.translate(-depth / 2, 0, 0);
  return paint(g, color);
}

/**
 * Wedge nose at the end face `endY`: an extruded side silhouette sinking into the body.
 * The roof falls towards the tip, the tip keeps a small upright mouth. `mouth` builds the
 * long streamlined end (highspeed) in white livery, a short blunt one otherwise.
 */
function endNose(o: TrainOpts, endY: number, c: number, dir: 1 | -1, mouth = o.nose === 'stream', N = mouth ? 10.5 : 2.7): THREE.BufferGeometry[] {
  const wc = mouth ? WHITE : c;
  const tip = o.h > 3 ? 0.8 : 0.55; // height of the upright tip, relative to the body base
  const pts: [number, number][] = [
    [endY, o.z0 + o.h], // roof at the end face
    [endY + dir * N * 0.42, o.z0 + o.h - (mouth ? 1.7 : o.h > 3 ? 0.5 : 0.9)],
    [endY + dir * N, o.z0 + tip],
    [endY + dir * N, o.z0],
    [endY, o.z0],
  ];
  // windscreen: a thin slab lying on the upper slope, narrower than the body
  const wy1 = endY + dir * N * 0.3;
  const wz1 = o.z0 + o.h - 0.55;
  const wy2 = endY + dir * N * 0.78;
  const wz2 = o.z0 + tip + 0.28;
  const glass: [number, number][] = [
    [wy1, wz1],
    [wy2, wz2],
    [wy1, wz1 - 0.42],
    [wy2, wz2 - 0.42],
  ];
  // livery band follows the slope between z0+0.5 and z0+1.0 (matches the body stripe)
  const band: [number, number][] = [
    [endY, o.z0 + 1.0],
    [endY + dir * N, o.z0 + 1.0],
    [endY + dir * N, o.z0 + 0.5],
    [endY, o.z0 + 0.5],
  ];
  return [profile(pts, o.w - 0.1, wc), profile(glass, o.w - 0.95, DARK), profile(band, o.w + 0.1, c)];
}

function trainModel(o: TrainOpts, c: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const step = o.carLen + o.gap;
  const half = ((o.cars - 1) * step) / 2;
  const wr = o.wheelR ?? 0.45;
  for (let i = 0; i < o.cars; i++) {
    const cy = half - i * step;
    // body, underframe, window bands, roof
    parts.push(box(0, cy, o.z0, o.w, o.carLen, o.h, c));
    parts.push(box(0, cy, o.z0 - 0.55, o.w - 0.3, o.carLen - 0.3, 0.55, DARK2));
    for (const [bz, bh] of o.bands) parts.push(box(0, cy, bz, o.w + 0.14, o.carLen - 1.6, bh, DARK));
    parts.push(box(0, cy, o.z0 + o.h, o.w - 0.45, o.carLen - 0.4, 0.22, ROOF));
    // wheels + bogies
    for (const dy of [o.carLen / 2 - 2.2, -(o.carLen / 2 - 2.2)]) {
      for (const dx of [-o.w / 2 + 0.68, o.w / 2 - 0.68]) {
        parts.push(box(dx, cy + dy, o.z0 - 0.5, o.w - 1.0, 2.6, 0.9, DARK2));
        parts.push(wheel(dx, cy + dy, wr, wr, WHEEL));
      }
    }
    // pantograph on the middle car
    if (i === Math.floor(o.cars / 2)) parts.push(...pantograph(cy, o.z0 + o.h + 0.22));
    // slanted ends on the outer cars
    if (o.nose !== 'stream') {
      if (i === 0 || o.cars === 1) parts.push(...endNose(o, half + o.carLen / 2, c, 1));
      if (i === o.cars - 1 || o.cars === 1) parts.push(...endNose(o, -half - o.carLen / 2, c, -1));
    }
  }
  // highspeed: one long streamlined body with profile noses and a coloured stripe
  if (o.nose === 'stream') {
    const L = o.carLen; // body length, spans -L/2 .. L/2
    parts.push(box(0, 0, 1.0, o.w + 0.12, L, 0.5, c)); // livery stripe
    parts.push(box(0, 0, 2.2, o.w + 0.12, L - 5, 0.62, DARK)); // window band
    parts.push(box(0, 0, o.z0 + o.h - 0.12, o.w - 0.5, L - 0.6, 0.22, ROOF));
    parts.push(...endNose(o, L / 2, c, 1, true, 10.5)); // nose
    parts.push(...endNose(o, -L / 2, c, -1, true, 7)); // shorter tail
    // wheels
    for (const dy of [L / 2 - 4, L / 2 - 9, -L / 2 + 4, -L / 2 + 9]) {
      for (const dx of [-o.w / 2 + 0.68, o.w / 2 - 0.68]) parts.push(wheel(dx, dy, 0.45, 0.45, WHEEL));
    }
  }
  return merge(parts);
}

// ---------------------------------------------------------------------------
// The models, each painted in its mode colour (the toggles' colours: ICE red,
// S-Bahn teal, U-Bahn blue, tram pink, bus violet …).

interface Spec {
  len: number;
  build(c: number): THREE.BufferGeometry;
}

const trainSpec = (
  cars: number,
  carLen: number,
  gap: number,
  w: number,
  h: number,
  z0: number,
  bands: [number, number][],
  nose: TrainOpts['nose'],
  wheelR = 0.45,
): Spec => ({ len: cars * carLen + (cars - 1) * gap + 2.6, build: (c) => trainModel({ cars, carLen, gap, w, h, z0, bands, nose, wheelR }, c) });

const SPECS: Record<VehCat, Spec> = {
  highspeed: {
    len: 60,
    build(c) {
      return trainModel(
        { cars: 1, carLen: 34, gap: 0, w: 2.95, h: 2.95, z0: 0.5, bands: [[2.3, 0.65]], nose: 'stream' },
        c,
      );
    },
  },
  rail: trainSpec(3, 12.8, 0.85, 2.88, 2.55, 0.62, [[1.95, 0.68]], 'wedge'),
  sbahn: trainSpec(3, 12.3, 0.7, 2.95, 2.95, 0.72, [[1.45, 1.4]], 'wedge'),
  subway: trainSpec(3, 13, 0.4, 3.05, 3.55, 0.66, [[2.5, 0.85]], 'wedge'),
  tram: trainSpec(5, 5.35, 0.5, 2.3, 2.75, 0.55, [[2.0, 0.78]], 'wedge', 0.35),
  bus: {
    len: 12,
    build(c) {
      const parts: THREE.BufferGeometry[] = [
        box(0, 0, 0.95, 2.5, 12, 1.8, c), // body
        box(0, 0, 1.7, 2.56, 11.5, 0.9, DARK), // window band incl. windshields
        box(0, 0, 0.2, 2.35, 11.5, 0.8, DARK2), // skirt
        box(0, 0, 2.75, 2.4, 11.8, 0.14, WHITE), // roof
      ];
      for (const y of [3.55, -3.55]) {
        for (const x of [-1.05, 1.05]) parts.push(wheel(x, y, 0.47, 0.45, WHEEL));
      }
      return merge(parts);
    },
  },
  coach: {
    len: 13.5,
    build(c) {
      const parts: THREE.BufferGeometry[] = [
        box(0, 0, 1.05, 2.55, 13.4, 2.0, c), // body
        box(0, 0, 1.95, 2.6, 12.4, 0.9, DARK), // window band
        box(0, 0, 0.22, 2.4, 13.2, 0.9, DARK2), // luggage skirt
        box(0, 0, 3.05, 2.45, 13.1, 0.14, WHITE),
      ];
      for (const y of [4.2, -4.2]) {
        for (const x of [-1.1, 1.1]) parts.push(wheel(x, y, 0.5, 0.48, WHEEL));
      }
      return merge(parts);
    },
  },
  ferry: {
    len: 26,
    build(c) {
      // small white hull, cabin in the line colour, funnel
      const hb = 4; // half beam
      const s = new THREE.Shape();
      s.moveTo(-hb * 0.9, -13);
      s.lineTo(hb * 0.9, -13);
      s.lineTo(hb, -8);
      s.lineTo(hb, 5.5);
      s.lineTo(hb * 0.45, 13);
      s.lineTo(-hb * 0.45, 13);
      s.lineTo(-hb, 5.5);
      s.lineTo(-hb, -8);
      s.closePath();
      const hull = paint(new THREE.ExtrudeGeometry(s, { depth: 2.4, bevelEnabled: false }), WHITE);
      hull.translate(0, 0, 0);
      const parts: THREE.BufferGeometry[] = [
        paint(new THREE.ExtrudeGeometry(s, { depth: 0.5, bevelEnabled: false }), DARK2).translate(0, 0, -0.1), // boot
        hull,
        box(0, -2, 2.4, 5.6, 9, 2.6, c), // cabin
        box(0, -2, 2.9, 5.9, 6, 1.1, DARK), // cabin windows
        box(0, 6, 2.4, 3.4, 3.6, 2.2, WHITE), // wheelhouse
        box(0, 6, 3.4, 2.6, 2.2, 0.9, DARK),
        cyl(0, -8.5, 5, 0.9, 2.6, c, 10), // funnel
        box(0, 0, 5.0, 6.4, 10, 0.18, GREY), // deck
      ];
      return merge(parts);
    },
  },
};

const geometryCache = new Map<string, THREE.BufferGeometry>();
const geometry = (cat: VehCat, livery: number): THREE.BufferGeometry =>
  geometryCache.get(`${cat}|${livery}`) ?? geometryCache.set(`${cat}|${livery}`, SPECS[cat].build(livery)).get(`${cat}|${livery}`)!;

function makeModel(cat: VehCat, livery: number): THREE.Mesh {
  const o = new THREE.Mesh(geometry(cat, livery), modelMat);
  o.matrixAutoUpdate = false;
  return o;
}

export interface VehiclesLayerHooks {
  /** are trains or public transport switched on? */
  enabled(): boolean;
  /** the 3D models take over from (true) or give back to (false) the 2D dots */
  modeChanged(on: boolean): void;
}

export class VehiclesLayer implements CustomLayerInterface {
  readonly id = 'vehicles-3d';
  readonly type = 'custom' as const;
  readonly renderingMode = '3d' as const;
  private map!: MlMap;
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.Camera();
  private proj = new THREE.Matrix4();
  private states = new Map<string, VehState>();
  private lastStep = 0;
  private lastOn = false;
  /** names: plain elements moved every frame with the same matrix as the models */
  private labelBox?: HTMLDivElement;
  private labels = new Map<string, HTMLDivElement>();

  constructor(private hooks: VehiclesLayerHooks) {
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(0.4, -0.6, 1);
    this.scene.add(sun);
  }

  /** Latest positions of all vehicles. Each update replaces the full set; unmatched vehicles fade out. */
  setFeatures(features: Feature<Point>[]) {
    const now = performance.now();
    const wall = Date.now();
    // previous states grouped by their match group: several GPS vehicles can share
    // a group (same feed, line and mode), trip ids and train numbers are unique
    const byGroup = new Map<string, VehState[]>();
    for (const s of this.states.values()) {
      let list = byGroup.get(s.group);
      if (!list) byGroup.set(s.group, (list = []));
      list.push(s);
    }
    const used = new Set<string>();
    for (const f of features) {
      const p = (f.properties ?? {}) as Record<string, unknown>;
      const base =
        p.src === 'transitous'
          ? `t|${p.id}`
          : p.src === 'amtrak'
            ? `a|${p.name}`
            : p.src === 'fi'
              ? `fi|${p.num}`
              : `g|${p.feed}|${p.name}|${p.mode}`;
      let key = base;
      if (used.has(key)) {
        for (let k = 1; ; k++) {
          key = `${base}#${k}`;
          if (!used.has(key)) break;
        }
      }
      used.add(key);
      const cands = byGroup.get(base)?.filter((c) => !c.matched) ?? [];
      let best: VehState | undefined;
      let bestD = Infinity;
      const lon = f.geometry.coordinates[0];
      const lat = f.geometry.coordinates[1];
      const cos = Math.cos(rad(lat));
      for (const c of cands) {
        const d = Math.hypot((c.dLon - lon) * cos, c.dLat - lat) * M_PER_DEG;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      // GPS vehicles of one line share a group: match by position only; single-candidate
      // groups (trip ids, train numbers) always match
      best = cands.length === 1 ? cands[0] : bestD <= 5000 ? best : undefined;
      if (best) {
        this.applyReport(best, f, wall);
        if (best.key !== key) {
          this.labels.get(best.key)?.remove();
          this.labels.delete(best.key);
          this.states.delete(best.key);
          best.key = key;
          this.states.set(key, best);
        }
      } else {
        const bearing0 = reportBearing(p, 0, 0, 0, 0, false);
        const s: VehState = {
          feature: f,
          props: p,
          key,
          group: base,
          dLon: lon,
          dLat: lat,
          dRot: bearing0 >= 0 ? bearing0 : 0,
          seen: now,
          at: wall,
          speedMs: reportSpeed(p),
          bearing: bearing0,
          matched: true,
          sx: -1e4,
          sy: -1e4,
          rpx: 0,
        };
        this.states.set(key, s);
      }
    }
    // everything no longer in the set is dropped: immediately when another update delivered
    // vehicles (a mode was switched off or a vehicle left the view), with a short grace after
    // an empty update (feed hiccup) so nothing flashes off and back on
    const staleMs = features.length ? 0 : 15000;
    for (const [k, s] of this.states) {
      if (!s.matched && now - s.seen > staleMs) {
        if (s.obj) {
          s.obj.parent?.remove(s.obj);
          s.obj = undefined;
        }
        this.labels.get(k)?.remove();
        this.labels.delete(k);
        this.states.delete(k);
      } else s.matched = false;
    }
    this.map?.triggerRepaint();
  }

  /** New report on a matched vehicle: derive the bearing from the movement if there is none. */
  private applyReport(s: VehState, f: Feature<Point>, wall: number) {
    const [lon, lat] = f.geometry.coordinates;
    const [pLon, pLat] = s.feature.geometry.coordinates;
    const dist = Math.hypot((lon - pLon) * Math.cos(rad(lat)), lat - pLat) * M_PER_DEG;
    const props = (f.properties ?? {}) as Record<string, unknown>;
    const bearing = reportBearing(s.props, pLon, pLat, lon, lat, dist > 15);
    s.feature = f;
    s.props = props;
    s.at = wall;
    s.seen = performance.now();
    s.speedMs = reportSpeed(s.props);
    if (bearing >= 0) s.bearing = bearing;
    s.matched = true;
  }

  onAdd(map: MlMap, gl: WebGL2RenderingContext) {
    this.map = map;
    this.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
    this.renderer.autoClear = false;
    this.labelBox = document.createElement('div');
    this.labelBox.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:1';
    map.getCanvasContainer().appendChild(this.labelBox);
  }

  onRemove() {
    this.renderer?.dispose();
    this.labelBox?.remove();
    this.labels.clear();
    this.states.clear();
  }

  /** Is the 3D mode on (models drawn, 2D dots and their names given way)? */
  isActive() {
    return this.lastOn;
  }

  /** The vehicle whose model is under a screen point (CSS px): MapLibre cannot pick the models. */
  pick(x: number, y: number): Feature<Point> | null {
    let best: Feature<Point> | null = null;
    let bestD = Infinity;
    for (const s of this.states.values()) {
      if (!s.obj?.visible) continue;
      const d = Math.hypot(x - s.sx, y - s.sy) - Math.max(s.rpx, 8);
      if (d < bestD) {
        bestD = d;
        best = s.feature;
      }
    }
    return bestD <= 4 ? best : null;
  }

  private active() {
    if (!this.hooks.enabled() || this.map.getZoom() < VEH_ZOOM || this.map.getProjection()?.type === 'globe' && this.map.getZoom() < 12) return false;
    // the models lag when there are too many at once (a whole city at once): only take over
    // while the view is small enough, with hysteresis so switching does not flicker
    const b = this.map.getBounds();
    const padLon = (b.getEast() - b.getWest()) * 0.1;
    const padLat = (b.getNorth() - b.getSouth()) * 0.1;
    let n = 0;
    for (const s of this.states.values()) {
      const [lon, lat] = s.feature.geometry.coordinates;
      if (lon > b.getWest() - padLon && lon < b.getEast() + padLon && lat > b.getSouth() - padLat && lat < b.getNorth() + padLat) n++;
    }
    return n <= (this.lastOn ? VEH_MAX_OFF : VEH_MAX_ON);
  }

  render(_gl: WebGL2RenderingContext, args: { defaultProjectionData: { mainMatrix: ArrayLike<number> } }) {
    const on = this.active();
    if (on !== this.lastOn) {
      this.lastOn = on;
      queueMicrotask(() => this.hooks.modeChanged(on));
    }
    if (!on) {
      for (const s of this.states.values()) {
        if (s.obj) s.obj.visible = false;
        this.syncLabel(s, false);
      }
      return;
    }
    const map = this.map;
    const now = performance.now();
    const dt = this.lastStep ? Math.min(0.25, (now - this.lastStep) / 1000) : 0;
    this.lastStep = now;
    const k = 1 - Math.exp(-dt / 1.0);
    const kRot = 1 - Math.exp(-dt / 0.7);
    // everything is placed relative to the map centre (Float32 jitter, see planes3d.ts)
    const centre = MercatorCoordinate.fromLngLat(map.getCenter(), 0);
    this.proj.fromArray(args.defaultProjectionData.mainMatrix as number[]).multiply(new THREE.Matrix4().makeTranslation(centre.x, centre.y, 0));
    const center = map.getCenter();
    const mpp = (40075016 * Math.cos(rad(center.lat))) / (512 * 2 ** map.getZoom());
    const b = map.getBounds();
    const padLon = (b.getEast() - b.getWest()) * 0.3;
    const padLat = (b.getNorth() - b.getSouth()) * 0.3;
    const wall = Date.now();
    const canvas = map.getCanvas();
    const v = new THREE.Vector4();
    const labels = map.getZoom() >= LABEL_ZOOM;
    const m = new THREE.Matrix4();
    const rot = new THREE.Matrix4();
    for (const s of this.states.values()) {
      const p = s.props;
      // dead reckoning from the last report (speed + heading); without speed just ease
      const elapsed = Math.min(MAX_EXTRAPOLATE_S, Math.max(0, (wall - s.at) / 1000));
      // the speed runs on with the reported value for a minute at most
      const moved = s.speedMs > 0.5 && s.bearing >= 0;
      const dist = moved ? s.speedMs * Math.min(60, elapsed) : 0;
      const fx = s.feature.geometry.coordinates[0];
      const fy = s.feature.geometry.coordinates[1];
      const cosLat = Math.max(0.2, Math.cos(rad(fy)));
      const tLon = moved ? fx + (dist * Math.sin(rad(s.bearing))) / (M_PER_DEG * cosLat) : fx;
      const tLat = moved ? fy + (dist * Math.cos(rad(s.bearing))) / M_PER_DEG : fy;
      const tRot = s.bearing >= 0 ? s.bearing : s.dRot;
      if (dt === 0 || Math.abs(tLon - s.dLon) > 0.05) {
        s.dLon = tLon;
        s.dLat = tLat;
        s.dRot = tRot;
      } else {
        s.dLon += (tLon - s.dLon) * k;
        s.dLat += (tLat - s.dLat) * k;
        s.dRot += shortestDelta(s.dRot, tRot) * kRot;
      }
      const inView = s.dLon > b.getWest() - padLon && s.dLon < b.getEast() + padLon && s.dLat > b.getSouth() - padLat && s.dLat < b.getNorth() + padLat;
      if (!inView) {
        if (s.obj) s.obj.visible = false;
        this.syncLabel(s, false);
        continue;
      }
      const hex = String(p.color ?? '').trim();
      const livery = /^#[0-9a-fA-F]{6}$/.test(hex) ? parseInt(hex.slice(1), 16) : 0x90a4ae;
      const mode = String(p.mode ?? '');
      const cat = vehicleCat(mode, p.rail === true);
      const key = `${cat}|${livery}`;
      if (!s.obj || s.objKey !== key) {
        if (s.obj) s.obj.parent?.remove(s.obj);
        s.obj = makeModel(cat, livery);
        s.objKey = key;
        this.scene.add(s.obj);
      }
      const mc = MercatorCoordinate.fromLngLat([s.dLon, s.dLat], 0);
      const boost = Math.max(1, (MIN_PX * mpp) / SPECS[cat].len);
      const sc = mc.meterInMercatorCoordinateUnits() * boost;
      // y is flipped between mercator space (south = +y) and the model (north = +y)
      m.makeTranslation(mc.x - centre.x, mc.y - centre.y, mc.z).scale(new THREE.Vector3(sc, -sc, sc));
      rot.makeRotationZ(-rad(s.dRot));
      m.multiply(rot);
      s.obj.matrix.copy(m);
      s.obj.visible = true;
      // screen position for the name and for picking (the models cannot be picked by MapLibre)
      v.set(mc.x - centre.x, mc.y - centre.y, mc.z, 1).applyMatrix4(this.proj);
      const modelPx = Math.max(SPECS[cat].len / mpp, MIN_PX);
      s.rpx = modelPx / 2;
      if (v.w > 0) {
        s.sx = (v.x / v.w * 0.5 + 0.5) * canvas.clientWidth;
        s.sy = (1 - (v.y / v.w * 0.5 + 0.5)) * canvas.clientHeight;
        this.syncLabel(s, labels);
      } else {
        s.sx = s.sy = -1e4;
        this.syncLabel(s, false);
      }
    }
    this.camera.projectionMatrix.copy(this.proj);
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    if (this.states.size && !document.hidden) map.triggerRepaint();
  }

  private syncLabel(s: VehState, on: boolean) {
    const box = this.labelBox;
    const name = String(s.props.name ?? '');
    let el = this.labels.get(s.key);
    if (!on || !box || !name) {
      if (el) el.style.display = 'none';
      return;
    }
    if (!el) {
      el = document.createElement('div');
      el.style.cssText =
        'position:absolute;left:0;top:0;white-space:nowrap;text-align:center;font:500 11px/1.2 system-ui,sans-serif;color:#ffffff;' +
        'text-shadow:0 0 3px rgba(10,12,16,.95),0 0 3px rgba(10,12,16,.95),0 0 2px rgba(10,12,16,.95);will-change:transform';
      box.append(el);
      this.labels.set(s.key, el);
    }
    if (el.textContent !== name) el.textContent = name;
    el.style.display = '';
    el.style.transform = `translate(${s.sx.toFixed(1)}px,${(s.sy + Math.max(s.rpx, 8) * 0.6 + 6).toFixed(1)}px) translate(-50%,0)`;
  }
}

// ---------------------------------------------------------------------------

/** Reported speed in m/s (0 when unknown): `speed` is km/h in every feed. */
function reportSpeed(p: Record<string, unknown>): number {
  const v = Number(p.speed);
  return Number.isFinite(v) && v > 0 ? v * KMH : 0;
}

/**
 * Reported bearing in degrees, normalised to 0–360 (−1 = unknown, e.g. the very first
 * report before the vehicle has moved). The bearings of the interpolated Transitous
 * features come out of atan2 and can be negative – they are wrapped. GPS feeds report
 * one per report; the Finnish GPS trains do not – for anything without a report's
 * bearing it is derived from the movement between two reports.
 */
function reportBearing(p: Record<string, unknown>, prevLon: number, prevLat: number, lon: number, lat: number, moved: boolean): number {
  const b = Number(p.bearing);
  if (Number.isFinite(b)) {
    const deg = ((b % 360) + 360) % 360;
    if (deg > 0) return deg; // 0: north is indistinguishable from "no bearing" – derive then
  }
  if (!moved) return -1;
  const dLat = lat - prevLat;
  const dLon = (lon - prevLon) * Math.cos(rad(lat));
  if (Math.abs(dLat) < 1e-7 && Math.abs(dLon) < 1e-7) return -1;
  return ((Math.atan2(dLon, dLat) * 180 / Math.PI) % 360 + 360) % 360;
}
