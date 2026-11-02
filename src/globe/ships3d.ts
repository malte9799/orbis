import * as THREE from 'three';
import type { Map as MlMap } from 'maplibre-gl';
import { shipCat, type Ship, type ShipCat } from '../api/transport';
import type { GeoFrame } from './geo3d/frame';
import type { GeoPart, GeoTarget } from './geo3d/stage';

// 3D ships: low-poly models, a part of the 3D stage. Used from SHIP_ZOOM on (the 2D icon layer steps
// aside then), and at any zoom for the ship the camera follows. Positions are reported every
// few seconds to minutes, so each ship is dead-reckoned from its speed and course and eased
// towards every new report.

/** from this zoom on the 3D models replace the 2D icons */
const SHIP_ZOOM = 9;
/** a report older than this is no longer extrapolated (s) */
const MAX_EXTRAPOLATE_S = 240;
/** ships not reported for this long are dropped (ms) */
const EXPIRE_MS = 20 * 60000;
/** the smallest length of a model on screen (px) so ships stay visible when zoomed out */
const MIN_PX = 20;
/** how long a link to a ship waits for reports that contain it (ms) */
const REPORT_WAIT_MS = 20000;
/** the white ping circle around a ship whose position just arrived */
const PULSE_MS = 1300;
/** names are shown from this zoom on */
const LABEL_ZOOM = 10;
const KNOT = 0.5144;
const M_PER_DEG = 111320;

const rad = (d: number) => (d * Math.PI) / 180;
const shortestDelta = (from: number, to: number) => ((((to - from) % 360) + 540) % 360) - 180;

interface ShipState {
  ship: Ship;
  dLon: number;
  dLat: number;
  dRot: number;
  seen: number;
  obj?: THREE.Object3D;
  cat?: ShipCat;
  /** when the last position report arrived (performance.now) */
  pulseAt?: number;
  pulse?: THREE.Mesh;
  /** [speed over ground kn, course °] of the reports seen so far */
  hist: [number, number][];
  /** screen position (CSS px) and radius of the model in the last drawn frame, for picking */
  sx: number;
  sy: number;
  rpx: number;
}

// ---------------------------------------------------------------------------
// Models: metres, bow towards +y, deck up (+z), waterline at z = 0.

const matCache = new Map<number, THREE.MeshLambertMaterial>();
const mat = (color: number) => {
  let m = matCache.get(color);
  if (!m) matCache.set(color, (m = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide })));
  return m;
};

/** Pointed hull: straight sides, blunt stern, bow with two facets, `h` high. */
function hull(len: number, beam: number, h: number, color: number, lift = 0): THREE.Mesh {
  const hl = len / 2;
  const hb = beam / 2;
  const s = new THREE.Shape();
  s.moveTo(-hb * 0.9, -hl);
  s.lineTo(hb * 0.9, -hl);
  s.lineTo(hb, -hl * 0.6);
  s.lineTo(hb, hl * 0.35);
  s.lineTo(hb * 0.55, hl * 0.78);
  s.lineTo(0, hl);
  s.lineTo(-hb * 0.55, hl * 0.78);
  s.lineTo(-hb, hl * 0.35);
  s.lineTo(-hb, -hl * 0.6);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false });
  const m = new THREE.Mesh(geo, mat(color));
  m.position.z = lift;
  return m;
}

function box(x: number, y: number, z: number, w: number, l: number, h: number, color: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, l, h), mat(color));
  m.position.set(x, y, z + h / 2);
  return m;
}

function cyl(x: number, y: number, z: number, r: number, h: number, color: number, segs = 8): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, segs), mat(color));
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z + h / 2);
  return m;
}

const WHITE = 0xeceff1;
const GREY = 0x90a4ae;
const DARK = 0x37474f;
const BOXES = [0xe53935, 0x1e88e5, 0xfb8c00, 0x43a047, 0x8e24aa, 0xf4f4f4];

interface Spec {
  len: number;
  build(c: THREE.Group): void;
}

const SPECS: Record<ShipCat, Spec> = {
  cargo: {
    len: 180,
    build(c) {
      c.add(hull(180, 28, 12, 0x455a64));
      c.add(box(0, -66, 12, 24, 20, 20, WHITE));
      // container stacks on deck
      let i = 0;
      for (let y = -40; y < 70; y += 18) {
        for (const x of [-7.5, 0, 7.5]) {
          c.add(box(x, y, 12, 6.5, 16, 6 + ((i * 7) % 3) * 2.4, BOXES[i++ % BOXES.length]));
        }
      }
    },
  },
  tanker: {
    len: 220,
    build(c) {
      c.add(hull(220, 34, 14, 0x6d4c41));
      c.add(box(0, -84, 14, 28, 22, 24, WHITE));
      c.add(cyl(0, -84, 38, 3, 6, DARK));
      // deck with the long pipe and tank hatches
      c.add(box(0, 10, 14, 30, 150, 1.4, 0xa1887f));
      c.add(box(0, 10, 15.4, 2.5, 150, 2.5, GREY));
      for (let y = -50; y <= 70; y += 24) c.add(cyl(0, y, 15.4, 5, 2, DARK, 10));
    },
  },
  passenger: {
    len: 150,
    build(c) {
      c.add(hull(150, 26, 9, WHITE));
      c.add(box(0, -5, 9, 22, 100, 7, 0xf5f5f5));
      c.add(box(0, 0, 16, 19, 80, 7, 0xeceff1));
      c.add(box(0, 12, 23, 15, 40, 6, 0xe0e0e0));
      c.add(box(0, 28, 29, 10, 12, 5, SHIP_COLORS_DARK));
      c.add(cyl(0, -18, 29, 3.4, 9, 0xe53935));
    },
  },
  fishing: {
    len: 30,
    build(c) {
      c.add(hull(30, 8, 3.5, 0x1565c0));
      c.add(box(0, 4, 3.5, 5, 7, 4, WHITE));
      c.add(cyl(0, 4, 7.5, 0.25, 7, GREY, 6));
      c.add(box(0, -8, 3.5, 6, 6, 0.8, 0xffb74d));
    },
  },
  tug: {
    len: 28,
    build(c) {
      c.add(hull(28, 10, 3, 0xd84315));
      c.add(box(0, 2, 3, 7, 9, 4, WHITE));
      c.add(cyl(0, -3, 7, 1.2, 4, DARK, 8));
    },
  },
  pleasure: {
    len: 12,
    build(c) {
      c.add(hull(12, 3.6, 1.1, WHITE));
      c.add(box(0, -1, 1.1, 2, 3.4, 1, 0xb0bec5));
      c.add(cyl(0, 1.5, 1.1, 0.07, 9, GREY, 5));
      // sail
      const sail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 5, 7), mat(0xfafafa));
      sail.position.set(0, -1.4, 5.1);
      c.add(sail);
    },
  },
  hsc: {
    len: 40,
    build(c) {
      c.add(hull(40, 10, 3, 0x0277bd));
      c.add(box(0, -2, 3, 7, 22, 3.5, WHITE));
      c.add(box(0, 6, 6.5, 5, 6, 2.2, DARK));
    },
  },
  special: {
    len: 60,
    build(c) {
      c.add(hull(60, 12, 5, 0x546e7a));
      c.add(box(0, -12, 5, 9, 14, 7, WHITE));
      c.add(box(0, 12, 5, 8, 14, 2, GREY));
      c.add(cyl(0, -12, 12, 0.3, 8, GREY, 6));
    },
  },
  other: {
    len: 60,
    build(c) {
      c.add(hull(60, 10, 5, 0x78909c));
      c.add(box(0, -14, 5, 8, 12, 6, WHITE));
      c.add(box(0, 8, 5, 7, 20, 1.4, GREY));
    },
  },
};
const SHIP_COLORS_DARK = 0x455a64;

const templates = new Map<ShipCat, THREE.Group>();
function makeModel(cat: ShipCat): THREE.Object3D {
  let t = templates.get(cat);
  if (!t) {
    t = new THREE.Group();
    SPECS[cat].build(t);
    templates.set(cat, t);
  }
  const o = t.clone(); // geometries and materials are shared
  o.matrixAutoUpdate = false;
  o.traverse((c) => (c.frustumCulled = false));
  return o;
}

export interface ShipsLayerHooks {
  /** is the ships layer switched on? */
  enabled(): boolean;
  /** the 3D models take over from (true) or give back to (false) the 2D icons */
  modeChanged(on: boolean): void;
}

export class ShipsLayer implements GeoPart {
  readonly object = new THREE.Group();
  readonly source = 'ship';
  private ships = new Map<number, ShipState>();
  private lastStep = 0;
  private lastOn = false;
  private pulseGeo = new THREE.SphereGeometry(1, 20, 14);
  /** names: plain elements moved every frame with the same matrix as the models */
  private labelBox = document.createElement('div');
  private labels = new Map<number, HTMLDivElement>();
  /** the ship the camera follows: a model at any zoom */
  private followed: number | null = null;
  /** a link named a ship that was not reported yet */
  private waiting: (() => void)[] = [];

  constructor(
    private map: MlMap,
    private hooks: ShipsLayerHooks,
  ) {
    this.labelBox.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:1';
    map.getCanvasContainer().appendChild(this.labelBox);
  }

  /** Latest reports of all ships (the whole set; missing ones are dropped after a while). */
  setShips(list: Iterable<Ship>) {
    const now = performance.now();
    for (const ship of list) {
      const prev = this.ships.get(ship.mmsi);
      const rot = ship.heading >= 0 && ship.heading < 360 ? ship.heading : ship.cog;
      if (prev) {
        if (prev.ship.at !== ship.at) {
          prev.pulseAt = now;
          prev.hist.push([ship.sog, ship.cog]);
          if (prev.hist.length > 60) prev.hist.shift();
        }
        prev.ship = ship;
        prev.seen = now;
      } else {
        this.ships.set(ship.mmsi, { ship, dLon: ship.lon, dLat: ship.lat, dRot: rot, seen: now, pulseAt: now, hist: [[ship.sog, ship.cog]], sx: -1e4, sy: -1e4, rpx: 0 });
      }
    }
    for (const [k, s] of this.ships) {
      if (now - s.seen > EXPIRE_MS) {
        this.drop(s);
        this.ships.delete(k);
      }
    }
    for (const fn of this.waiting.splice(0)) fn();
    this.map.triggerRepaint();
  }

  /** What the camera follows for this ship; waits for the next reports if it is not known yet. */
  resolve(slug: string): GeoTarget | null | Promise<GeoTarget | null> {
    const mmsi = Number(slug);
    if (!Number.isFinite(mmsi)) return null;
    if (this.ships.has(mmsi)) return this.target(mmsi);
    return new Promise((done) => {
      const timer = window.setTimeout(() => done(null), REPORT_WAIT_MS);
      this.waiting.push(() => {
        clearTimeout(timer);
        done(this.ships.has(mmsi) ? this.target(mmsi) : null);
      });
    });
  }

  private target(mmsi: number): GeoTarget {
    return {
      source: this.source,
      slug: String(mmsi),
      label: this.ships.get(mmsi)?.ship.name || String(mmsi),
      position: (now) => {
        // the stage draws it at this very time: the camera must not lag one step behind
        this.step(now);
        const s = this.ships.get(mmsi);
        return s ? [s.dLon, s.dLat, 0] : null;
      },
      entered: () => (this.followed = mmsi),
      released: () => (this.followed = null),
    };
  }

  private drop(s: ShipState) {
    if (s.obj) this.object.remove(s.obj);
    this.removePulse(s);
    this.labels.get(s.ship.mmsi)?.remove();
    this.labels.delete(s.ship.mmsi);
  }

  private removePulse(s: ShipState) {
    if (!s.pulse) return;
    s.pulse.parent?.remove(s.pulse);
    (s.pulse.material as THREE.Material).dispose();
    s.pulse = undefined;
  }

  dispose() {
    this.pulseGeo.dispose();
    this.labelBox.remove();
    this.labels.clear();
    this.ships.clear();
  }

  /** Speeds (kn) and courses (°) of the reports seen so far. */
  history(mmsi: number): { speed: number[]; track: number[] } {
    const h = this.ships.get(mmsi)?.hist ?? [];
    return { speed: h.map((e) => e[0]), track: h.map((e) => e[1]) };
  }

  /** Displayed (smoothed) position of a ship, if tracked. */
  position(mmsi: number): [number, number] | null {
    const s = this.ships.get(mmsi);
    return s ? [s.dLon, s.dLat] : null;
  }

  /** Is the 3D mode on (models drawn, 2D icons and their names given way)? */
  isActive() {
    return this.lastOn;
  }

  /** The ship whose model is under a screen point (CSS px): MapLibre cannot pick the models. */
  pick(x: number, y: number): Ship | null {
    let best: Ship | null = null;
    let bestD = Infinity;
    for (const s of this.ships.values()) {
      if (!s.obj?.visible) continue;
      const d = Math.hypot(x - s.sx, y - s.sy) - Math.max(s.rpx, 8);
      if (d < bestD) {
        bestD = d;
        best = s.ship;
      }
    }
    return bestD <= 4 ? best : null;
  }

  private syncLabel(s: ShipState, on: boolean) {
    const box = this.labelBox;
    const name = s.ship.name ?? '';
    let el = this.labels.get(s.ship.mmsi);
    if (!on || !name) {
      if (el) el.style.display = 'none';
      return;
    }
    if (!el) {
      el = document.createElement('div');
      el.style.cssText =
        'position:absolute;left:0;top:0;white-space:nowrap;text-align:center;font:500 11px/1.2 system-ui,sans-serif;color:#e0f7fa;' +
        'text-shadow:0 0 3px rgba(10,12,16,.95),0 0 3px rgba(10,12,16,.95),0 0 2px rgba(10,12,16,.95);will-change:transform';
      box.append(el);
      this.labels.set(s.ship.mmsi, el);
    }
    if (el.textContent !== name) el.textContent = name;
    el.style.display = '';
    el.style.transform = `translate(${s.sx.toFixed(1)}px,${(s.sy + Math.max(s.rpx, 8) * 0.6 + 6).toFixed(1)}px) translate(-50%,0)`;
  }

  /** A white, see-through sphere that grows and fades around a ship whose position just arrived. */
  private syncPulse(frame: GeoFrame, s: ShipState, now: number, modelPx: number, mpp: number, crowdK: number) {
    const t = s.pulseAt ? (now - s.pulseAt) / PULSE_MS : 1;
    if (t >= 1) {
      this.removePulse(s);
      return;
    }
    if (!s.pulse) {
      s.pulse = new THREE.Mesh(this.pulseGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, depthTest: false }));
      s.pulse.matrixAutoUpdate = false;
      s.pulse.frustumCulled = false;
      s.pulse.renderOrder = 3;
      this.object.add(s.pulse);
    }
    (s.pulse.material as THREE.MeshBasicMaterial).opacity = 0.45 * (1 - t) ** 1.5;
    const maxPx = Math.max(12, Math.min(56, modelPx) * crowdK);
    const px = maxPx * (0.25 + 0.75 * (1 - (1 - t) ** 2));
    frame.place(s.pulse.matrix, s.dLon, s.dLat, 1, 0, px * mpp);
    s.pulse.visible = true;
  }

  private active() {
    return this.hooks.enabled() && this.map.getZoom() >= SHIP_ZOOM;
  }

  /** The displayed state at this time: dead reckoning from the last report, eased towards it. */
  private step(now: number) {
    if (now === this.lastStep) return;
    const dt = this.lastStep ? Math.min(0.25, (now - this.lastStep) / 1000) : 0;
    this.lastStep = now;
    const k = 1 - Math.exp(-dt / 1.0);
    const wall = Date.now();
    for (const s of this.ships.values()) {
      const sh = s.ship;
      const elapsed = Math.min(MAX_EXTRAPOLATE_S, Math.max(0, (wall - sh.at) / 1000));
      const dist = sh.sog > 0.5 ? sh.sog * KNOT * elapsed : 0;
      const cosLat = Math.max(0.2, Math.cos(rad(sh.lat)));
      const tLat = sh.lat + (dist * Math.cos(rad(sh.cog))) / M_PER_DEG;
      const tLon = sh.lon + (dist * Math.sin(rad(sh.cog))) / (M_PER_DEG * cosLat);
      const tRot = sh.heading >= 0 && sh.heading < 360 ? sh.heading : sh.cog;
      if (dt === 0 || Math.abs(tLon - s.dLon) > 0.05) {
        s.dLon = tLon;
        s.dLat = tLat;
        s.dRot = tRot;
      } else {
        s.dLon += (tLon - s.dLon) * k;
        s.dLat += (tLat - s.dLat) * k;
        s.dRot += shortestDelta(s.dRot, tRot) * k;
      }
    }
  }

  update(frame: GeoFrame, now: number) {
    const on = this.active();
    if (on !== this.lastOn) {
      this.lastOn = on;
      queueMicrotask(() => this.hooks.modeChanged(on));
    }
    const only = on ? null : this.followed;
    this.object.visible = on || only !== null;
    const hide = (s: ShipState) => {
      if (s.obj) s.obj.visible = false;
      if (s.pulse) s.pulse.visible = false;
      this.syncLabel(s, false);
    };
    if (!on && only === null) {
      for (const s of this.ships.values()) hide(s);
      return false;
    }
    this.step(now);
    const map = this.map;
    const b = map.getBounds();
    const padLon = (b.getEast() - b.getWest()) * 0.3;
    const padLat = (b.getNorth() - b.getSouth()) * 0.3;
    const labels = map.getZoom() >= LABEL_ZOOM;
    const crowdK = Math.min(1, Math.max(0.6, Math.sqrt(40 / Math.max(1, this.ships.size))));
    for (const s of this.ships.values()) {
      const sh = s.ship;
      // on the globe the horizon decides what is in view
      const inView = frame.globe || (s.dLon > b.getWest() - padLon && s.dLon < b.getEast() + padLon && s.dLat > b.getSouth() - padLat && s.dLat < b.getNorth() + padLat);
      if ((only !== null && sh.mmsi !== only) || !inView || frame.occluded(s.dLon, s.dLat)) {
        hide(s);
        continue;
      }
      const cat = shipCat(sh.type);
      if (!s.obj || s.cat !== cat) {
        if (s.obj) this.object.remove(s.obj);
        s.obj = makeModel(cat);
        s.cat = cat;
        this.object.add(s.obj);
      }
      const mpp = frame.metresPerPixel(s.dLon, s.dLat);
      const boost = Math.max(1, (MIN_PX * mpp) / SPECS[cat].len);
      frame.place(s.obj.matrix, s.dLon, s.dLat, 0, s.dRot, boost);
      s.obj.visible = true;
      // screen position for the name and for picking (the models cannot be picked by MapLibre)
      const pos = frame.toScreen(s.dLon, s.dLat);
      const modelPx = Math.max(SPECS[cat].len / mpp, MIN_PX);
      s.rpx = modelPx / 2;
      if (pos) {
        s.sx = pos[0];
        s.sy = pos[1];
        this.syncLabel(s, (labels && frame.isNear(s.dLon, s.dLat)) || sh.mmsi === this.followed);
      } else {
        s.sx = s.sy = -1e4;
        this.syncLabel(s, false);
      }
      this.syncPulse(frame, s, now, s.rpx, mpp, crowdK);
    }
    return this.ships.size > 0;
  }
}
