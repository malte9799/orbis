import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Map as MlMap } from 'maplibre-gl';
import type { GeoFrame, Vec3 } from './geo3d/frame';
import { GeoInstances } from './geo3d/instances';
import { GeoLine } from './geo3d/line';
import type { GeoPart, GeoTarget } from './geo3d/stage';
import { GeoWall } from './geo3d/wall';

// 3D aircraft: a part of the 3D stage. Positions are
// reported every ~10 s, so every aircraft keeps a small state that is dead-reckoned from its
// ground speed and heading and eased towards each new report (no visible jumps). Around each
// aircraft: its trail at the real altitude, a faint wall from the trail down to the ground,
// a thin line from the aircraft to the ground and its shadow.

export type PlaneModel = 'narrow' | 'wide' | 'heli' | 'car' | 'tug' | 'sonde';

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
  /** one entry per report: [altitude m, speed km/h, climb rate m/s, track °] (for the flight panel graphs) */
  hist: [number, number, number, number][];
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
const HIST_MAX = 120;
const histEntry = (r: PlaneReport): [number, number, number, number] => [r.altM, r.speedMs * 3.6, r.vsMs, r.track];
/** a trail fades out over this time (the one of the selected aircraft stays complete) */
const TRAIL_FADE_MS = 60000;
/** the wall below a trail only exists at low altitude (take-off, landing, helicopters): full below, gone above */
const WALL_FULL_M = 800;
const WALL_MAX_M = 1500;
/** share of the reported speed used to move an aircraft between two reports (1: not slowed down) */
const EXTRAPOLATE = 1;
const M_PER_DEG = 111320;
const YELLOW = 0xf2c94c;
/** far out, aircraft are this much smaller than near ones (there are thousands of them) */
const CROWD_SCALE = 0.4;
/** how often the far aircraft are worked out anew (ms): they hardly move on the screen */
const CROWD_IDLE_MS = 1000;
const CROWD_MOVING_MS = 100;
/** an aircraft this far outside of the screen (CSS px) is left out */
const CROWD_MARGIN_PX = 60;
/** how close to a far aircraft (CSS px) a click still hits it */
const CROWD_PICK_PX = 12;
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
        this.planes.set(r.hex, { ...r, dLon: r.lon, dLat: r.lat, dAlt: r.altM, dTrack: r.track, at: now, seen: now, pulseAt: now, hist: [histEntry(r)], trail: [[r.lon, r.lat, trailAlt(r), now]] });
        continue;
      }
      // a plane that did not move since the last report keeps its old fix time → no new trail point
      const last = prev.trail[prev.trail.length - 1];
      if (metres(last[0], last[1], r.lon, r.lat) >= (r.ground ? 5 : 30)) {
        prev.trail.push([r.lon, r.lat, trailAlt(r), now]);
        if (prev.trail.length > TRAIL_MAX) prev.trail.shift();
      }
      Object.assign(prev, r, { at: now, seen: now, pulseAt: now });
      prev.hist.push(histEntry(r));
      if (prev.hist.length > HIST_MAX) prev.hist.shift();
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

  /** Remove a whole group of tracked objects (e.g. `sonde:` the radiosondes), selected ones included. */
  drop(id: string) {
    for (const [hex, p] of this.planes) {
      if (!hex.startsWith(id)) continue;
      this.planes.delete(hex);
      if (hex === this.keep) this.keep = null;
      disposePlane(p);
    }
  }
}

/** altitude of a trail point: aircraft on the ground are lifted a little to stay above the map */
const trailAlt = (r: { ground: boolean; altM: number }) => (r.ground ? 0.3 : r.altM);

/** Take everything of an aircraft out of the scene and free what it owns (models share geometry). */
function disposePlane(p: PlaneState) {
  for (const o of [p.obj, p.shadow, p.drop, p.rig?.line.object, p.rig?.wall.object, p.pulse]) o?.parent?.remove(o);
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

export function airliner(k: number): THREE.BufferGeometry {
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

/** The same aircraft with very few triangles, for thousands of them far out. */
function farAirliner(k: number): THREE.BufferGeometry {
  const L = 37.6 * k;
  const r = 1.95 * k;
  const parts: THREE.BufferGeometry[] = [
    new THREE.CylinderGeometry(r, r * 0.4, L, 5).translate(0, 0, 3.3 * k),
    ...wingPanel(r * 0.7, 17.9 * k, 3.2 * k, 6.5 * k, 1.6 * k, 7.5 * k, 0.5 * k, 2.2 * k),
    ...wingPanel(r * 0.5, 6.2 * k, -L * 0.34, 4.2 * k, 1.3 * k, 3.4 * k, 0.35 * k, 3.6 * k),
    new THREE.BoxGeometry(0.5 * k, 7 * k, 6.4 * k).translate(0, -L * 0.4, 7 * k),
  ];
  return mergeGeometries(parts.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    n.deleteAttribute('uv');
    return n;
  }))!;
}

/** Parts of the helicopter: body, windscreen, main rotor blades, tail rotor blades (x right, y nose, z up). */
interface HeliGeos {
  body: THREE.BufferGeometry;
  glass: THREE.BufferGeometry;
  rotor: THREE.BufferGeometry;
  tail: THREE.BufferGeometry;
}

/** the helicopter model is built a little larger than its metre dimensions suggest */
const HELI_K = 1.15;

function heliParts(): HeliGeos {
  // only position + normal are needed; keep attributes identical so they can be merged
  const merge = (list: THREE.BufferGeometry[]) =>
    mergeGeometries(
      list.map((g) => {
        const n = g.index ? g.toNonIndexed() : g;
        n.deleteAttribute('uv');
        return n;
      }),
    )!.scale(HELI_K, HELI_K, HELI_K);
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

/** Parts of airport ground vehicles: body, windshield/windows, wheels, lightbar/beacon. */
interface VehicleGeos {
  body: THREE.BufferGeometry;
  glass: THREE.BufferGeometry;
  wheels: THREE.BufferGeometry;
  beacon: THREE.BufferGeometry;
}

const CAR_K = 1.35;
function followMeCarParts(): VehicleGeos {
  const merge = (list: THREE.BufferGeometry[]) =>
    mergeGeometries(
      list.map((g) => {
        const n = g.index ? g.toNonIndexed() : g;
        n.deleteAttribute('uv');
        return n;
      }),
    )!.scale(CAR_K, CAR_K, CAR_K);

  // Body: chassis, hood, rear box, bumpers, Follow-Me sign frame
  const bodyParts: THREE.BufferGeometry[] = [
    new THREE.BoxGeometry(2.1, 4.8, 0.75).translate(0, 0, 0.78),
    new THREE.BoxGeometry(2.0, 1.5, 0.35).translate(0, 1.55, 1.2),
    new THREE.BoxGeometry(2.05, 1.9, 0.85).translate(0, -1.35, 1.4),
    new THREE.BoxGeometry(2.2, 0.25, 0.35).translate(0, 2.45, 0.65),
    new THREE.BoxGeometry(2.2, 0.25, 0.35).translate(0, -2.45, 0.65),
    new THREE.BoxGeometry(1.4, 0.16, 0.52).translate(0, -0.6, 2.4),
  ];

  // Windshield & windows
  const glassParts: THREE.BufferGeometry[] = [
    new THREE.BoxGeometry(1.92, 1.85, 0.82).translate(0, 0.3, 1.55),
  ];

  // 4 Wheels
  const wheelParts: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    wheelParts.push(
      new THREE.CylinderGeometry(0.44, 0.44, 0.32, 10).rotateZ(Math.PI / 2).translate(side * 1.08, 1.45, 0.44),
      new THREE.CylinderGeometry(0.44, 0.44, 0.32, 10).rotateZ(Math.PI / 2).translate(side * 1.08, -1.45, 0.44),
    );
  }

  // Roof amber lightbar & Follow-Me display screen
  const beaconParts: THREE.BufferGeometry[] = [
    new THREE.BoxGeometry(1.5, 0.35, 0.18).translate(0, 0.5, 2.1),
    new THREE.BoxGeometry(1.28, 0.12, 0.42).translate(0, -0.6, 2.4),
  ];

  return {
    body: merge(bodyParts),
    glass: merge(glassParts),
    wheels: merge(wheelParts),
    beacon: merge(beaconParts),
  };
}

const TUG_K = 1.35;
function pushbackTugParts(): VehicleGeos {
  const merge = (list: THREE.BufferGeometry[]) =>
    mergeGeometries(
      list.map((g) => {
        const n = g.index ? g.toNonIndexed() : g;
        n.deleteAttribute('uv');
        return n;
      }),
    )!.scale(TUG_K, TUG_K, TUG_K);

  // Heavy low pushback tractor chassis, ballast sides, hitches
  const bodyParts: THREE.BufferGeometry[] = [
    new THREE.BoxGeometry(2.7, 6.2, 0.85).translate(0, 0, 0.9),
    new THREE.BoxGeometry(2.9, 4.2, 0.6).translate(0, 0, 0.8),
    new THREE.BoxGeometry(0.7, 0.6, 0.4).translate(0, 3.2, 0.65),
    new THREE.BoxGeometry(0.7, 0.6, 0.4).translate(0, -3.2, 0.65),
    new THREE.BoxGeometry(2.9, 1.0, 0.3).translate(0, 2.1, 0.55),
    new THREE.BoxGeometry(2.9, 1.0, 0.3).translate(0, -2.1, 0.55),
  ];

  // Low driver cab
  const glassParts: THREE.BufferGeometry[] = [
    new THREE.BoxGeometry(2.0, 2.0, 0.85).translate(0, 0.6, 1.6),
  ];

  // 4 massive heavy wheels
  const wheelParts: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    wheelParts.push(
      new THREE.CylinderGeometry(0.62, 0.62, 0.52, 12).rotateZ(Math.PI / 2).translate(side * 1.38, 1.7, 0.62),
      new THREE.CylinderGeometry(0.62, 0.62, 0.52, 12).rotateZ(Math.PI / 2).translate(side * 1.38, -1.7, 0.62),
    );
  }

  // Safety amber lightbar on cab roof
  const beaconParts: THREE.BufferGeometry[] = [
    new THREE.BoxGeometry(1.6, 0.35, 0.18).translate(0, 0.6, 2.1),
  ];

  return {
    body: merge(bodyParts),
    glass: merge(glassParts),
    wheels: merge(wheelParts),
    beacon: merge(beaconParts),
  };
}

/** Parts of the radiosonde: the pink balloon and the white instrument box hanging on the string. */
interface SondeGeos {
  balloon: THREE.BufferGeometry;
  payload: THREE.BufferGeometry;
}

/** the sonde model is drawn much larger than its real 3 m (next to 40–60 m aircraft it would be invisible) */
const SONDE_K = 3.2;

function sondeParts(): SondeGeos {
  const merge = (list: THREE.BufferGeometry[]) =>
    mergeGeometries(
      list.map((g) => {
        const n = g.index ? g.toNonIndexed() : g;
        n.deleteAttribute('uv');
        return n;
      }),
    )!;
  // teardrop profile of a roughly 1.7 m sounding balloon, filled (in metres, lathe around y)
  const profile: [number, number][] = [
    [0, 1.3],
    [0.1, 1.35],
    [0.15, 1.5],
    [0.4, 1.95],
    [0.66, 2.55],
    [0.8, 3.1],
    [0.77, 3.5],
    [0.6, 3.8],
    [0.34, 4],
    [0.1, 4.08],
    [0, 4.1],
  ];
  const balloon = merge([
    new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 14),
    // the cord down to the payload
    new THREE.CylinderGeometry(0.012, 0.02, 1.1, 5).translate(0, 0.75, 0),
  ]);
  const payload = merge([
    // the white sensor box and its antenna pointing down
    new THREE.BoxGeometry(0.4, 0.34, 0.16),
    new THREE.CylinderGeometry(0.008, 0.008, 0.3, 5).translate(0, -0.22, 0),
  ]);
  // the lathe axis (y = forward in model space) becomes up: balloon and payload hang above the anchor
  balloon.rotateX(Math.PI / 2).scale(SONDE_K, SONDE_K, SONDE_K);
  payload.rotateX(Math.PI / 2).scale(SONDE_K, SONDE_K, SONDE_K);
  return { balloon, payload };
}

let geoCache: {
  narrow: THREE.BufferGeometry;
  wide: THREE.BufferGeometry;
  heli: HeliGeos;
  car: VehicleGeos;
  tug: VehicleGeos;
  sonde: SondeGeos;
} | null = null;
const geos = () =>
  (geoCache ??= {
    narrow: airliner(1),
    wide: airliner(1.68),
    heli: heliParts(),
    car: followMeCarParts(),
    tug: pushbackTugParts(),
    sonde: sondeParts(),
  });

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
    main.position.set(0, 0.2, 4.85).multiplyScalar(HELI_K);
    main.add(new THREE.Mesh(g.heli.rotor, mat));
    const tail = new THREE.Group();
    tail.position.set(0.3, -8.9, 3.5).multiplyScalar(HELI_K);
    tail.add(new THREE.Mesh(g.heli.tail, mat));
    group.add(main, tail);
    group.userData = { main, tail };
    return group;
  }
  if (model === 'sonde') {
    // the whole balloon rig hangs at the payload and rocks gently in the wind
    const group = new THREE.Group();
    const sway = new THREE.Group();
    sway.add(new THREE.Mesh(g.sonde.balloon, new THREE.MeshLambertMaterial({ color: 0xff8fab, side: THREE.DoubleSide })));
    sway.add(new THREE.Mesh(g.sonde.payload, new THREE.MeshLambertMaterial({ color: 0xeceff4, side: THREE.DoubleSide })));
    group.add(sway);
    group.userData = { sway };
    return group;
  }
  if (model === 'car' || model === 'tug') {
    const v = model === 'car' ? g.car : g.tug;
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide });
    const glassMat = new THREE.MeshLambertMaterial({ color: 0x37474f, side: THREE.DoubleSide });
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1f232b, side: THREE.DoubleSide });
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff9900, transparent: true, opacity: 0.9 });
    group.add(new THREE.Mesh(v.body, bodyMat));
    group.add(new THREE.Mesh(v.glass, glassMat));
    group.add(new THREE.Mesh(v.wheels, wheelMat));
    const beaconMesh = new THREE.Mesh(v.beacon, beaconMat);
    group.add(beaconMesh);
    group.userData = { beacon: beaconMesh };
    return group;
  }
  return new THREE.Mesh(g[model], mat);
}

// ---------------------------------------------------------------------------

const TRAIL_COLOR = '#ff6a2b';
const FORECAST_COLOR = '#b8bfcc';
/** all trails faint and fading out, the one of the selected aircraft complete and at full strength */
const TRAIL_STYLE = { width: 2, opacity: 0.55, fade: TRAIL_FADE_MS, wall: 0.06 };
const TRAIL_STYLE_SELECTED = { width: 3, opacity: 1, fade: 0, wall: 0.15 };

interface Mats {
  shadow: THREE.MeshBasicMaterial;
  drop: THREE.LineBasicMaterial;
}

function makeMats(): Mats {
  return {
    shadow: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }),
    drop: new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }),
  };
}

/** the line from an aircraft to the ground: unit height, scaled to the altitude */
const dropGeometry = () => new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 1], 3));

/**
 * Trail of one aircraft: a fat line plus a wall down to the ground. The last point follows the
 * aircraft and is moved in place every frame; the rest is rebuilt only when a new position was reported.
 */
class TrailRig {
  line = new GeoLine([], { color: TRAIL_COLOR, width: TRAIL_STYLE.width, opacity: TRAIL_STYLE.opacity, fadeMs: TRAIL_STYLE.fade });
  wall = new GeoWall({ color: TRAIL_COLOR, fullM: WALL_FULL_M, goneM: WALL_MAX_M });
  private count = -1;
  private flatBuilt = false;
  /** longitude of the last point, the head stays next to it across the antimeridian */
  private lastLon = 0;

  private near(lon: number) {
    return lon + 360 * Math.round((this.lastLon - lon) / 360);
  }

  private build(trail: [number, number, number, number][], flat: boolean) {
    this.lastLon = trail[0][0];
    const pts = trail.map((t): Vec3 => {
      this.lastLon = this.near(t[0]);
      return [this.lastLon, t[1], flat ? 0.3 : t[2]];
    });
    pts.push(pts[pts.length - 1]); // the head, moved every frame
    const times = [...trail.map((t) => t[3]), -1];
    this.line.setPoints(pts, times);
    this.wall.setPoints(pts, times);
    this.count = trail.length;
    this.flatBuilt = flat;
  }

  /** Bring the geometry to the aircraft's trail and current (displayed) position. */
  sync(p: PlaneState, flat: boolean, selected: boolean, frame: GeoFrame, now: number, lift: number) {
    if (p.trail.length !== this.count || flat !== this.flatBuilt) this.build(p.trail, flat);
    const head: Vec3 = [this.near(p.dLon), p.dLat, flat || p.ground ? 0.3 : p.dAlt];
    this.line.setHead(head);
    this.wall.setHead(head);
    const style = selected ? TRAIL_STYLE_SELECTED : TRAIL_STYLE;
    this.line.setWidth(style.width);
    this.line.setOpacity(style.opacity);
    this.line.setFade(style.fade);
    this.wall.setStyle(style.wall, style.fade);
    this.line.update(frame, now, lift);
    this.wall.update(frame, now, lift);
    this.wall.object.visible = !flat && !p.ground && p.dAlt > 3;
  }

  hide() {
    this.line.object.visible = this.wall.object.visible = false;
  }

  dispose() {
    this.line.dispose();
    this.wall.dispose();
  }
}

// ---------------------------------------------------------------------------

interface ForecastLeg {
  /** [lon, lat, altitude m] */
  from: Vec3;
  to: Vec3;
  /** dashes are anchored at the airport end so they stay put while the aircraft moves */
  anchor: 'from' | 'to';
}

const FC_SEGS = 48; // straight pieces per leg
const FC_WIDTH = 2.5;
/** one dash period = 14 screen px, in line widths */
const FC_DASH: [number, number] = [(14 * 0.55) / FC_WIDTH, (14 * 0.45) / FC_WIDTH];

/** Great circle between two points, `n` pieces, with altitude ramped linearly; lon unwrapped around `refLon`. */
function greatCircle(a: Vec3, b: Vec3, n: number, refLon: number): Vec3[] {
  const [lo1, la1] = [rad(a[0]), rad(a[1])];
  const [lo2, la2] = [rad(b[0]), rad(b[1])];
  const h = Math.sin((la2 - la1) / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin((lo2 - lo1) / 2) ** 2;
  const delta = 2 * Math.asin(Math.min(1, Math.sqrt(h)));
  const pts: Vec3[] = [];
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
  return pts;
}

export interface PlanesLayerHooks {
  /** 'off': nothing drawn; 'flat': map not tilted (flat trails, models only without 2D icons); '3d': tilted, or on the globe */
  mode(): 'off' | 'flat' | '3d';
  /** far out only this aircraft (the selected one) is drawn, with its trail and route; null: all */
  only(): string | null;
  /** are the 2D aircraft icons shown (then the models are left out in flat mode)? */
  icons(): boolean;
  /** about 10× a second while the 2D icons are shown on a flat map: move them with the smoothed positions */
  tick(): void;
  /** called about 4× a second with the planes that are drawn */
  frame(planes: PlaneState[]): void;
  /** what the camera follows for this aircraft */
  target(hex: string, cockpit: boolean): GeoTarget | null | Promise<GeoTarget | null>;
  /** far out on the globe: all aircraft as simple models at once, only the selected one in full */
  crowd(): boolean;
}

export class PlanesLayer implements GeoPart {
  readonly object = new THREE.Group();
  readonly source = 'plane';
  private frameNow: GeoFrame | null = null;
  private lastFrameHook = 0;
  private lastTick = 0;
  private mats = makeMats();
  private flatNow = false;
  private drop = dropGeometry();
  private pulseGeo = new THREE.SphereGeometry(1, 20, 14);
  /** hex of the aircraft whose trail is drawn at full strength */
  selected: string | null = null;
  /** departure / destination airport [lon, lat] of the selected aircraft, if known */
  private route: { hex: string; origin: [number, number]; destination: [number, number] } | null = null;
  private forecast: GeoLine[] = [];
  /** the name of the hovered aircraft: a plain element moved every frame with the models (no lag when zooming) */
  private labelBox = document.createElement('div');
  private label = document.createElement('div');
  private hovered: string | null = null;
  private far: GeoInstances | null = null;
  private lastCrowd = 0;
  private crowdCamera = '';
  /** where the far aircraft are on the screen, for clicks and the cursor */
  private crowdHits: { hex: string; x: number; y: number }[] = [];
  private repaintTimer = 0;

  /** Route of an aircraft (null: none): a grey dashed line is drawn while it is the selected one. */
  setRoute(hex: string, route: { origin: [number, number]; destination: [number, number] } | null) {
    this.route = route ? { hex, ...route } : null;
    this.map.triggerRepaint();
  }

  constructor(
    private map: MlMap,
    readonly tracker: PlaneTracker,
    private hooks: PlanesLayerHooks,
  ) {
    this.labelBox.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:1';
    this.label.style.cssText =
      'display:none;position:absolute;left:0;top:0;white-space:pre;text-align:center;font:700 12px/1.2 system-ui,sans-serif;color:#fff;' +
      'text-shadow:0 0 3px rgba(10,12,16,.95),0 0 3px rgba(10,12,16,.95),0 0 2px rgba(10,12,16,.95);will-change:transform';
    this.labelBox.append(this.label);
    map.getCanvasContainer().appendChild(this.labelBox);
  }

  resolve(slug: string, params: Record<string, string>) {
    return this.hooks.target(slug, params.view === 'cockpit');
  }

  dispose() {
    this.tracker.clear();
    this.drop.dispose();
    this.pulseGeo.dispose();
    for (const m of Object.values(this.mats)) m.dispose();
    for (const line of this.forecast) line.dispose();
    this.labelBox.remove();
    clearTimeout(this.repaintTimer);
    this.far?.dispose();
  }

  update(frame: GeoFrame, now: number) {
    this.frameNow = frame;
    const mode = this.hooks.mode();
    this.object.visible = mode !== 'off';
    if (mode === 'off') {
      this.crowdHits = [];
      // far out without models the 2D icon can be hovered all the same
      if (this.hovered) this.tracker.step(now);
      this.syncLabel();
      if (this.tracker.planes.size && this.lastFrameHook) {
        this.lastFrameHook = 0;
        this.hooks.frame([]);
      }
      return false;
    }
    const flat = mode === 'flat';
    this.flatNow = flat;
    const models = !flat || !this.hooks.icons();
    const only = this.hooks.only();
    this.tracker.step(now);
    const crowd = this.hooks.crowd();
    if (crowd) this.updateCrowd(frame, now);
    else if (this.far) {
      this.far.object.visible = false;
      this.crowdHits = [];
    }
    const drawn: PlaneState[] = [];
    const map = this.map;
    const terrain = map.getTerrain();
    if (flat && !models && now - this.lastTick > 100) {
      this.lastTick = now;
      this.hooks.tick();
    }
    // only what is (nearly) in view is built and drawn; on the globe the horizon decides
    const b = map.getBounds();
    const padLon = (b.getEast() - b.getWest()) * 0.5;
    const padLat = (b.getNorth() - b.getSouth()) * 0.5;
    const hideAll = (p: PlaneState) => {
      for (const o of [p.obj, p.shadow, p.drop, p.pulse]) if (o) o.visible = false;
      p.rig?.hide();
    };
    for (const p of this.tracker.planes.values()) {
      if (crowd && p.hex !== this.selected) continue;
      if (only && p.hex !== only) {
        hideAll(p);
        continue;
      }
      const inView = frame.globe || (p.dLon > b.getWest() - padLon && p.dLon < b.getEast() + padLon && p.dLat > b.getSouth() - padLat && p.dLat < b.getNorth() + padLat);
      // ground vehicles are drawn by their 2D icon on the flat map (never both)
      if (!inView || (flat && (p.model === 'car' || p.model === 'tug'))) {
        hideAll(p);
        continue;
      }
      const elev = terrain ? (map.queryTerrainElevation([p.dLon, p.dLat]) ?? 0) : 0;
      const air = !flat && !p.ground && p.dAlt > 3;
      const alt = (flat ? (p.ground ? 0.2 : 1) : p.dAlt + (p.ground ? 0.2 : 0)) + elev;
      // behind the Earth: its trail may still reach around the horizon
      const hidden = frame.occluded(p.dLon, p.dLat, alt);
      // metres per screen pixel: models keep a readable size when zoomed out (about 26 px long)
      const mpp = frame.metresPerPixel(p.dLon, p.dLat, alt);
      if (models && !hidden) {
        if (!p.obj || p.objModel !== p.model || p.objEmergency !== p.emergency) {
          if (p.obj) {
            this.object.remove(p.obj);
            disposeMaterials(p.obj);
          }
          p.obj = makeModel(p.model, p.emergency);
          p.obj.matrixAutoUpdate = false;
          p.obj.traverse((o) => (o.frustumCulled = false));
          p.objModel = p.model;
          p.objEmergency = p.emergency;
          this.object.add(p.obj);
        }
        const heading = p.model === 'sonde' ? 0 : p.dTrack; // the balloon hangs upright, no nose direction
        const boost = Math.max(1, 0.65 * mpp);
        frame.place(p.obj.matrix, p.dLon, p.dLat, alt, heading, boost);
        p.obj.visible = true;
        if (p.model === 'heli') {
          // the blades turn (a little different per helicopter so a fleet does not run in step)
          const { main, tail } = p.obj.userData as { main: THREE.Object3D; tail: THREE.Object3D };
          const phase = (p.hex.charCodeAt(0) + p.hex.charCodeAt(p.hex.length - 1)) % 7;
          main.rotation.z = now * 0.011 + phase;
          tail.rotation.x = now * 0.025 + phase;
        } else if (p.model === 'sonde') {
          // the payload pendulums under the balloon (a little different per sonde)
          const { sway } = p.obj.userData as { sway?: THREE.Object3D };
          if (sway) {
            const phase = (p.hex.charCodeAt(6) + p.hex.charCodeAt(p.hex.length - 1)) % 7;
            sway.rotation.x = Math.sin(now * 0.0012 + phase * 1.9) * 0.05;
          }
        } else if (p.model === 'car' || p.model === 'tug') {
          const { beacon } = p.obj.userData as { beacon?: THREE.Mesh };
          if (beacon) {
            const phase = (p.hex.charCodeAt(0) + p.hex.charCodeAt(p.hex.length - 1)) % 5;
            const flash = Math.sin(now * 0.012 + phase) > 0.2 ? 1.0 : 0.25;
            (beacon.material as THREE.MeshBasicMaterial).opacity = flash;
          }
        }
        this.syncShadow(frame, p, air, elev, heading, boost);
        this.syncDrop(frame, p, air, elev);
        drawn.push(p);
      } else {
        for (const o of [p.obj, p.shadow, p.drop]) if (o) o.visible = false;
      }
      this.syncTrail(frame, p, elev, flat, now);
      if (hidden) {
        if (p.pulse) p.pulse.visible = false;
      } else this.syncPulse(frame, p, now, mpp, elev, flat);
    }
    this.syncLabel();
    this.syncForecast(frame, flat);
    if (now - this.lastFrameHook > 250) {
      this.lastFrameHook = now;
      this.hooks.frame(drawn);
    }
    if (crowd && !this.selected) {
      // far out an aircraft crosses a pixel in seconds: no need to draw the whole map every frame
      if (!this.repaintTimer) {
        this.repaintTimer = window.setTimeout(() => {
          this.repaintTimer = 0;
          map.triggerRepaint();
        }, CROWD_IDLE_MS);
      }
      return false;
    }
    return this.tracker.planes.size > 0;
  }

  /** All aircraft but the selected one as simple models. */
  private updateCrowd(frame: GeoFrame, now: number) {
    this.far ??= this.newCrowd();
    const far = this.far;
    far.object.visible = true;
    const map = this.map;
    const c = map.getCenter();
    const camera = `${c.lng}|${c.lat}|${map.getZoom()}|${map.getBearing()}|${map.getPitch()}`;
    const moving = camera !== this.crowdCamera;
    this.crowdCamera = camera;
    far.update(frame);
    if (now - this.lastCrowd < (moving ? CROWD_MOVING_MS : CROWD_IDLE_MS)) return;
    this.lastCrowd = now;
    far.start(frame, this.tracker.planes.size);
    const hits: { hex: string; x: number; y: number }[] = [];
    const m = new THREE.Matrix4();
    for (const p of this.tracker.planes.values()) {
      if (p.hex === this.selected) continue;
      for (const o of [p.obj, p.shadow, p.drop, p.pulse]) if (o) o.visible = false;
      p.rig?.hide();
      if (p.model === 'car' || p.model === 'tug' || p.model === 'sonde') continue;
      const alt = p.ground ? 0.2 : p.dAlt;
      const pos = frame.toScreen(p.dLon, p.dLat, alt);
      if (!pos || pos[0] < -CROWD_MARGIN_PX || pos[1] < -CROWD_MARGIN_PX || pos[0] > frame.width + CROWD_MARGIN_PX || pos[1] > frame.height + CROWD_MARGIN_PX) continue;
      hits.push({ hex: p.hex, x: pos[0], y: pos[1] });
      const boost = Math.max(1, 0.65 * CROWD_SCALE * frame.metresPerPixel(p.dLon, p.dLat, alt));
      frame.place(m, p.dLon, p.dLat, alt, p.dTrack, boost);
      far.add(p.model, m, p.emergency ? RED : YELLOW);
    }
    far.finish();
    far.update(frame);
    this.crowdHits = hits;
  }

  /** The aircraft are gone for good: their buffers go too. */
  dropCrowd() {
    this.crowdHits = [];
    this.hovered = null;
    if (!this.far) return;
    this.object.remove(this.far.object);
    this.far.dispose();
    this.far = null;
  }

  private newCrowd() {
    const far = new GeoInstances({ narrow: farAirliner(1), wide: farAirliner(1.68), heli: farAirliner(0.45) });
    this.object.add(far.object);
    return far;
  }

  /** The aircraft under the mouse (null: none): only it shows its name. */
  setHovered(hex: string | null) {
    if (hex === this.hovered) return;
    this.hovered = hex;
    this.map.triggerRepaint();
  }

  /** Callsign above the hovered aircraft; moved here every frame so it never trails behind while zooming. */
  private syncLabel() {
    const frame = this.frameNow;
    const p = this.hovered ? this.tracker.planes.get(this.hovered) : undefined;
    const pos = p && frame?.toScreen(p.dLon, p.dLat, this.flatNow ? 1 : p.dAlt);
    if (!p || !pos) {
      this.label.style.display = 'none';
      return;
    }
    const zoom = this.map.getZoom();
    // distance above the model: grows with the zoom (the models get bigger)
    const lift = 17 + Math.min(1, Math.max(0, (zoom - 15) / 3.5)) * 24;
    const callsign = String(p.props.callsign ?? '');
    const icao = zoom >= 16 ? String(p.props.icao ?? '') : '';
    // vehicles: always show callsign as label (their ID is all they have)
    const isVehicle = p.model === 'car' || p.model === 'tug';
    const text = isVehicle ? callsign : (icao ? `${callsign}\n${icao}` : callsign);
    if (this.label.textContent !== text) this.label.textContent = text;
    this.label.style.display = '';
    this.label.style.transform = `translate(${pos[0].toFixed(1)}px,${(pos[1] - lift).toFixed(1)}px) translate(-50%,-100%)`;
  }

  /**
   * The aircraft at a screen point (CSS px): its model, its trail line or the wall below the line.
   * The models cannot be picked by MapLibre, so the shapes are projected with the last drawn frame.
   */
  pick(x: number, y: number): string | null {
    const frame = this.frameNow;
    if (!frame || !this.object.visible) return null;
    const screen = (lon: number, lat: number, alt: number) => frame.toScreen(lon, lat, alt);
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
    for (const h of this.crowdHits) {
      const d = Math.hypot(x - h.x, y - h.y);
      if (d <= CROWD_PICK_PX) consider(h.hex, d);
    }
    for (const p of this.tracker.planes.values()) {
      if (!p.rig?.line.object.visible) continue;
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
  private syncShadow(frame: GeoFrame, p: PlaneState, air: boolean, elev: number, heading: number, scale: number) {
    if (!p.shadow || p.shadowModel !== p.model) {
      p.shadow?.parent?.remove(p.shadow);
      const g = geos();
      const shadowGeo = p.model === 'heli' ? g.heli.body : p.model === 'car' ? g.car.body : p.model === 'tug' ? g.tug.body : p.model === 'sonde' ? g.sonde.balloon : g[p.model];
      p.shadow = new THREE.Mesh(shadowGeo, this.mats.shadow);
      p.shadow.matrixAutoUpdate = false;
      p.shadow.renderOrder = 1;
      p.shadow.frustumCulled = false;
      p.shadowModel = p.model;
      this.object.add(p.shadow);
    }
    p.shadow.visible = air;
    if (!air) return;
    frame.place(p.shadow.matrix, p.dLon, p.dLat, elev + 0.1, heading, scale).multiply(FLATTEN);
  }

  /** A white, see-through sphere that grows and fades around an aircraft whose position just arrived. */
  private syncPulse(frame: GeoFrame, p: PlaneState, now: number, mpp: number, elev: number, flat: boolean) {
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
      this.object.add(p.pulse);
    }
    (p.pulse.material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - t) ** 1.5;
    // Radius in screen pixels, tied to the drawn size of the aircraft (about 60 m long, at least ~39 px
    // when zoomed out): not too big next to a big model when close, still visible when far away.
    // With many aircraft it is smaller (they all flash at once), but never below 12 px.
    const planePx = Math.max(60 / mpp, 39);
    const crowdK = Math.min(1, Math.max(0.6, Math.sqrt(40 / Math.max(1, this.tracker.planes.size))));
    const maxPx = Math.max(12, Math.min(56, 0.5 * planePx) * crowdK);
    const px = maxPx * (0.25 + 0.75 * (1 - (1 - t) ** 2));
    frame.place(p.pulse.matrix, p.dLon, p.dLat, (flat || p.ground ? 1 : p.dAlt) + elev, 0, px * mpp);
    p.pulse.visible = true;
  }

  /** Thin, faint line from the aircraft straight down to the ground. */
  private syncDrop(frame: GeoFrame, p: PlaneState, air: boolean, elev: number) {
    if (!p.drop) {
      p.drop = new THREE.Line(this.drop, this.mats.drop);
      p.drop.matrixAutoUpdate = false;
      p.drop.frustumCulled = false;
      p.drop.renderOrder = 2;
      this.object.add(p.drop);
    }
    p.drop.visible = air;
    if (!air) return;
    frame.place(p.drop.matrix, p.dLon, p.dLat, elev).multiply(STRETCH.makeScale(1, 1, p.dAlt));
  }

  /** Grey dashed line from the departure airport to the start of the trail and on to the destination. */
  private syncForecast(frame: GeoFrame, flat: boolean) {
    const p = this.selected ? this.tracker.planes.get(this.selected) : undefined;
    const r = this.route;
    const legs: ForecastLeg[] = [];
    if (p && r && r.hex === p.hex) {
      const alt = (a: number) => (flat || p.ground ? 0.3 : a);
      const first = p.trail[0];
      // the departure airport is only drawn to the trail when the data begins far away from it
      if (metres(r.origin[0], r.origin[1], first[0], first[1]) > 15000) legs.push({ from: [r.origin[0], r.origin[1], 0.3], to: [first[0], first[1], alt(first[2])], anchor: 'from' });
      if (metres(p.dLon, p.dLat, r.destination[0], r.destination[1]) > 3000) legs.push({ from: [p.dLon, p.dLat, alt(p.dAlt)], to: [r.destination[0], r.destination[1], 0.3], anchor: 'to' });
    }
    for (let i = 0; i < Math.max(legs.length, this.forecast.length); i++) {
      this.forecast[i] ??= this.newForecastLine();
      const line = this.forecast[i];
      const leg = legs[i];
      if (!leg || !p) {
        line.object.visible = false;
        continue;
      }
      const pts = greatCircle(leg.from, leg.to, FC_SEGS, p.dLon);
      // always from the airport on: that is where the dashes begin; exact at the aircraft
      if (leg.anchor === 'to') pts.reverse();
      line.setPoints(pts, undefined, [p.dLon, p.dLat, pts[0][2]]);
      line.update(frame);
    }
  }

  private newForecastLine() {
    const line = new GeoLine([], { color: FORECAST_COLOR, width: FC_WIDTH, opacity: 0.85, dash: FC_DASH });
    this.object.add(line.object);
    return line;
  }

  private syncTrail(frame: GeoFrame, p: PlaneState, elev: number, flat: boolean, now: number) {
    if (!p.rig) {
      p.rig = new TrailRig();
      this.object.add(p.rig.line.object, p.rig.wall.object);
    }
    p.rig.sync(p, flat, this.selected === p.hex, frame, now, elev);
  }
}

/** the shadow is the model, squashed flat */
const FLATTEN = new THREE.Matrix4().makeScale(1, 1, 0.002);
const STRETCH = new THREE.Matrix4();
