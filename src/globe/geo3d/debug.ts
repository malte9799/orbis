import * as THREE from 'three';
import type { Map as MlMap } from 'maplibre-gl';
import { EARTH_RADIUS_M, type GeoFrame, type Vec3 } from './frame';
import { GeoLine } from './line';
import { GeoFocus } from './focus';
import { GeoStage, type GeoPart, type GeoTarget } from './stage';
import { bindFollowUrl } from './url';

// Test scene for the 3D renderer: dev server only, open with ?geo3d in the address.
// White dots and the thin white line are MapLibre's own layers at the same coordinates: the foot of
// every pin and the cyan line must sit exactly on them, at every zoom and during the blend.
// Click on a pin or a satellite: the camera turns and zooms around it. Esc or a click elsewhere ends that.
// The address names the object: #/karte?follow=pin/berlin, #/karte?follow=sat/leo. With a point in time
// the low satellite stands where it was then: #/karte?follow=sat/leo&follow.t=1730000000 (unix seconds).

const PINS: [string, number, number][] = [
  ['Berlin', 13.4, 52.5],
  ['New York', -74, 40.7],
  ['Tokio', 139.7, 35.7],
  ['Sydney', 151.2, -33.9],
  ['Quito', -78.5, -0.2],
  ['Null', 0, 0],
  ['Fidschi', 179.9, -17],
  ['Spitzbergen', 15.6, 78.2],
];
const BERLIN: [number, number] = [13.4, 52.5];
const TOKYO: [number, number] = [139.7, 35.7];
const NEW_YORK: [number, number] = [-74, 40.7];
const MODEL_M = 100;
const MODEL_PX = 34;
const LEO_M = 550000;
const GEO_M = 35786000;
const ISS_INCLINATION = 51.6;
const LEO_PERIOD_S = 60; // much faster than real, so jitter and the edge of the Earth are easy to see

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Great circle between two places, longitudes continuous; `lift` is the altitude along it. */
function greatCircle(a: [number, number], b: [number, number], lift: (t: number, metres: number) => number, n = 128): Vec3[] {
  const v = (p: [number, number]) => [Math.cos(rad(p[1])) * Math.cos(rad(p[0])), Math.cos(rad(p[1])) * Math.sin(rad(p[0])), Math.sin(rad(p[1]))];
  const [p, q] = [v(a), v(b)];
  const d = Math.acos(p[0] * q[0] + p[1] * q[1] + p[2] * q[2]);
  const out: Vec3[] = [];
  let last = a[0];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const [k1, k2] = [Math.sin((1 - t) * d) / Math.sin(d), Math.sin(t * d) / Math.sin(d)];
    const [x, y, z] = [k1 * p[0] + k2 * q[0], k1 * p[1] + k2 * q[1], k1 * p[2] + k2 * q[2]];
    let lon = deg(Math.atan2(y, x));
    lon += 360 * Math.round((last - lon) / 360);
    last = lon;
    out.push([lon, deg(Math.atan2(z, Math.hypot(x, y))), lift(t, d * EARTH_RADIUS_M)]);
  }
  return out;
}

/** Point `angle` degrees along a circular orbit [lon, lat], ignoring the rotation of the Earth. */
function orbitPoint(inclination: number, angle: number): [number, number] {
  const a = rad(angle);
  const i = rad(inclination);
  return [deg(Math.atan2(Math.sin(a) * Math.cos(i), Math.cos(a))), deg(Math.asin(Math.sin(a) * Math.sin(i)))];
}

function leoPosition(now: number): Vec3 {
  // by the wall clock, so that the same time means the same place after a reload
  const [lon, lat] = orbitPoint(ISS_INCLINATION, (((performance.timeOrigin + now) / 1000 / LEO_PERIOD_S) * 360) % 360);
  return [lon, lat, LEO_M];
}

function orbitLine(inclination: number, alt: number): Vec3[] {
  const out: Vec3[] = [];
  let last = 0;
  for (let k = 0; k <= 360; k += 2) {
    const [lon0, lat] = orbitPoint(inclination, k);
    const lon = lon0 + 360 * Math.round((last - lon0) / 360);
    last = lon;
    out.push([lon, lat, alt]);
  }
  return out;
}

/** A pin in metres: the tip of the cone is the place itself, the red bar is the nose (y). */
function pinModel(color: number): THREE.Group {
  const g = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(MODEL_M * 0.18, MODEL_M, 16).rotateX(-Math.PI / 2).translate(0, 0, MODEL_M / 2), new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
  const nose = new THREE.Mesh(new THREE.BoxGeometry(MODEL_M * 0.08, MODEL_M * 0.7, MODEL_M * 0.08).translate(0, MODEL_M * 0.35, MODEL_M * 0.5), new THREE.MeshLambertMaterial({ color: 0xff2d55, side: THREE.DoubleSide }));
  g.add(cone, nose);
  g.traverse((o) => (o.frustumCulled = false));
  g.matrixAutoUpdate = false;
  return g;
}

class PinPart implements GeoPart {
  readonly object = new THREE.Group();
  readonly source = 'pin';
  private pins = PINS.map(([, lon, lat]) => {
    const model = pinModel(0xf2c94c);
    this.object.add(model);
    return { lon, lat, model };
  });

  targets(): GeoTarget[] {
    return PINS.map(([label, lon, lat]) => ({ source: this.source, slug: label.toLowerCase().replace(/\s+/g, '-'), label, position: (): Vec3 => [lon, lat, 0] }));
  }

  update(f: GeoFrame) {
    for (const p of this.pins) {
      p.model.visible = !f.occluded(p.lon, p.lat);
      if (!p.model.visible) continue;
      const scale = Math.max(1, (MODEL_PX * f.metresPerPixel(p.lon, p.lat)) / MODEL_M);
      f.place(p.model.matrix, p.lon, p.lat, 0, 45, scale);
      p.model.matrixWorldNeedsUpdate = true;
    }
  }
}

/** Objects that move along an orbit every frame. */
class SatPart implements GeoPart {
  readonly object = new THREE.Group();
  readonly source = 'sat';
  /** the low satellite stands still at this time (performance.now scale) */
  private frozen: number | null = null;
  private leo = pinModel(0xb388ff);
  private geo = [0, 120, 240, 300].map((lon) => {
    const model = pinModel(0x4fc3f7);
    this.object.add(model);
    return { lon, model };
  });

  constructor() {
    this.object.add(this.leo);
  }

  targets(): GeoTarget[] {
    return [
      { source: this.source, slug: 'leo', label: 'LEO, 550 km', position: leoPosition },
      ...this.geo.map((g): GeoTarget => ({ source: this.source, slug: `geo-${g.lon}`, label: `GEO ${g.lon}°`, position: () => [g.lon, 0, GEO_M] })),
    ];
  }

  /** `t` (unix seconds): the low satellite at that moment instead of now. */
  resolve(slug: string, params: Record<string, string>): GeoTarget | null {
    const t = Number(params.t);
    if (slug === 'leo' && params.t && Number.isFinite(t)) {
      const at = t * 1000 - performance.timeOrigin;
      return {
        source: this.source,
        slug,
        label: `LEO am ${new Date(t * 1000).toLocaleTimeString()}`,
        position: () => leoPosition(at),
        params: () => ({ t: String(t) }),
        entered: () => (this.frozen = at),
        released: () => (this.frozen = null),
      };
    }
    return this.targets().find((x) => x.slug === slug) ?? null;
  }

  update(f: GeoFrame, now: number) {
    const [lon, lat, alt] = leoPosition(this.frozen ?? now);
    this.sat(f, this.leo, lon, lat, alt);
    // the geostationary ones only exist on the globe: the camera cannot get close enough for the flat map
    for (const g of this.geo) {
      g.model.visible = f.globe;
      if (f.globe) this.sat(f, g.model, g.lon, 0, GEO_M);
    }
    return true;
  }

  private sat(f: GeoFrame, model: THREE.Object3D, lon: number, lat: number, alt: number) {
    model.visible = !f.occluded(lon, lat, alt);
    if (!model.visible) return;
    f.place(model.matrix, lon, lat, alt, 0, Math.max(1, (MODEL_PX * f.metresPerPixel(lon, lat, alt)) / MODEL_M));
    model.matrixWorldNeedsUpdate = true;
  }
}

/** Numbers to read off while moving around, and an HTML label that sticks to Berlin. */
class Readout implements GeoPart {
  readonly object = new THREE.Group();
  private box = document.createElement('div');
  private label = document.createElement('div');
  private text = document.createElement('pre');
  private frames = 0;
  private fps = 0;
  private since = 0;
  private worst = 0;
  private shown = 0;
  private aimError = 0;

  constructor(
    private map: MlMap,
    private focus: GeoFocus,
  ) {
    this.box.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:5';
    this.label.textContent = 'Berlin (toScreen)';
    this.label.style.cssText = 'position:absolute;left:0;top:0;font:700 12px system-ui;color:#fff;text-shadow:0 0 3px #000;will-change:transform';
    // above the whole app, its panels would cover it inside the map
    this.text.style.cssText = 'position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:9999;pointer-events:none;margin:0;padding:8px 10px;font:12px/1.5 ui-monospace,monospace;color:#fff;background:rgba(0,0,0,.72);border-radius:6px';
    this.box.append(this.label);
    map.getCanvasContainer().appendChild(this.box);
    document.body.append(this.text);
  }

  update(f: GeoFrame, now: number) {
    const pos = f.toScreen(BERLIN[0], BERLIN[1]);
    this.label.style.display = pos ? '' : 'none';
    if (pos) this.label.style.transform = `translate(${pos[0].toFixed(1)}px,${(pos[1] - 44).toFixed(1)}px) translate(-50%,-100%)`;
    // MapLibre's own answer is only the truth without blending (map.project ignores the blend)
    if (f.t === 0 || f.t === 1) {
      for (const [, lon, lat] of PINS) {
        const mine = f.toScreen(lon, lat);
        if (!mine) continue;
        const theirs = this.map.project([lon, lat]);
        // only what is really on screen: outside it is of no interest and the numbers get huge
        if (theirs.x < 0 || theirs.y < 0 || theirs.x > f.width || theirs.y > f.height) continue;
        this.worst = Math.max(this.worst, Math.hypot(mine[0] - theirs.x, mine[1] - theirs.y));
      }
    }
    const target = this.focus.target;
    const aim = target?.position(now);
    const aimAt = aim ? f.toScreen(aim[0], aim[1], aim[2]) : null;
    if (aimAt) this.aimError = Math.max(this.aimError, Math.hypot(aimAt[0] - f.width / 2, aimAt[1] - f.height / 2));
    this.frames++;
    if (now - this.since > 500) {
      this.fps = (this.frames * 1000) / (now - this.since);
      this.frames = 0;
      this.since = now;
      this.shown = this.worst;
      this.worst = 0;
      const mode = f.t === 1 ? 'Globus, eigener Framebuffer' : f.t === 0 ? 'flach, direkt in die Karte' : 'Überblendung, eigener Framebuffer';
      this.text.textContent =
        `geo3d-Spike\nZoom ${this.map.getZoom().toFixed(2)}  Pitch ${this.map.getPitch().toFixed(0)}°\n${mode}\nt = ${f.t.toFixed(3)}\n` +
        `${this.fps.toFixed(0)} fps\nAbweichung zu map.project: ${f.t === 0 || f.t === 1 ? `${this.shown.toFixed(3)} px` : 'n/a'}\n` +
        (target ? `Fokus: ${target.label}, zur Bildmitte ${this.aimError.toFixed(2)} px\nZiehen: drehen, Rad: Zoom, Esc: lösen` : 'Klick auf Objekt: fokussieren');
      this.aimError = 0;
    }
  }

  dispose() {
    this.box.remove();
    this.text.remove();
  }
}

/** Returns the click handler for the map: true when the click was meant for the 3D scene. */
export function startGeo3dDebug(map: MlMap) {
  const surface = greatCircle(BERLIN, TOKYO, () => 0);
  const wrap = (lon: number) => ((lon + 540) % 360) - 180;
  map.addSource('geo3d-debug', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: [
        ...PINS.map(([name, lon, lat]) => ({ type: 'Feature' as const, properties: { name }, geometry: { type: 'Point' as const, coordinates: [lon, lat] } })),
        { type: 'Feature' as const, properties: {}, geometry: { type: 'LineString' as const, coordinates: surface.map((p) => [wrap(p[0]), p[1]]) } },
      ],
    },
  });
  map.addLayer({ id: 'geo3d-debug-line', type: 'line', source: 'geo3d-debug', filter: ['==', ['geometry-type'], 'LineString'], paint: { 'line-color': '#fff', 'line-width': 1 } });
  map.addLayer({ id: 'geo3d-debug-dot', type: 'circle', source: 'geo3d-debug', filter: ['==', ['geometry-type'], 'Point'], paint: { 'circle-color': '#fff', 'circle-radius': 4, 'circle-stroke-color': '#000', 'circle-stroke-width': 1 } });

  const stage = new GeoStage();
  map.addLayer(stage);
  stage.add(new PinPart());
  stage.add(new SatPart());
  const focus = new GeoFocus(map, stage);
  stage.add(new Readout(map, focus));
  // on the surface, under it the thin white line of MapLibre
  stage.add(new GeoLine(surface, { color: '#00e5ff', width: 3, opacity: 0.8 }));
  // a real bow: the height grows with the distance
  stage.add(new GeoLine(greatCircle(BERLIN, NEW_YORK, (t, m) => Math.sin(Math.PI * t) * m * 0.15), { color: '#ffd54f', width: 2.5 }));
  stage.add(new GeoLine(orbitLine(ISS_INCLINATION, LEO_M), { color: '#b388ff', width: 1.5, globeOnly: true }));
  stage.add(new GeoLine(orbitLine(0, GEO_M), { color: '#4fc3f7', width: 1.5, globeOnly: true }));
  bindFollowUrl(focus, stage);
  return (x: number, y: number) => focus.click(x, y);
}
