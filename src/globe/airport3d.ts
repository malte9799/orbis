import type { ExpressionSpecification, GeoJSONSource, LayerSpecification, Map as MlMap } from 'maplibre-gl';
import type { Feature, FeatureCollection, LineString, Point, Polygon } from 'geojson';
import { emptyFc, loadAirportLayout, loadAirportLights, runwayCenters, type Bounds } from '../api/airport';
import { isSuperseded } from '../api/overpass';
import type { AircraftResult } from '../api/tracking';
import { PlanesLayer, PlaneTracker, type PlaneModel, type PlaneReport, type PlaneState } from './planes3d';
import { FONT_BOLD } from './vector';

// "Flughafen 3D": taxiways, aprons, terminals and gates from OpenStreetMap plus aircraft as 3D
// models with trails and callsign labels. Everything lives in its own sources/layers (ap3d-*).

/** From this zoom on the layout is loaded and aircraft are drawn as models. */
export const AIRPORT_ZOOM = 13;
/** Aircraft further than this from every known runway stay 2D icons. */
const NEAR_KM = 8;
/** Lights (thousands of nodes at a big airport) are loaded from this zoom on. */
const LIGHT_ZOOM = 16;
/** Grid of the requested boxes (degrees): a pan inside a loaded box costs no request. */
const GRID = 0.04;
const MAX_FEATURES = 25000;

export const AP3D_LAYERS = ['ap3d-apron', 'ap3d-area', 'ap3d-runway', 'ap3d-taxiway', 'ap3d-centerline', 'ap3d-bld', 'ap3d-light', 'ap3d-rwy-label', 'ap3d-taxi-label', 'ap3d-gate', 'ap3d-trail', 'ap3d-label', 'ap3d-hit'];
export const AP3D_HIT_LAYER = 'ap3d-hit';

const WIDE = new Set(['B741', 'B742', 'B743', 'B744', 'B748', 'B74S', 'B752', 'B762', 'B763', 'B764', 'B772', 'B773', 'B77L', 'B77W', 'B778', 'B779', 'B788', 'B789', 'B78X', 'A306', 'A30B', 'A310', 'A332', 'A333', 'A338', 'A339', 'A342', 'A343', 'A345', 'A346', 'A359', 'A35K', 'A388', 'MD11', 'DC10', 'IL96', 'A124', 'AN12', 'C5M', 'C17', 'A225', 'BLCF', 'BSCA', 'B74F']);
// B752 (757) is narrow in reality, but its length is closer to the long-haul models
WIDE.delete('B752');

const contains = (c: Bounds, b: Bounds) => c.west <= b.west && c.south <= b.south && c.east >= b.east && c.north >= b.north;

export interface Ap3dHooks {
  info(i: { loading?: boolean; count?: number; note?: string }): void;
}

type Poly = Feature<Polygon>;
type Line = Feature<LineString>;
type Pt = Feature<Point>;

// MapLibre world = 512·2^z px for 40 075 km; cos(lat) ≈ 0.64 (central Europe) as a fixed estimate
const px = (metres: number, zoom: number) => (metres * 2 ** zoom) / 78271.5 / 0.64;
/** line width in px from a width in metres (feature property `w`), growing with the zoom */
const lineWidth = (scale = 1): ExpressionSpecification => [
  'interpolate',
  ['exponential', 2],
  ['zoom'],
  12,
  ['max', 0.6, ['*', ['get', 'w'], px(1, 12) * scale]],
  20,
  ['*', ['get', 'w'], px(1, 20) * scale],
];

export class Airport3D {
  private enabled = false;
  private polys = new Map<string, Poly>();
  private lines = new Map<string, Line>();
  private points = new Map<string, Pt>();
  private centers: [number, number][] = [];
  private covered: Bounds[] = [];
  private lightsCovered: Bounds[] = [];
  private tracker = new PlaneTracker();
  private layer: PlanesLayer;
  private lastTrails = 0;
  private loading = false;

  constructor(
    private map: MlMap,
    private before: string,
    private hooks: Ap3dHooks,
  ) {
    this.layer = new PlanesLayer(this.tracker, {
      active: () => this.enabled && this.is3d(),
      frame: (planes) => this.updateLabels(planes),
    });
  }

  /** Mercator projection and zoomed in far enough. */
  private is3d() {
    return this.map.getZoom() >= AIRPORT_ZOOM && this.map.getProjection()?.type !== 'globe';
  }

  init() {
    const m = this.map;
    const src = (id: string) => {
      if (!m.getSource(id)) m.addSource(id, { type: 'geojson', data: emptyFc(), attribution: id === 'ap3d-poly' ? '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap-Mitwirkende</a> (ODbL)' : undefined });
    };
    for (const id of ['ap3d-poly', 'ap3d-line', 'ap3d-pt', 'ap3d-trail', 'ap3d-label']) src(id);
    const before = m.getLayer(this.before) ? this.before : undefined;
    const hidden = { visibility: 'none' as const };
    const add = (l: LayerSpecification) => {
      if (!m.getLayer(l.id)) m.addLayer(l, before);
    };
    const roads = { source: 'ap3d-line', minzoom: AIRPORT_ZOOM - 1 };
    add({
      id: 'ap3d-apron',
      type: 'fill',
      source: 'ap3d-poly',
      minzoom: AIRPORT_ZOOM - 1,
      filter: ['==', ['get', 'kind'], 'apron'],
      layout: hidden,
      paint: { 'fill-color': '#2b2e34', 'fill-opacity': 0.95 },
    });
    add({
      id: 'ap3d-area',
      type: 'fill',
      source: 'ap3d-poly',
      minzoom: AIRPORT_ZOOM - 1,
      filter: ['in', ['get', 'kind'], ['literal', ['runway', 'taxiway', 'taxilane']]],
      layout: hidden,
      paint: { 'fill-color': '#555a63' },
    });
    add({
      ...roads,
      id: 'ap3d-taxiway',
      type: 'line',
      filter: ['in', ['get', 'kind'], ['literal', ['taxiway', 'taxilane']]],
      layout: { ...hidden, 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ['match', ['get', 'kind'], 'taxilane', '#656a73', '#7b818b'], 'line-width': lineWidth() },
    } as LayerSpecification);
    add({
      ...roads,
      id: 'ap3d-runway',
      type: 'line',
      filter: ['==', ['get', 'kind'], 'runway'],
      layout: { ...hidden, 'line-cap': 'butt', 'line-join': 'round' },
      paint: { 'line-color': '#1d1f23', 'line-width': lineWidth() },
    } as LayerSpecification);
    add({
      ...roads,
      id: 'ap3d-centerline',
      type: 'line',
      minzoom: AIRPORT_ZOOM + 1,
      filter: ['==', ['get', 'kind'], 'runway'],
      layout: { ...hidden, 'line-cap': 'round' },
      paint: { 'line-color': '#f4f6f8', 'line-width': 1.6, 'line-dasharray': [0.01, 5] },
    } as LayerSpecification);
    add({
      id: 'ap3d-bld',
      type: 'fill-extrusion',
      source: 'ap3d-poly',
      minzoom: AIRPORT_ZOOM,
      filter: ['in', ['get', 'kind'], ['literal', ['terminal', 'hangar', 'building']]],
      layout: hidden,
      paint: {
        'fill-extrusion-color': ['match', ['get', 'kind'], 'terminal', '#8e958f', 'hangar', '#767d85', '#6d737a'],
        'fill-extrusion-height': ['get', 'h'],
        'fill-extrusion-base': ['get', 'minh'],
        'fill-extrusion-opacity': 0.96,
      },
    });
    add({
      id: 'ap3d-light',
      type: 'circle',
      source: 'ap3d-pt',
      minzoom: LIGHT_ZOOM,
      filter: ['==', ['get', 'kind'], 'light'],
      layout: hidden,
      paint: { 'circle-radius': 2, 'circle-color': '#ffd23f', 'circle-opacity': 0.9 },
    });
    add({
      id: 'ap3d-rwy-label',
      type: 'symbol',
      source: 'ap3d-line',
      minzoom: AIRPORT_ZOOM,
      filter: ['all', ['==', ['get', 'kind'], 'runway'], ['!=', ['get', 'ref'], '']],
      layout: { ...hidden, 'symbol-placement': 'line-center', 'text-field': ['get', 'ref'], 'text-font': FONT_BOLD, 'text-size': 12, 'text-keep-upright': true, 'text-letter-spacing': 0.1 },
      paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1.4 },
    });
    add({
      id: 'ap3d-taxi-label',
      type: 'symbol',
      source: 'ap3d-line',
      minzoom: AIRPORT_ZOOM + 1,
      filter: ['all', ['in', ['get', 'kind'], ['literal', ['taxiway', 'taxilane']]], ['!=', ['get', 'ref'], '']],
      layout: { ...hidden, 'symbol-placement': 'line', 'symbol-spacing': 260, 'text-field': ['get', 'ref'], 'text-font': FONT_BOLD, 'text-size': 11, 'text-keep-upright': true },
      paint: { 'text-color': '#e7eaee', 'text-halo-color': 'rgba(38,40,45,0.9)', 'text-halo-width': 1.4 },
    });
    add({
      id: 'ap3d-gate',
      type: 'symbol',
      source: 'ap3d-pt',
      minzoom: AIRPORT_ZOOM + 2,
      filter: ['all', ['in', ['get', 'kind'], ['literal', ['gate', 'parking']]], ['!=', ['get', 'ref'], '']],
      layout: { ...hidden, 'text-field': ['get', 'ref'], 'text-font': FONT_BOLD, 'text-size': 11, 'text-allow-overlap': false },
      paint: { 'text-color': '#ffd23f', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1.2 },
    });
    add({
      id: 'ap3d-trail',
      type: 'line',
      source: 'ap3d-trail',
      layout: { ...hidden, 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#ff6a2b', 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 1.5, 18, 3.5], 'line-opacity': 0.95 },
    });
    add({
      id: 'ap3d-label',
      type: 'symbol',
      source: 'ap3d-label',
      layout: {
        ...hidden,
        'text-field': ['step', ['zoom'], ['get', 'callsign'], 16, ['concat', ['get', 'callsign'], ['case', ['!=', ['get', 'icao'], ''], ['concat', '\n', ['get', 'icao']], '']]],
        'text-font': FONT_BOLD,
        'text-size': 12,
        // the model grows with the zoom: lift the label with it
        'text-offset': ['interpolate', ['linear'], ['zoom'], 15, ['literal', [0, -1.4]], 18.5, ['literal', [0, -3.4]]],
        'text-anchor': 'bottom',
        'text-allow-overlap': true,
        'text-padding': 4,
      },
      paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(10,12,16,0.85)', 'text-halo-width': 1.6 },
    });
    // invisible but clickable: the 3D models themselves cannot be picked
    add({
      id: AP3D_HIT_LAYER,
      type: 'circle',
      source: 'ap3d-label',
      layout: hidden,
      paint: { 'circle-radius': 26, 'circle-opacity': 0, 'circle-stroke-width': 0 },
    });
    if (!m.getLayer(this.layer.id)) m.addLayer(this.layer, before);
  }

  setEnabled(on: boolean) {
    if (on === this.enabled) return;
    this.enabled = on;
    if (!on) {
      this.tracker.clear();
      this.setData('ap3d-trail', emptyFc());
      this.setData('ap3d-label', emptyFc());
      this.hooks.info({ loading: false, count: undefined, note: undefined });
      return;
    }
    this.onMoveEnd();
    this.map.triggerRepaint();
  }

  /** Called after the map stopped moving: load the layout for the visible box. */
  onMoveEnd() {
    if (!this.enabled) return;
    if (this.map.getProjection()?.type === 'globe') {
      this.hooks.info({ loading: false, note: 'nur in der flachen Kartenansicht (Projektion „Karte“)' });
      return;
    }
    if (this.map.getZoom() < AIRPORT_ZOOM) {
      this.hooks.info({ loading: false, note: `ab Zoomstufe ${AIRPORT_ZOOM} sichtbar – zu einem Flughafen zoomen` });
      return;
    }
    const b = this.viewBox();
    if (this.map.getZoom() >= LIGHT_ZOOM) this.loadLights(b);
    if (this.covered.some((c) => contains(c, b))) {
      this.summary();
      return;
    }
    if (b.east - b.west > 0.6 || b.north - b.south > 0.6) return;
    this.loading = true;
    this.hooks.info({ loading: true });
    loadAirportLayout(b)
      .then((layout) => {
        this.loading = false;
        this.covered.push(b);
        if (this.polys.size + this.lines.size + this.points.size > MAX_FEATURES) {
          this.polys.clear();
          this.lines.clear();
          this.points.clear();
          this.covered = [b];
          this.lightsCovered = [];
        }
        for (const f of layout.polygons) this.polys.set(String(f.id), f);
        for (const f of layout.lines) this.lines.set(String(f.id), f);
        for (const f of layout.points) this.points.set(String(f.id), f);
        this.centers = runwayCenters([...this.lines.values()]);
        this.setData('ap3d-poly', emptyFc([...this.polys.values()]));
        this.setData('ap3d-line', emptyFc([...this.lines.values()]));
        this.setData('ap3d-pt', emptyFc([...this.points.values()]));
        this.summary();
        // the lights of the box we are looking at
        if (this.map.getZoom() >= LIGHT_ZOOM) this.loadLights(this.viewBox());
      })
      .catch((e) => {
        if (isSuperseded(e)) return;
        this.loading = false;
        console.warn('Overpass airport3d', e);
        this.hooks.info({ loading: false, note: 'OpenStreetMap (Overpass) nicht erreichbar' });
      });
  }

  /** The visible map box on the request grid. */
  private viewBox(): Bounds {
    const v = this.map.getBounds();
    const snap = (x: number, f: (n: number) => number) => f(x / GRID) * GRID;
    return { west: snap(v.getWest(), Math.floor), south: snap(v.getSouth(), Math.floor), east: snap(v.getEast(), Math.ceil), north: snap(v.getNorth(), Math.ceil) };
  }

  private loadLights(b: Bounds) {
    // only where a layout is loaded – elsewhere there is no airport
    if (!this.covered.some((c) => contains(c, b)) || this.lightsCovered.some((c) => contains(c, b))) return;
    loadAirportLights(b)
      .then((lights) => {
        this.lightsCovered.push(b);
        for (const f of lights) this.points.set(String(f.id), f);
        this.setData('ap3d-pt', emptyFc([...this.points.values()]));
      })
      .catch((e) => {
        if (!isSuperseded(e)) console.warn('Overpass airport3d lights', e);
      });
  }

  private summary() {
    const n = this.lines.size + this.polys.size;
    this.hooks.info({
      loading: this.loading,
      count: n || undefined,
      note: n ? 'Rollwege, Terminals und Flugzeuge in 3D – zum Kippen Strg + Ziehen' : 'hier kein Flughafen in OpenStreetMap erfasst',
    });
  }

  /** Is this aircraft drawn as 3D model (so the 2D icon should disappear)? */
  owns(hex: string) {
    if (!this.enabled || !this.is3d()) return false;
    return !!this.tracker.planes.get(hex)?.near;
  }

  private nearAirport(lon: number, lat: number) {
    const k = Math.cos((lat * Math.PI) / 180);
    for (const [cLon, cLat] of this.centers) {
      if (Math.hypot((cLon - lon) * k, cLat - lat) * 111.32 <= NEAR_KM) return true;
    }
    return false;
  }

  /** Fresh aircraft positions from the data source. */
  feed(fc: AircraftResult) {
    if (!this.enabled) return;
    const reports: PlaneReport[] = [];
    for (const f of fc.features) {
      const p = f.properties as Record<string, unknown>;
      const [lon, lat] = f.geometry.coordinates;
      const kind = String(p.kind);
      if (kind !== 'plane' && kind !== 'heli') continue;
      const ground = !!p.ground;
      const icao = String(p.icao ?? '');
      const model: PlaneModel = kind === 'heli' ? 'heli' : p.cat === 'A5' || WIDE.has(icao) ? 'wide' : 'narrow';
      const speedMs = p.speedKmh != null ? Number(p.speedKmh) / 3.6 : 0;
      reports.push({
        hex: String(p.hex),
        lon,
        lat,
        altM: Number(p.altM) || 0,
        track: Number(p.track) || 0,
        // a taxiing or parked plane (a few knots of noise) must not drift
        speedMs: ground && speedMs < 1.5 ? 0 : speedMs,
        ground,
        model,
        emergency: !!p.emergency,
        near: this.nearAirport(lon, lat),
        props: p,
      });
    }
    this.tracker.feed(reports, performance.now());
    this.updateTrails();
    if (this.enabled && this.is3d()) this.map.triggerRepaint();
  }

  private updateLabels(planes: PlaneState[]) {
    const features: Feature<Point>[] = planes.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.dLon, p.dLat] },
      properties: { ...p.props, altM: Math.round(p.dAlt), track: Math.round(p.dTrack), callsign: String(p.props.callsign ?? ''), icao: String(p.props.icao ?? '') },
    }));
    this.setData('ap3d-label', emptyFc(features));
    if (performance.now() - this.lastTrails > 1000) this.updateTrails();
  }

  private updateTrails() {
    this.lastTrails = performance.now();
    const features: Feature<LineString>[] = [];
    for (const p of this.tracker.planes.values()) {
      if (!p.near || p.trail.length < 2) continue;
      features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: [...p.trail, [p.dLon, p.dLat]] }, properties: { hex: p.hex } });
    }
    this.setData('ap3d-trail', emptyFc(features));
  }

  private setData(id: string, data: FeatureCollection) {
    (this.map.getSource(id) as GeoJSONSource | undefined)?.setData(data);
  }
}
