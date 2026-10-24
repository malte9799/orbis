import type { ExpressionSpecification, GeoJSONSource, LayerSpecification, Map as MlMap } from 'maplibre-gl';
import type { Feature, FeatureCollection, LineString, Point, Polygon } from 'geojson';
import { emptyFc, loadAirportLayout, loadAirportLights, loadStaticAirport, staticAirports, type Bounds, type StaticAirport } from '../api/airport';
import { isSuperseded } from '../api/overpass';
import { loadRoute, plausible, type FlightRoute } from '../api/route';
import type { AircraftResult } from '../api/tracking';
import { PlanesLayer, PlaneTracker, type PlaneModel, type PlaneReport, type PlaneState } from './planes3d';
import { FONT_BOLD, FONT_REGULAR } from './vector';

// "Flughafen 3D": taxiways, aprons and gates from OpenStreetMap plus aircraft as 3D
// models with trails and callsign labels. Everything lives in its own sources/layers (ap3d-*).

/** From this zoom on the airport layout is loaded and shown. */
export const AIRPORT_ZOOM = 11;
/** From this zoom on aircraft are drawn as models with trails (when the map is tilted). */
const PLANE_ZOOM = 6.5;
/** Below this pitch (degrees) the map counts as flat: 2D icons and flat trails, no heights. */
const TILT_MIN = 5;
/** Retry after a failed load (the public Overpass servers are often at capacity). */
const RETRY_MS = 20000;
/**
 * Lights in the colours OSM maps (thresholds green or red, approach lights white or red, red/yellow
 * bars …). `true` simplifies them: thresholds green, approach white, everything on a runway white.
 * Meant to become an option later.
 */
const SIMPLE_LIGHTS = false;

/** Lights are shown from the same zoom as the taxiways and loaded from the layout zoom on. */
const LIGHT_ZOOM = AIRPORT_ZOOM;
/** Grid of the requested boxes (degrees): a pan inside a loaded box costs no request. */
const GRID = 0.04;
const MAX_FEATURES = 25000;

export const AP3D_LAYERS = ['ap3d-apron', 'ap3d-area', 'ap3d-runway', 'ap3d-taxiway', 'ap3d-light', 'ap3d-rwy-label', 'ap3d-taxi-label', 'ap3d-gate'];
/** the aircraft labels and click targets follow the aircraft, not the airport layer */
const PLANE_LAYERS = ['ap3d-hit'];
export const AP3D_HIT_LAYER = 'ap3d-hit';

const WIDE = new Set(['B741', 'B742', 'B743', 'B744', 'B748', 'B74S', 'B752', 'B762', 'B763', 'B764', 'B772', 'B773', 'B77L', 'B77W', 'B778', 'B779', 'B788', 'B789', 'B78X', 'A306', 'A30B', 'A310', 'A332', 'A333', 'A338', 'A339', 'A342', 'A343', 'A345', 'A346', 'A359', 'A35K', 'A388', 'MD11', 'DC10', 'IL96', 'A124', 'AN12', 'C5M', 'C17', 'A225', 'BLCF', 'BSCA', 'B74F']);
// B752 (757) is narrow in reality, but its length is closer to the long-haul models
WIDE.delete('B752');

const contains = (c: Bounds, b: Bounds) => c.west <= b.west && c.south <= b.south && c.east >= b.east && c.north >= b.north;

export interface Ap3dHooks {
  info(i: { loading?: boolean; count?: number; note?: string }): void;
  /** the map was tilted/flattened or zoomed across a threshold: 2D icons may need updating */
  modeChanged(): void;
  /** flat map with 2D icons: refresh their positions from the smoothed state */
  iconsTick(): void;
}

export type PlaneMode = 'off' | 'flat' | '3d';

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
  private layoutOn = false;
  private planesOn = false;
  private iconsOn = false;
  private lastMode: PlaneMode = 'off';
  private polys = new Map<string, Poly>();
  private lines = new Map<string, Line>();
  private points = new Map<string, Pt>();
  private retry: number | undefined;
  private staticLoaded = new Set<string>();
  private viewSeq = 0;
  private covered: Bounds[] = [];
  private lightsCovered: Bounds[] = [];
  private tracker = new PlaneTracker();
  private layer: PlanesLayer;
  private loading = false;

  constructor(
    private map: MlMap,
    private before: string,
    private hooks: Ap3dHooks,
  ) {
    this.layer = new PlanesLayer(this.tracker, {
      mode: () => this.mode(),
      icons: () => this.iconsOn,
      tick: () => this.hooks.iconsTick(),
      frame: (planes) => this.updateLabels(planes),
    });
  }

  /** 'off' without aircraft layer, zoomed out or on the globe; 'flat' while the map is not tilted. */
  mode(): PlaneMode {
    if (!this.planesOn || this.map.getZoom() < PLANE_ZOOM || this.map.getProjection()?.type === 'globe') return 'off';
    return this.map.getPitch() > TILT_MIN ? '3d' : 'flat';
  }

  /** Keep the aircraft (3D layer, labels, click targets) above everything else. */
  private raise() {
    const layers = this.map.getStyle()?.layers;
    if (!layers?.length || layers[layers.length - 1].id === AP3D_HIT_LAYER) return;
    for (const id of [this.layer.id, ...PLANE_LAYERS]) if (this.map.getLayer(id)) this.map.moveLayer(id);
  }

  private checkMode() {
    const mode = this.mode();
    if (mode === this.lastMode) return;
    this.lastMode = mode;
    this.hooks.modeChanged();
    this.map.triggerRepaint();
  }

  init() {
    const m = this.map;
    const src = (id: string) => {
      if (!m.getSource(id)) m.addSource(id, { type: 'geojson', data: emptyFc(), attribution: id === 'ap3d-poly' ? '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap-Mitwirkende</a> (ODbL)' : undefined });
    };
    for (const id of ['ap3d-poly', 'ap3d-line', 'ap3d-pt', 'ap3d-label']) src(id);
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
    // airfield lights by type (OSM `navigationaid`): taxiway edge blue and centre green, runway edge/centre/
    // touchdown/approach white, thresholds green, stop bars red, clearance bars and guard lights yellow
    const lightSize: ExpressionSpecification = ['match', ['get', 'lt'], 'txe', 1.3, 'txc', 0.8, 'rwe', 2.1, 'rwc', 1.1, 'tdz', 1.7, 'als', 1.9, 'rwt', 2.3, 'sbl', 1.9, 'cbl', 1.9, 'rgl', 1.9, 'txw', 1.4, 'papi', 2.6, 1.2];
    add({
      id: 'ap3d-light',
      type: 'circle',
      source: 'ap3d-pt',
      minzoom: AIRPORT_ZOOM - 1,
      filter: ['==', ['get', 'kind'], 'light'],
      layout: hidden,
      paint: {
        'circle-color': SIMPLE_LIGHTS
          ? // thresholds read green and approach lights white from both directions (OSM also stores their red sides)
            ['match', ['get', 'lt'], 'rwt', '#2bd47d', 'als', '#f4f6f8', ['match', ['get', 'col'], 'blue', '#4a78ff', 'green', '#2bd47d', 'red', '#ff4b4b', 'yellow', '#ffd23f', '#f4f6f8']]
          : ['match', ['get', 'col'], 'blue', '#4a78ff', 'green', '#2bd47d', 'red', '#ff4b4b', 'yellow', '#ffd23f', '#f4f6f8'],
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, ['*', lightSize, 0.5], 16, lightSize, 19, ['*', lightSize, 2.2]],
        'circle-opacity': ['match', ['get', 'lt'], 'txc', 0.75, 0.95],
      },
    });
    add({
      id: 'ap3d-rwy-label',
      type: 'symbol',
      source: 'ap3d-line',
      minzoom: AIRPORT_ZOOM,
      filter: ['all', ['==', ['get', 'kind'], 'runway'], ['!=', ['get', 'ref'], '']],
      layout: { ...hidden, 'symbol-placement': 'line', 'symbol-spacing': 340, 'text-field': ['get', 'ref'], 'text-font': FONT_REGULAR, 'text-size': 12, 'text-keep-upright': true, 'text-letter-spacing': 0.05 },
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
      minzoom: AIRPORT_ZOOM + 4,
      filter: ['all', ['in', ['get', 'kind'], ['literal', ['gate', 'parking']]], ['!=', ['get', 'ref'], '']],
      layout: { ...hidden, 'text-field': ['get', 'ref'], 'text-font': FONT_BOLD, 'text-size': 11, 'text-allow-overlap': false },
      paint: { 'text-color': '#ffd23f', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1.2 },
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
    // overlays (radar, forecast …) are added later and must not cover the aircraft
    m.on('styledata', () => this.raise());
    m.on('pitchend', () => this.checkMode());
    m.on('zoomend', () => this.checkMode());
  }

  /** Layout of the airports (`layout`), aircraft with trails (`planes`), 2D aircraft icons shown (`icons`). */
  configure(o: { layout: boolean; planes: boolean; icons: boolean }) {
    this.iconsOn = o.icons;
    if (o.planes !== this.planesOn) {
      this.planesOn = o.planes;
      for (const id of PLANE_LAYERS) if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', o.planes ? 'visible' : 'none');
      if (!o.planes) {
        this.tracker.clear();
        this.setData('ap3d-label', emptyFc());
      }
    }
    if (o.layout !== this.layoutOn) {
      this.layoutOn = o.layout;
      if (o.layout) this.onMoveEnd();
      else {
        clearTimeout(this.retry);
        this.hooks.info({ loading: false, count: undefined, note: undefined });
      }
    }
    this.checkMode();
    this.map.triggerRepaint();
  }

  /** Called after the map stopped moving: load the layout for the visible box. */
  onMoveEnd() {
    if (!this.layoutOn) return;
    if (this.map.getProjection()?.type === 'globe') {
      this.hooks.info({ loading: false, note: 'nur in der flachen Kartenansicht (Projektion „Karte“)' });
      return;
    }
    if (this.map.getZoom() < AIRPORT_ZOOM) {
      this.hooks.info({ loading: false, note: `ab Zoomstufe ${AIRPORT_ZOOM} sichtbar – zu einem Flughafen zoomen` });
      return;
    }
    clearTimeout(this.retry);
    const b = this.viewBox();
    const seq = ++this.viewSeq;
    // airports with a pre-built layout come from our own files; Overpass only for the rest
    staticAirports().then(async (list) => {
      if (seq !== this.viewSeq || !this.layoutOn) return;
      const view = this.map.getBounds();
      const hit = list.filter((a) => a.bbox[0] <= view.getEast() && a.bbox[2] >= view.getWest() && a.bbox[1] <= view.getNorth() && a.bbox[3] >= view.getSouth());
      if (!hit.length) return this.loadLive(b);
      this.loading = true;
      this.hooks.info({ loading: true });
      await Promise.all(hit.map((a) => this.loadStatic(a)));
      this.loading = false;
      this.summary();
    });
  }

  private async loadStatic(a: StaticAirport) {
    if (this.staticLoaded.has(a.icao)) return;
    this.staticLoaded.add(a.icao);
    try {
      const layout = await loadStaticAirport(a);
      this.merge(layout.polygons, layout.lines, layout.points);
    } catch (e) {
      this.staticLoaded.delete(a.icao);
      console.warn('airport layout', e);
      this.retry = window.setTimeout(() => this.onMoveEnd(), RETRY_MS);
    }
  }

  /** Live from Overpass: for airports that are not pre-built. */
  private loadLive(b: Bounds) {
    if (this.covered.some((c) => contains(c, b))) {
      this.summary();
      this.loadDetails(b);
      return;
    }
    if (b.east - b.west > 1 || b.north - b.south > 1) return;
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
          this.staticLoaded.clear();
        }
        this.merge(layout.polygons, layout.lines, layout.points);
        this.summary();
        this.loadDetails(this.viewBox());
      })
      .catch((e) => {
        if (isSuperseded(e)) return;
        this.loading = false;
        console.warn('Overpass airport3d', e);
        this.hooks.info({ loading: false, note: 'OpenStreetMap (Overpass) gerade nicht erreichbar – neuer Versuch in Kürze' });
        this.retry = window.setTimeout(() => this.onMoveEnd(), RETRY_MS);
      });
  }

  /**
   * Lights on a runway read white: OSM often tags runway edge lights blue (or leaves the airport's
   * lights untagged, which the files store as blue). Whatever blue light lies within a runway's width
   * is switched to white, as is every blue light on the extended centre line up to 1.2 km before and behind the
   * runway ends (approach lighting); automatically for every airport. Thresholds, stop bars etc. keep their colour.
   */
  private whitenRunwayLights(points: Pt[]) {
    const runways: { w: number; coords: number[][] }[] = [];
    for (const l of this.lines.values()) {
      if (l.properties?.kind === 'runway' && l.geometry.type === 'LineString') runways.push({ w: Math.max(Number(l.properties.w) || 0, 45), coords: l.geometry.coordinates });
    }
    if (!runways.length) return;
    for (const f of points) {
      const pr = f.properties;
      // files in the old format only know positions (all "blue"); the full colours are kept for the others
      if (!pr || pr.kind !== 'light' || pr.col === 'white' || !(SIMPLE_LIGHTS || pr.legacy)) continue;
      const recolour = pr.col === 'blue' || (['rwe', 'rwc', 'tdz'].includes(String(pr.lt)) && pr.col === 'green');
      if (!recolour) continue;
      const [lon, lat] = f.geometry.coordinates;
      const kx = Math.cos((lat * Math.PI) / 180) * 111320;
      const near = runways.some(({ w, coords }) => {
        // approach lights: on the extended centre line, up to 1.2 km before and behind the runway ends
        const first = coords[0];
        const last = coords[coords.length - 1];
        const ex = (last[0] - first[0]) * kx;
        const ey = (last[1] - first[1]) * 111320;
        const len = Math.hypot(ex, ey);
        if (len > 300) {
          const rx = (lon - first[0]) * kx;
          const ry = (lat - first[1]) * 111320;
          const along = (rx * ex + ry * ey) / len;
          const across = Math.abs(rx * ey - ry * ex) / len;
          if (across <= Math.max(25, w / 2 + 6) && along >= -1200 && along <= len + 1200) return true;
        }
        const limit = w / 2 + 6;
        for (let i = 0; i + 1 < coords.length; i++) {
          const ax = (coords[i][0] - lon) * kx;
          const ay = (coords[i][1] - lat) * 111320;
          const dx = (coords[i + 1][0] - coords[i][0]) * kx;
          const dy = (coords[i + 1][1] - coords[i][1]) * 111320;
          const len2 = dx * dx + dy * dy;
          const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
          if (Math.hypot(ax + t * dx, ay + t * dy) <= limit) return true;
        }
        return false;
      });
      if (near) pr.col = 'white';
    }
  }

  private merge(polys: Poly[], lines: Line[], points: Pt[]) {
    for (const f of polys) this.polys.set(String(f.id), f);
    for (const f of lines) this.lines.set(String(f.id), f);
    this.whitenRunwayLights(points);
    for (const f of points) this.points.set(String(f.id), f);
    this.setData('ap3d-poly', emptyFc([...this.polys.values()]));
    this.setData('ap3d-line', emptyFc([...this.lines.values()]));
    this.setData('ap3d-pt', emptyFc([...this.points.values()]));
  }

  /** Lights of a box whose layout is loaded – many nodes, optional. */
  private loadDetails(b: Bounds) {
    if (!this.covered.some((c) => contains(c, b))) return;
    if (this.map.getZoom() >= LIGHT_ZOOM && !this.lightsCovered.some((c) => contains(c, b))) {
      loadAirportLights(b)
        .then((lights) => {
          this.lightsCovered.push(b);
          this.merge([], [], lights);
        })
        .catch((e) => {
          if (!isSuperseded(e)) console.warn('Overpass airport3d lights', e);
        });
    }
  }

  /** The visible map box on the request grid. */
  private viewBox(): Bounds {
    const v = this.map.getBounds();
    const snap = (x: number, f: (n: number) => number) => f(x / GRID) * GRID;
    return { west: snap(v.getWest(), Math.floor), south: snap(v.getSouth(), Math.floor), east: snap(v.getEast(), Math.ceil), north: snap(v.getNorth(), Math.ceil) };
  }

  private summary() {
    const n = this.lines.size + this.polys.size;
    this.hooks.info({
      loading: this.loading,
      count: n || undefined,
      note: n ? 'Rollwege, Gates und Befeuerung – zum Kippen Strg + Ziehen' : 'hier kein Flughafen in OpenStreetMap erfasst',
    });
  }

  /** Is this aircraft drawn as 3D model (so the 2D icon should disappear)? */
  owns(hex: string) {
    return this.mode() === '3d' && this.tracker.planes.has(hex);
  }

  /** Fresh aircraft positions from the data source. */
  feed(fc: AircraftResult) {
    if (!this.planesOn) return;
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
        props: p,
      });
    }
    this.tracker.feed(reports, performance.now());
    if (this.mode() !== 'off') this.map.triggerRepaint();
  }

  private updateLabels(planes: PlaneState[]) {
    const features: Feature<Point>[] = planes.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.dLon, p.dLat] },
      properties: { ...p.props, altM: Math.round(p.dAlt), track: Math.round(p.dTrack), callsign: String(p.props.callsign ?? ''), icao: String(p.props.icao ?? '') },
    }));
    this.setData('ap3d-label', emptyFc(features));
  }

  /** The aircraft whose trail is drawn at full strength (null: none). */
  select(hex: string | null) {
    if (hex === this.layer.selected) return;
    this.layer.selected = hex;
    if (hex) void this.fetchRoute(hex);
    this.map.triggerRepaint();
  }

  /** hex → route of the aircraft (null: unknown / not plausible, missing: still loading) */
  private routes = new Map<string, FlightRoute | null>();

  route(hex: string): FlightRoute | null | undefined {
    return this.routes.get(hex);
  }

  /** Route of the selected aircraft by its callsign (adsbdb) → grey dashed line to the airports. */
  private async fetchRoute(hex: string) {
    const p = this.tracker.planes.get(hex);
    const known = this.routes.get(hex);
    if (known !== undefined) {
      this.applyRoute(hex, known);
      return;
    }
    const found = await loadRoute(String(p?.props.callsign ?? ''));
    const now = this.tracker.planes.get(hex);
    // the callsign of the route must still fit the aircraft's position
    const route = found && now && plausible(found, now.dLon, now.dLat) ? found : null;
    this.routes.set(hex, route);
    this.applyRoute(hex, route);
  }

  private applyRoute(hex: string, route: FlightRoute | null) {
    if (this.layer.selected !== hex) return;
    this.layer.setRoute(hex, route ? { origin: [route.origin.lon, route.origin.lat], destination: [route.destination.lon, route.destination.lat] } : null);
  }

  /** Displayed state of an aircraft (smoothed position, trail), if it is tracked. */
  planeInfo(hex: string) {
    const p = this.tracker.planes.get(hex);
    return p ? { lon: p.dLon, lat: p.dLat, altM: p.dAlt, track: p.dTrack, trail: p.trail } : null;
  }

  /** The aircraft under a screen point (model, trail or wall), if any. */
  pick(x: number, y: number): string | null {
    return this.layer.pick(x, y);
  }

  /** Fit the map to the trail of an aircraft. */
  fitTrail(hex: string) {
    const p = this.tracker.planes.get(hex);
    if (!p) return;
    const pts = [...p.trail, [p.dLon, p.dLat]];
    const w = Math.min(...pts.map((t) => t[0]));
    const e = Math.max(...pts.map((t) => t[0]));
    const s = Math.min(...pts.map((t) => t[1]));
    const n = Math.max(...pts.map((t) => t[1]));
    this.map.fitBounds([[w, s], [e, n]], { padding: { top: 80, bottom: 80, left: 60, right: 400 }, maxZoom: 14, duration: 800 });
  }

  private setData(id: string, data: FeatureCollection) {
    (this.map.getSource(id) as GeoJSONSource | undefined)?.setData(data);
  }
}
