import * as THREE from 'three';
import type { Map as MlMap } from 'maplibre-gl';
import { orbitPath, satPosition, type Sat } from '../api/tracking';
import { toUnit, sphereHides, type GeoFrame, type Vec3 } from './geo3d/frame';
import { GeoLine } from './geo3d/line';
import { GeoPoints } from './geo3d/points';
import type { GeoFeature, GeoPart, GeoTarget } from './geo3d/stage';

// Satellites at their real height, a part of the 3D stage: dots on the globe (the flat map keeps its 2D
// icons), space stations and the selected satellite as a model, the selected one with its orbit.
// New positions are worked out little by little over a few frames, so thousands of satellites cause no hitch.

export const SAT_FEATURE_LAYER = 'sats-3d';
/** how close (CSS px) a click still hits a dot */
const PICK_PX = 7;
/** a new set of positions per this time (ms): the dots move on their own in between */
const STEP_MS = 4000;
/** the dots have to move half a pixel for a new frame to be worth drawing; never slower than this (ms) */
const REPAINT_MAX_MS = 500;
/** roughly the speed of a low satellite (m/s) */
const LEO_SPEED = 7500;
/** a new orbit line after this time: the Earth turns below it (ms) */
const ORBIT_REDRAW_MS = 20000;
/** how long a link to a satellite waits for the data (ms) */
const REPORT_WAIT_MS = 20000;
const MODEL_PX = 30;
/** names are shown from this zoom on */
const LABEL_ZOOM = 2;
const LABEL_GAP_PX = 40;
const NAMED_GROUPS = new Set(['stations', 'weather']);

const COLORS: Record<string, string> = { stations: '#ffd23f', weather: '#4fc3f7', 'gps-ops': '#7bd389', galileo: '#7bd389', starlink: '#c7d0e8' };
export const satColor = (group: string) => COLORS[group] ?? '#d1b3ff';
const dotSize = (group: string) => (group === 'starlink' ? 3.2 : group === 'stations' ? 7 : 5);

/** The space station's shape in metres (x east, y forward, z up): truss, modules and four solar wings. */
function stationModel(color: string): THREE.Group {
  const body = new THREE.MeshLambertMaterial({ color: 0xe6e6e6 });
  const wing = new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(100, 3, 3), body));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 50, 12), body));
  for (const x of [-45, -32, 32, 45]) {
    for (const y of [-20, 20]) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(11, 34, 0.3), wing);
      panel.position.set(x, y, 0);
      g.add(panel);
    }
  }
  return g;
}

/** A plain satellite in metres: a box with two solar wings. */
function satelliteModel(color: string): THREE.Group {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(3, 4, 3), new THREE.MeshLambertMaterial({ color: 0xcfd8dc })));
  const wings = new THREE.Mesh(new THREE.BoxGeometry(14, 2.4, 0.2), new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
  g.add(wings);
  return g;
}

export interface SatellitesHooks {
  /** the globe flattened or came back: the 2D icons take over or give way */
  modeChanged(): void;
}

export class SatellitesLayer implements GeoPart {
  readonly object = new THREE.Group();
  readonly source = 'sat';
  private sats: Sat[] = [];
  private byId = new Map<string, Sat>();
  private indexById = new Map<string, number>();
  private points = new GeoPoints();
  /** positions at the times `at` and `at + STEP_MS`, the next set is being filled in */
  private from = new Float32Array(0);
  private to = new Float32Array(0);
  private next = new Float32Array(0);
  private at = 0;
  private filled = 0;
  private lastFill = 0;
  private built = false;
  private selected: string | null = null;
  private followed: string | null = null;
  private orbit: GeoLine | null = null;
  private orbitOf: string | null = null;
  private orbitAt = 0;
  private models = new Map<string, THREE.Group>();
  private labelBox = document.createElement('div');
  private labels = new Map<string, HTMLDivElement>();
  private wasGlobe: boolean | null = null;
  private repaintTimer = 0;
  private waiting: (() => void)[] = [];

  constructor(
    private map: MlMap,
    private hooks: SatellitesHooks,
  ) {
    this.object.add(this.points.object);
    this.labelBox.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:1';
    map.getCanvasContainer().appendChild(this.labelBox);
  }

  /** The satellites to draw; nothing happens when they are the same as before. */
  setSats(list: Sat[]) {
    if (list.length !== this.sats.length || list.some((s, i) => s !== this.sats[i])) {
      this.sats = list;
      this.byId = new Map(list.map((s) => [s.id, s]));
      this.indexById = new Map(list.map((s, i) => [s.id, i]));
      const n = list.length;
      const colors = new Float32Array(n * 3);
      const sizes = new Float32Array(n);
      const c = new THREE.Color();
      list.forEach((s, i) => {
        c.set(satColor(s.group));
        colors.set([c.r, c.g, c.b], i * 3);
        sizes[i] = dotSize(s.group);
      });
      this.points.setDots(colors, sizes);
      this.from = new Float32Array(n * 3);
      this.to = new Float32Array(n * 3);
      this.next = new Float32Array(n * 3);
      this.built = false;
      this.map.triggerRepaint();
    }
    for (const fn of this.waiting.splice(0)) fn();
  }

  /** On the globe the dots are drawn here, so the 2D layers stay empty. */
  drawsDots(frame: GeoFrame | null) {
    return !!frame?.globe;
  }

  /** The satellite whose orbit is shown (null: none). */
  select(id: string | null) {
    this.selected = id;
    this.map.triggerRepaint();
  }

  /** What the camera follows for this satellite; waits for the data if it is not there yet. */
  resolve(slug: string): GeoTarget | null | Promise<GeoTarget | null> {
    const known = this.byId.get(slug);
    if (known) return this.target(known);
    return new Promise((done) => {
      const timer = window.setTimeout(() => done(null), REPORT_WAIT_MS);
      this.waiting.push(() => {
        clearTimeout(timer);
        const s = this.byId.get(slug);
        done(s ? this.target(s) : null);
      });
    });
  }

  private target(s: Sat): GeoTarget {
    return {
      source: this.source,
      slug: s.id,
      label: s.name,
      position: (now) => (this.byId.get(s.id) === s ? this.exact(s, now) : null),
      entered: () => (this.followed = s.id),
      released: () => (this.followed = null),
    };
  }

  private exact(s: Sat, now: number): Vec3 | null {
    const p = satPosition(s, new Date(performance.timeOrigin + now));
    return p && Number.isFinite(p.lat) ? [p.lon, p.lat, p.heightKm * 1000] : null;
  }

  /** Positions of the satellites from `start` on into `out`; one that has decayed goes to the centre of the Earth, out of sight. */
  private fill(out: Float32Array, wall: number, start: number, end: number) {
    const date = new Date(wall);
    for (let i = start; i < end; i++) {
      const p = satPosition(this.sats[i], date);
      const u = p && Number.isFinite(p.lat) ? toUnit(p.lon, p.lat, p.heightKm * 1000) : [0, 0, 0];
      out[i * 3] = u[0];
      out[i * 3 + 1] = u[1];
      out[i * 3 + 2] = u[2];
    }
  }

  private advance(wall: number) {
    const n = this.sats.length;
    if (!this.built || wall > this.at + 2 * STEP_MS) {
      // the start, or back from a pause: all at once
      this.at = wall;
      this.fill(this.from, wall, 0, n);
      this.fill(this.to, wall + STEP_MS, 0, n);
      this.filled = 0;
      this.lastFill = wall;
      this.built = true;
      this.points.setPositions(this.from, this.to);
      return;
    }
    // a little of the next set per frame, it has to be there when the current step ends
    const nextAt = this.at + 2 * STEP_MS;
    const count = Math.ceil((n * Math.max(1, wall - this.lastFill)) / (STEP_MS * 0.8));
    this.lastFill = wall;
    const end = Math.min(n, this.filled + count);
    this.fill(this.next, nextAt, this.filled, end);
    this.filled = end;
    if (wall >= this.at + STEP_MS) {
      this.fill(this.next, nextAt, this.filled, n);
      [this.from, this.to, this.next] = [this.to, this.next, this.from];
      this.at += STEP_MS;
      this.filled = 0;
      this.points.setPositions(this.from, this.to);
    }
  }

  update(frame: GeoFrame, now: number) {
    if (frame.globe !== this.wasGlobe) {
      this.wasGlobe = frame.globe;
      queueMicrotask(() => this.hooks.modeChanged());
    }
    this.object.visible = this.sats.length > 0;
    if (!this.sats.length) {
      this.syncLabels(frame, new Set());
      return false;
    }
    const wall = performance.timeOrigin + now;
    if (frame.globe) {
      this.advance(wall);
      this.points.update(frame, Math.min(1, (wall - this.at) / STEP_MS));
    } else this.points.object.visible = false;
    this.syncOrbit(frame, wall);
    this.syncModels(frame, now);
    this.syncLabels(frame, new Set(frame.globe && this.map.getZoom() >= LABEL_ZOOM ? this.named() : []));
    if (this.followed) return true;
    // far out a satellite crosses a pixel in seconds: no need to draw the whole map every frame
    if (frame.globe) this.repaintLater(Math.min(REPAINT_MAX_MS, (500 * frame.centreMetresPerPixel) / LEO_SPEED));
    return false;
  }

  private repaintLater(ms: number) {
    if (this.repaintTimer) return;
    this.repaintTimer = window.setTimeout(() => {
      this.repaintTimer = 0;
      this.map.triggerRepaint();
    }, ms);
  }

  private named() {
    const ids: string[] = [];
    for (const s of this.sats) if (NAMED_GROUPS.has(s.group)) ids.push(s.id);
    return ids;
  }

  /** What is drawn as a model: the space stations, the selected and the followed one. */
  private modelIds() {
    const ids = new Set<string>();
    for (const s of this.sats) if (s.group === 'stations') ids.add(s.id);
    if (this.selected) ids.add(this.selected);
    if (this.followed) ids.add(this.followed);
    return ids;
  }

  private syncModels(frame: GeoFrame, now: number) {
    const ids = this.modelIds();
    for (const [id, model] of this.models) {
      if (ids.has(id)) continue;
      this.object.remove(model);
      this.models.delete(id);
    }
    for (const id of ids) {
      const s = this.byId.get(id);
      const p = s && this.exact(s, now);
      let model = this.models.get(id);
      if (!s || !p) {
        if (model) model.visible = false;
        continue;
      }
      if (!model) {
        model = s.group === 'stations' ? stationModel(satColor(s.group)) : satelliteModel(satColor(s.group));
        model.matrixAutoUpdate = false;
        model.traverse((o) => (o.frustumCulled = false));
        this.models.set(id, model);
        this.object.add(model);
      }
      // the 2D icons do it on the flat map, unless the camera is on this one
      model.visible = (frame.globe || id === this.followed) && !frame.occluded(p[0], p[1], p[2]);
      if (!model.visible) continue;
      const ahead = this.exact(s, now + 1000);
      const heading = ahead ? (Math.atan2((ahead[0] - p[0]) * Math.cos((p[1] * Math.PI) / 180), ahead[1] - p[1]) * 180) / Math.PI : 0;
      const length = s.group === 'stations' ? 100 : 14;
      frame.place(model.matrix, p[0], p[1], p[2], heading, Math.max(1, (MODEL_PX * frame.metresPerPixel(p[0], p[1], p[2])) / length));
    }
  }

  private syncOrbit(frame: GeoFrame, wall: number) {
    const id = this.followed ?? this.selected;
    const s = id ? this.byId.get(id) : undefined;
    if (!s) {
      if (this.orbit) this.orbit.object.visible = false;
      this.orbitOf = null;
      return;
    }
    if (!this.orbit) {
      this.orbit = new GeoLine([], { color: '#ffd23f', width: 1.5, opacity: 0.9, globeOnly: true });
      this.object.add(this.orbit.object);
    }
    if (this.orbitOf !== id || wall - this.orbitAt > ORBIT_REDRAW_MS) {
      const pts = orbitPath(s, new Date(wall));
      if (pts.length > 1) this.orbit.setPoints(pts);
      this.orbitOf = id;
      this.orbitAt = wall;
    }
    this.orbit.update(frame);
  }

  private syncLabels(frame: GeoFrame, named: Set<string>) {
    const seen = new Set<string>();
    const placed: [number, number][] = [];
    // the selected and the followed one first: they always get their name
    const must = [this.followed, this.selected].filter((id): id is string => !!id);
    if (frame.globe) {
      for (const id of [...must, ...named]) {
        const s = this.byId.get(id);
        const i = this.indexById.get(id);
        const p = i !== undefined && this.built ? this.dotPosition(i) : null;
        const pos = p && !sphereHides(frame.camera, p) ? frame.unitToScreen(p[0], p[1], p[2]) : null;
        if (!pos || !s || seen.has(id)) continue;
        // a cluster of objects (a station and its debris) gets one name, not a pile of them
        if (!must.includes(id) && placed.some((q) => Math.hypot(q[0] - pos[0], q[1] - pos[1]) < LABEL_GAP_PX)) continue;
        placed.push(pos);
        let el = this.labels.get(id);
        if (!el) {
          el = document.createElement('div');
          el.style.cssText =
            'position:absolute;left:0;top:0;white-space:nowrap;font:500 11px/1.2 system-ui,sans-serif;color:#ffe9a8;' +
            'text-shadow:0 0 3px rgba(10,12,16,.95),0 0 3px rgba(10,12,16,.95);will-change:transform';
          el.textContent = s.name;
          this.labelBox.append(el);
          this.labels.set(id, el);
        }
        el.style.transform = `translate(${pos[0].toFixed(1)}px,${(pos[1] + 8).toFixed(1)}px) translate(-50%,0)`;
        seen.add(id);
      }
    }
    for (const [id, el] of this.labels) {
      if (seen.has(id)) continue;
      el.remove();
      this.labels.delete(id);
    }
  }

  /** Where a dot is drawn right now. */
  private dotPosition(i: number): Vec3 {
    const mix = Math.min(1, Math.max(0, (performance.timeOrigin + performance.now() - this.at) / STEP_MS));
    const [f, t] = [this.from, this.to];
    const k = i * 3;
    return [f[k] + (t[k] - f[k]) * mix, f[k + 1] + (t[k + 1] - f[k + 1]) * mix, f[k + 2] + (t[k + 2] - f[k + 2]) * mix];
  }

  /** The nearest visible dot under a screen point. */
  featureAt(frame: GeoFrame, x: number, y: number): GeoFeature | null {
    if (!frame.globe || !this.built) return null;
    let best = -1;
    let bestD = PICK_PX;
    for (let i = 0; i < this.sats.length; i++) {
      const p = this.dotPosition(i);
      const s = frame.unitToScreen(p[0], p[1], p[2]);
      if (!s) continue;
      const d = Math.hypot(s[0] - x, s[1] - y);
      if (d < bestD && !sphereHides(frame.camera, p)) {
        bestD = d;
        best = i;
      }
    }
    return best >= 0 ? { layerId: SAT_FEATURE_LAYER, properties: { id: this.sats[best].id } } : null;
  }

  dispose() {
    clearTimeout(this.repaintTimer);
    this.points.dispose();
    this.orbit?.dispose();
    this.labelBox.remove();
  }
}
