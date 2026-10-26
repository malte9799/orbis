import type { GeoJSONSource, LayerSpecification, Map as MlMap, MapGeoJSONFeature } from 'maplibre-gl';
import type { FeatureCollection, Point } from 'geojson';
import { DEM_NATIVE_ZOOM, DEM_TILES, registerDemTiles } from './demhd';
import type { FlightRoute } from '../api/route';
import {
  type Launch,
  type Ship,
} from '../api/transport';
import { fmt } from '../util';
import { registerSilhouettes, type GlyphId } from './icons';
import { alprTileProps } from './layers/shared/cams';
import { shipsApi } from './layers/shared/ships';
import { vehiclesApi } from './layers/shared/vehicles';
import { launchesApi } from './layers/defs/launches';
import { airApi } from './layers/shared/air';
import { lightningApi } from './layers/defs/lightning';
import { CLICK_HANDLERS, EXTRAS, LAYERS, type ExtraCtx, type ExtraId, type ExtraInfo } from './layers';
import { cardHtml } from './popup';

// Additional map content beyond weather: European measurements, live air/space traffic and
// infrastructure. Every source is free and keyless.

export type { ExtraDef, ExtraId, SectionId } from './layers';
export { EXTRAS, EXTRA_CLICK_LAYERS, SECTIONS } from './layers';

export type ClickResult =
  | { type: 'html'; html: string; lng: number; lat: number; after?: (node: HTMLElement) => void }
  | { type: 'weather'; lng: number; lat: number }
  /** an aircraft was clicked: the flight panel shows it */
  | { type: 'flight'; hex: string; lng: number; lat: number }
  /** a ship was clicked: the ship panel shows it */
  | { type: 'ship'; mmsi: number; lng: number; lat: number }
  /** a radiosonde was clicked: the sonde panel shows it */
  | { type: 'sonde'; serial: string; lng: number; lat: number };

/** What the ship panel shows about one vessel. */
export interface ShipInfo {
  ship: Ship;
  /** values of the reports seen so far, for the graph of a clicked tile */
  history: { speed: number[]; track: number[] };
  /** displayed position */
  lon: number;
  lat: number;
}

/** What the flight panel shows about one aircraft. */
export interface FlightInfo {
  hex: string;
  callsign: string;
  reg: string;
  type: string;
  icao: string;
  operator: string;
  altM: number;
  speedKmh: number | null;
  track: number;
  ground: boolean;
  emergency: string;
  squawk: string;
  vsMs: number | null;
  /** military according to the readsb aircraft database */
  mil: boolean;
  /** navigation integrity / position accuracy the aircraft reports (ADS-B NIC, NACp) */
  nic: number | null;
  nacp: number | null;
  lon: number;
  lat: number;
  source: string;
  /** departure / destination (adsbdb); null: unknown, undefined: still loading */
  route?: FlightRoute | null;
  /** values of the reports seen so far, for the graph of a clicked tile */
  history?: { alt: number[]; speed: number[]; vs: number[]; track: number[] };
}

/** What the sonde panel shows about one radiosonde (SondeHub telemetry). */
export interface SondeInfo {
  serial: string;
  type: string;
  subtype: string;
  manufacturer: string;
  altM: number;
  vsMs: number | null;
  speedKmh: number | null;
  track: number | null;
  frequency: number | null;
  frame: number | null;
  datetime: string;
  timeReceived: string;
  uploader: string;
  antenna: string;
  software: string;
  url: string;
  lon: number;
  lat: number;
  /** values of the reports seen so far, for the graph of a clicked tile */
  history?: { alt: number[]; speed: number[]; vs: number[]; track: number[] };
}

type Info = ExtraInfo;

const empty = (): FeatureCollection => ({ type: 'FeatureCollection', features: [] });

/** paint properties that control the opacity of a map layer, by layer type */
const OPACITY_PROPS: Record<string, string[]> = {
  raster: ['raster-opacity'],
  fill: ['fill-opacity'],
  line: ['line-opacity'],
  circle: ['circle-opacity', 'circle-stroke-opacity'],
  symbol: ['icon-opacity', 'text-opacity'],
  heatmap: ['heatmap-opacity'],
  'fill-extrusion': ['fill-extrusion-opacity'],
};

export class ExtraLayers {
  private opacity: Partial<Record<ExtraId, number>> = {};
  private baseOpacity = new Map<string, unknown>();
  private on = new Set<ExtraId>();
  private info: Partial<Record<ExtraId, Info>> = {};
  private timers: Partial<Record<string, number>> = {};
  private ready = false;

  private layerState = new Map<string, unknown>();
  /** what the layer modules (globe/layers/defs) get to work with */
  private ctx: ExtraCtx;

  constructor(
    private map: MlMap,
    private hooks: { changed(): void; toast(msg: string): void; openLaunch?: (l: Launch, lng: number, lat: number) => void },
  ) {
    const self = this;
    this.ctx = {
      map,
      hidden: { visibility: 'none' },
      add: (layer, before) => {
        if (!map.getLayer(layer.id)) map.addLayer(layer, before && map.getLayer(before) ? before : undefined);
      },
      setData: (source, data) => this.setData(source, data),
      loadOnce: (id, maxAge, fn) => this.loadOnce(id, maxAge, fn),
      state: (key, init) => {
        if (!this.layerState.has(key)) this.layerState.set(key, init());
        return this.layerState.get(key) as ReturnType<typeof init>;
      },
      viewBounds: (step) => this.viewBounds(step),
      set: (id, info) => this.set(id, info),
      info: (id) => this.info[id],
      isOn: (id) => this.on.has(id),
      vis: (layer, on) => this.vis(layer, on),
      every: (key, ms, fn) => this.every(key, ms, fn),
      clear: (key) => this.clear(key),
      toast: (msg) => this.hooks.toast(msg),
      registerLayers: (id, layers) => {
        LAYERS[id].push(...layers);
        this.apply();
      },
      get ready() {
        return self.ready;
      },
      get openLaunch() {
        return hooks.openLaunch;
      },
    };
  }

  /** Adds runtime sources/layers; call once after the style has loaded. */
  init() {
    const m = this.map;
    registerSilhouettes(m);
    const hidden = { visibility: 'none' as const };
    const add = (layer: LayerSpecification, before?: string) => {
      if (!m.getLayer(layer.id)) m.addLayer(layer, before && m.getLayer(before) ? before : undefined);
    };
    // earth observation & geology (raster overlays, below labels)
    // 3D-Höhenmodell (hybrid: Mapterhorn + AWS über ein eigenes Protokoll) – dient nur der
    // Anpassung der echten Höhen (Gebirge, 3D-Flugzeuge/Sonden/Boote), wird nie als Ebene gezeichnet
    registerDemTiles();
    if (!m.getSource('terrain-dem')) {
      m.addSource('terrain-dem', {
        type: 'raster-dem',
        tiles: [DEM_TILES],
        tileSize: 512,
        maxzoom: DEM_NATIVE_ZOOM,
        encoding: 'terrarium',
        // Lizenzpflichten der Quellen: die verlinkten Seiten führen die komplette Modell-Liste
        // (mapterhorn.com/attribution; docs/attribution.md für die AWS/tilezen-Fallbacks)
        attribution:
          'Gelände: <a href="https://mapterhorn.com/attribution/">Mapterhorn</a>, ' +
          '<a href="https://registry.opendata.aws/terrain-tiles/">AWS Terrain Tiles</a>',
      });
    }
    // layers that live in their own module (globe/layers/defs)
    for (const def of EXTRAS) {
      for (const [id, attribution] of Object.entries(def.sources ?? {})) if (!m.getSource(id)) m.addSource(id, { type: 'geojson', data: empty(), attribution });
      for (const r of def.rasters ?? []) {
        const { id, tiles, attribution, maxzoom, opacity, ...rest } = r;
        if (!m.getSource(id)) m.addSource(id, { type: 'raster', tiles, tileSize: 256, maxzoom, attribution, ...rest });
        add({ id, type: 'raster', source: id, layout: hidden, paint: { 'raster-opacity': opacity } }, 'lbl-border-country');
      }
      def.addLayers?.(this.ctx);
    }
    this.ready = true;
    this.apply();
  }

  isOn(id: ExtraId) {
    return this.on.has(id);
  }

  /** 3D-Gelände: echtes Höhenmodell an/aus – gezeichnet wird nie etwas davon (keine eigene Ebene) */
  setTerrain(on: boolean) {
    const has = !!this.map.getTerrain();
    if (on && !has) this.map.setTerrain({ source: 'terrain-dem', exaggeration: 1.4 });
    else if (!on && has) this.map.setTerrain(null);
  }

  setEnabled(ids: ExtraId[]) {
    this.on = new Set(ids);
    if (this.ready) this.apply();
  }

  toggle(id: ExtraId, on: boolean) {
    if (on) this.on.add(id);
    else this.on.delete(id);
    if (this.ready) this.apply();
  }

  /** Opacity of a layer in percent (100 = as designed); scales the original paint value of its map layers. */
  setOpacity(id: ExtraId, percent: number) {
    const f = Math.max(0.05, Math.min(1, percent / 100));
    if ((this.opacity[id] ?? 1) === f) return;
    this.opacity[id] = f;
    this.applyOpacity(id);
  }

  private applyOpacity(id: ExtraId) {
    const f = this.opacity[id] ?? 1;
    for (const lid of LAYERS[id]) {
      const type = this.map.getLayer(lid)?.type;
      const props = type ? OPACITY_PROPS[type] : undefined;
      if (!props) continue;
      for (const prop of props) {
        const key = `${lid}.${prop}`;
        if (!this.baseOpacity.has(key)) this.baseOpacity.set(key, this.map.getPaintProperty(lid, prop as never));
        const base = this.baseOpacity.get(key);
        let next: unknown;
        if (f === 1) next = base;
        else if (base == null) next = f;
        else if (typeof base === 'number') next = base * f;
        // expressions that depend on the zoom must stay a top-level interpolate/step – leave those alone
        else if (Array.isArray(base) && !JSON.stringify(base).includes('"zoom"')) next = ['*', f, base];
        else continue;
        this.map.setPaintProperty(lid, prop as never, next as never);
      }
    }
  }

  /** Badge text in the panel: count, '…' while loading or empty. */
  badge(id: ExtraId): string {
    const i = this.info[id];
    if (!this.on.has(id) || !i) return '';
    if (i.loading) return '…';
    return i.count != null ? fmt.num(i.count) : '';
  }

  /** Number of loaded features (undefined while off or not loaded). */
  count(id: ExtraId): number | undefined {
    return this.on.has(id) ? this.info[id]?.count : undefined;
  }

  note(id: ExtraId): string | undefined {
    return this.on.has(id) ? this.info[id]?.note : undefined;
  }

  /** Stream delay of the live lightning feed in seconds (undefined while unknown). */
  lightningDelay(): number | undefined {
    return lightningApi.delay(this.ctx);
  }

  /** Current data of an aircraft for the flight panel (smoothed position if it is tracked in 3D). */
  flightInfo(hex: string): FlightInfo | null {
    return airApi.flightInfo(this.ctx, hex);
  }

  /** Aircraft under a screen point: the model, its trail or the wall below the trail. */
  pickFlight(x: number, y: number): string | null {
    return airApi.pickFlight(this.ctx, x, y);
  }

  /** Highlight the trail of an aircraft (null: none). */
  selectFlight(hex: string | null) {
    airApi.selectFlight(this.ctx, hex);
  }

  /** Zoom the map to the whole trail of an aircraft. */
  fitFlight(hex: string) {
    airApi.fitFlight(this.ctx, hex);
  }

  /** Current data of a radiosonde for the sonde panel (smoothed position if it is tracked in 3D). */
  sondeInfo(serial: string): SondeInfo | null {
    return airApi.sondeInfo(this.ctx, serial);
  }

  /** Highlight the ascent trail of a radiosonde (null: none). */
  selectSonde(serial: string | null) {
    airApi.selectSonde(this.ctx, serial);
  }

  /** Zoom the map to the whole ascent of a radiosonde. */
  fitSonde(serial: string) {
    airApi.fitSonde(this.ctx, serial);
  }

  /** True while the 3D ship models are drawn: the 2D icons are not clickable then (see pickShip). */
  ships3dActive() {
    return shipsApi.active(this.ctx);
  }

  /** The 3D ship model under a screen point as a click result (popup), if any. */
  pickShip(x: number, y: number, at: { lng: number; lat: number }): ClickResult | null {
    const feature = shipsApi.pick(this.ctx, x, y);
    return feature ? this.click(feature, at) : null;
  }

  /** True while the 3D vehicle models are drawn: the 2D dots are not clickable then (see pickVehicle). */
  vehicles3dActive() {
    return vehiclesApi.active(this.ctx);
  }

  /** The 3D vehicle model under a screen point as a click result (popup), if any. */
  pickVehicle(x: number, y: number, at: { lng: number; lat: number }): ClickResult | null {
    const feature = vehiclesApi.pick(this.ctx, x, y);
    return feature ? this.click(feature, at) : null;
  }

  /** Current data of a ship for the ship panel. */
  shipInfo(mmsi: number): ShipInfo | null {
    return shipsApi.info(this.ctx, mmsi);
  }

  /** The map layers of a layer entry (for the draw order), in their style order. */
  layerIds(id: ExtraId): string[] {
    return LAYERS[id] ?? [];
  }

  /** Unteroptionen von "Blitze Live": Ton (mit Lautstärke), Einschlagskreis, Detektoren, Donner. */
  setLightningOptions(o: Parameters<typeof lightningApi.setOptions>[1]) {
    lightningApi.setOptions(this.ctx, o);
  }

  stop() {
    for (const t of Object.values(this.timers)) clearInterval(t);
    this.timers = {};
  }

  resume() {
    if (this.ready) this.apply();
  }

  /** Simulated live track of the rocket followed in the launch panel (null: hide it). */
  setLaunchLive(data: { line: FeatureCollection; pos: FeatureCollection } | null) {
    launchesApi.setLive(this.ctx, data);
  }

  /** Called after the map stopped moving. */
  onMoveEnd() {
    for (const def of EXTRAS) if (def.onMoveEnd && this.on.has(def.id)) def.onMoveEnd(this.ctx);
  }

  // -------------------------------------------------------------------------

  private set(id: ExtraId, i: Info) {
    this.info[id] = { ...this.info[id], ...i };
    this.hooks.changed();
  }

  private setData(source: string, data: FeatureCollection) {
    (this.map.getSource(source) as GeoJSONSource | undefined)?.setData(data);
  }

  private vis(layer: string, on: boolean) {
    if (this.map.getLayer(layer)) this.map.setLayoutProperty(layer, 'visibility', on ? 'visible' : 'none');
  }

  private every(key: string, ms: number, fn: () => void) {
    if (this.timers[key]) return;
    this.timers[key] = window.setInterval(() => {
      if (!document.hidden) fn();
    }, ms);
  }

  private clear(key: string) {
    clearInterval(this.timers[key]);
    delete this.timers[key];
  }

  /** Bring layers, timers and data in line with the enabled set. */
  private apply() {
    const visible = new Set<string>();
    for (const id of this.on) LAYERS[id].forEach((l) => visible.add(l));
    for (const l of new Set(Object.values(LAYERS).flat())) this.vis(l, visible.has(l));
    // layers that were added lazily pick up the chosen opacity now
    for (const id of this.on) if ((this.opacity[id] ?? 1) !== 1) this.applyOpacity(id);

    for (const def of EXTRAS) {
      def.apply?.(this.ctx);
      const on = this.on.has(def.id);
      if (!on) {
        this.clear(def.id);
        def.disable?.(this.ctx);
        continue;
      }
      def.enable?.(this.ctx);
    }
  }

  /** Load once (or again after `maxAge`), then refresh every `maxAge` while enabled. */
  private loadOnce(id: ExtraId, maxAge: number, fn: () => Promise<Partial<Info> | void>) {
    const run = () => {
      if (this.info[id]?.loading) return;
      this.set(id, { loading: true });
      fn()
        .then((r) => this.set(id, { loading: false, at: Date.now(), ...(r ?? {}) }))
        .catch((e) => {
          console.warn(id, e);
          this.set(id, { loading: false, at: Date.now(), note: 'Quelle nicht erreichbar' });
          this.hooks.toast(`${EXTRAS.find((d) => d.id === id)!.label}: Daten konnten nicht geladen werden.`);
        });
    };
    const at = this.info[id]?.at ?? 0;
    if (Date.now() - at > maxAge || !at) run();
    if (Number.isFinite(maxAge)) this.every(id, maxAge, run);
  }

  private viewBounds(step = 20) {
    const b = this.map.getBounds();
    const snap = (v: number, f: (x: number) => number) => f(v * step) / step;
    return {
      west: snap(b.getWest(), Math.floor),
      south: snap(b.getSouth(), Math.floor),
      east: snap(b.getEast(), Math.ceil),
      north: snap(b.getNorth(), Math.ceil),
    };
  }

  // -------------------------------------------------------------------------
  // Clicks

  click(f: MapGeoJSONFeature, at: { lng: number; lat: number }): ClickResult | null {
    const pt = f.geometry.type === 'Point' ? (f.geometry as Point).coordinates : [at.lng, at.lat];
    const tileCam = f.layer.id.startsWith('alpr-dots-');
    const p = (tileCam ? alprTileProps(f.properties, pt[0], pt[1]) : f.properties) as Record<string, unknown>;
    const html = (glyph: GlyphId, color: string, extra?: string) =>
      cardHtml({ glyph, color, title: p.title, subtitle: p.subtitle, date: p.date, description: p.description, source: p.source, url: p.url, extra });
    const handler = CLICK_HANDLERS.get(tileCam ? 'alpr' : f.layer.id);
    if (handler) return handler({ ctx: this.ctx, layerId: f.layer.id, p, pt, at, html });
    return null;
  }

  clearSelection() {
    this.setData('sat-track', empty());
  }
}
