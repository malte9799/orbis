import type { ExpressionSpecification, GeoJSONSource, LayerSpecification, Map as MlMap, MapGeoJSONFeature, RasterTileSource } from 'maplibre-gl';
import type { Feature, FeatureCollection, Point } from 'geojson';
import { loadOsmPower, loadPowerPlants, type PowerCat } from '../api/infra';
import { staticAirports } from '../api/airport';
import { ShipsLayer } from './ships3d';
import { VehiclesLayer } from './vehicles3d';
import { DEM_NATIVE_ZOOM, DEM_TILES, registerDemTiles } from './demhd';
import type { FlightRoute } from '../api/route';
import { AC_ALL_PAUSED, groundTrack, loadAircraft, loadAircraftByHex, loadGlobalAircraft, loadSatellites, loadSatGroup, loadSondes, satelliteFeatures, satPopupInfo, type AircraftResult, type Sat } from '../api/tracking';
import { ALPR_SOURCE_LAYER, ALPR_TILES_CA, ALPR_TILES_US, hasWindyKey, loadAlpr, loadDigitrafficCams, loadOsmWebcams, loadSpeedcams, loadWindyWebcams } from '../api/cams';
import { LightningStream, LIGHTNING_LINES_MS, LIGHTNING_THUNDER_MS } from '../api/lightning';
import { loadPorts } from '../api/ports';
import { loadRivers, loadWaves } from '../api/ocean';
import {
  AisStream,
  hasAisLive,
  loadAirportFlights,
  loadDigitrafficShips,
  loadTrainDetails,
  loadTrains,
  shipFeatures,
  type Launch,
  type Ship,
} from '../api/transport';
import { loadAmtrak, loadSegments, modeStyle, positionsAt, RAIL_MODES, type Segment } from '../api/transit';
import { feedsInView, vehicleFeatures } from '../api/vehicles';
import { camFeedsInView, SNAPSHOT_CAMS } from '../api/camfeeds';
import { snapshotJson } from '../api/data';
import { isSuperseded } from '../api/overpass';
import { escapeHtml, fmt, safeUrl } from '../util';
import { registerSilhouettes, type GlyphId } from './icons';
import { CLICK_HANDLERS, EXTRAS, LAYERS, type ExtraCtx, type ExtraId, type ExtraInfo } from './layers';
import { JMA_RADAR_TILES } from './layers/shared/tiles';
import { AIRPORT_FAR } from './layers/defs/airports';
import { cardHtml } from './popup';
import { AIRPORT_ZOOM, Airport3D } from './airport3d';
import { FONT_BOLD, FONT_REGULAR } from './vector';

// Additional map content beyond weather: European measurements, live air/space traffic and
// infrastructure. Every source is free and keyless.

export type { ExtraDef, ExtraId, SectionId } from './layers';
export { EXTRAS, EXTRA_CLICK_LAYERS, SECTIONS } from './layers';


/** which power-plant categories each extra shows – all extras share the same point layers */
const POWER_CATS: Partial<Record<ExtraId, PowerCat[]>> = {
  wind: ['wind'],
  solar: ['solar'],
  water: ['hydro'],
  nuclear: ['nuclear'],
  coal: ['coal'],
  gas: ['gas'],
  oil: ['oil'],
  biomass: ['biomass'],
  plants: ['other'],
};
const POWER_EXTRAS = Object.keys(POWER_CATS) as ExtraId[];


/** Zoom from which cameras are loaded for the visible area (Overpass). */
const CAM_DETAIL_ZOOM = 9;
/** camera dots appear from this zoom on; below it the heatmap shows the distribution */
const CAM_DOT_ZOOM = 6;
const CAM_COLOR = '#00bfa5';
const CAM_ZOOM_RED = '#e53935';
const ALPR_RED = '#ef4444';
const CARDINAL = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
const ALPR_ZONE: Record<string, string> = { traffic: 'Verkehr', parking: 'Parkplatz', town: 'Ortschaft', building: 'Gebäude', public: 'Öffentlich', shop: 'Geschäft' };
const ALPR_MOUNT: Record<string, string> = { pole: 'Mast', wall: 'Wand', street_lamp: 'Laterne', ceiling: 'Decke', bridge: 'Brücke', traffic_signals: 'Ampel', building: 'Gebäude' };

/** Stock photo per vendor (DeFlock CDN, first image of each LPR vendor), matched on the manufacturer tag. */
const ALPR_VENDOR_IMG: [RegExp, string][] = [
  [/flock/i, 'flock/flock-1.jpg'],
  [/motorola|vigilant/i, 'motorola/motorola-1.jpg'],
  [/genetec/i, 'genetec/genetec-1.webp'],
  [/leonardo|elsag/i, 'leonardo/elsag-1.jpg'],
  [/neology/i, 'neology/neology-1.jpg'],
  [/axon/i, 'axon/axon-1.webp'],
  [/verkada/i, 'verkada/verkada_bullet_cropped.png'],
];
const alprVendorImg = (brand: string) => {
  const hit = ALPR_VENDOR_IMG.find(([re]) => re.test(brand));
  return hit ? `https://cdn.deflock.me/vendors/${hit[1]}` : '';
};

/** Properties of an overview-tile camera in the shape of the live (Overpass) ones. */
function alprTileProps(t: Record<string, unknown> | null, lon: number, lat: number): Record<string, unknown> {
  const brand = String(t?.brand ?? '');
  const flock = /flock/i.test(brand);
  const dir = Number(t?.direction);
  return {
    title: flock ? 'Flock-Kamera (ALPR)' : 'Kennzeichenerfassung (ALPR)',
    subtitle: [brand, t?.operator].filter(Boolean).join(' · '),
    flock,
    dir: t?.direction != null && t.direction !== '' && Number.isFinite(dir) ? dir : -1,
    mount: t?.mountType ?? '',
    operator: t?.operator ?? '',
    brand,
    zone: t?.surveillanceZone ?? '',
    since: t?.startDate ?? '',
    ref: t?.ref ?? '',
    url: t?.osmId ? `https://www.openstreetmap.org/${t.osmType ?? 'node'}/${t.osmId}` : undefined,
    deflock: `https://maps.deflock.org/?lat=${lat.toFixed(5)}&lng=${lon.toFixed(5)}&zoom=17`,
  };
}
const ALPR_FOV_ZOOM = 12; // sectors are drawn from here on
const ALPR_FOV_RADIUS = 80; // metres
const ALPR_FOV_ANGLE = 60; // degrees
const CAM_FOV_RADIUS = 80; // metres
const CAM_FOV_ANGLE = 60; // degrees

/** Sector polygons on the ground (metres → degrees), one per [lon, lat, heading]. */
function fovSectors(cams: [number, number, number][], radius: number, angle: number): Feature[] {
  return cams.map(([lon, lat, dir]) => {
    const kx = 111320 * Math.cos((lat * Math.PI) / 180);
    const ring: [number, number][] = [[lon, lat]];
    for (let i = 0; i <= 12; i++) {
      const a = ((dir - angle / 2 + (angle * i) / 12) * Math.PI) / 180;
      ring.push([lon + (Math.sin(a) * radius) / kx, lat + (Math.cos(a) * radius) / 111320]);
    }
    ring.push([lon, lat]);
    return { type: 'Feature' as const, geometry: { type: 'Polygon' as const, coordinates: [ring] }, properties: {} };
  });
}

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

/** Geographic circle radius in screen px: px = km · (1000 / 156543.03392) · 2^zoom / cos(lat).
 *  Interpolation stops every second zoom keep the exponential(2) curve exact over the whole
 *  zoom range, so a km-based circle stays the same size on the map while zooming. A small
 *  minimum radius keeps fresh and far-zoomed circles visible at all – it sits inside every
 *  stop, because the zoom interpolate has to stay top-level for the style spec. */
const thunderRadius: ExpressionSpecification = (() => {
  const A = 1000 / 156543.03392;
  const cos = ['cos', ['/', ['*', ['get', 'lat'], 3.141592653589793], 180]] as unknown as ExpressionSpecification;
  const stops: unknown[] = [];
  for (let z = 0; z <= 12; z += 2) stops.push(z, ['max', 10, ['/', ['*', A * 2 ** z, ['get', 'km']], cos]]);
  return ['interpolate', ['exponential', 2], ['zoom'], ...stops] as ExpressionSpecification;
})();

const ALT_COLOR: ExpressionSpecification = [
  'case',
  ['get', 'ground'],
  '#9aa3b5',
  ['interpolate', ['linear'], ['get', 'altM'], 0, '#ffd23f', 3000, '#7bd389', 8000, '#4fc3f7', 12000, '#b388ff'],
];

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
  private sats: Sat[] = [];
  private starlink: Sat[] = [];
  private satsLoading: Promise<void> | null = null;
  private starlinkLoading: Promise<void> | null = null;
  private powerLoaded = false;
  private powerLoading: Promise<void> | null = null;
  private powerCounts: Record<PowerCat, number> = { wind: 0, solar: 0, hydro: 0, nuclear: 0, coal: 0, gas: 0, oil: 0, biomass: 0, other: 0 };
  private osmPowerKey = '';
  private aircraftSeq = 0;
  private aircraftBusy = false;
  private aircraftAgain = false;
  private aircraftAt = 0;
  private aircraftDelay: number | undefined;
  private aircraftErr = '';
  private airport3d: Airport3D | null = null;
  private lastAircraft: AircraftResult | null = null;
  /** latest radiosonde data (SondeHub) – also drives the 3D balloon models */
  private lastSondes: FeatureCollection<Point> | null = null;
  /** when the sondes were last fed into the 3D tracker / whether they are in there now */
  private lastSondesFed = 0;
  private sondes3D = false;
  /** helicopters of the 2D icons (their rotor blades are drawn as an own, turning layer) */
  private heliFeatures: Feature<Point>[] = [];
  private rotorShown = false;
  private ready = false;
  private fiCams: FeatureCollection = empty();
  private windyCams: FeatureCollection = empty();
  private camFeeds = new Map<string, { at: number; features: Feature<Point>[] }>();
  private camFeedLoading = new Set<string>();
  private camFeedErrors = new Set<string>();
  private camKey = '';
  private osmCamCount = 0;
  private windyKey = '';
  private alprKey = '';
  private webcamHeatAdded = false;
  private webcamHeatLoaded = false;
  private alprTilesAdded = false;
  private alprTilesFailed = false;
  private alprLive: Feature[] = [];
  private alprFovKey = '';
  private osmCamFc: FeatureCollection<Point> | null = null;
  private camFovKey = '';
  private blitzerKey = '';
  private baltic: Ship[] = [];
  private segs: Segment[] = [];
  private segKey = '';
  private segAt = 0;
  private segLoading = false;
  private gpsTrains: FeatureCollection = empty();
  private feedVeh = new Map<string, { at: number; features: Feature<Point>[] }>();
  private feedLoading = new Set<string>();
  private feedErrors = new Set<string>();
  private ais: AisStream | null = null;
  private ships3d?: ShipsLayer;
  private vehicles3d?: VehiclesLayer;
  private shipsAll = new Map<number, Ship>();
  private lightning: LightningStream | null = null;
  /** Unteroptionen von "Blitze": Ton, Einschlagskreis, Detektoren + Linien */
  private lightningOpts = { sound: false, wave: false, detectors: false, lines: false, thunder: false, volume: 70 };
  /** detector stations already pushed to the map source */
  private lightningStationsPushed = -1;
  /** strike wave / detector lines idle? (empty data pushed once, then the fast timer stops) */
  private lightningIdle = true;
  private lightningAudio: AudioContext | null = null;
  private lightningLastTick = 0;

  private layerState = new Map<string, unknown>();
  /** what the layer modules (globe/layers/defs) get to work with */
  private ctx: ExtraCtx;

  constructor(
    private map: MlMap,
    private hooks: { changed(): void; toast(msg: string): void; openLaunch?: (l: Launch, lng: number, lat: number) => void },
  ) {
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
      get openLaunch() {
        return hooks.openLaunch;
      },
    };
  }

  /** Adds runtime sources/layers; call once after the style has loaded. */
  init() {
    const m = this.map;
    registerSilhouettes(m);
    const ATTR: Record<string, string> = {
      power: 'Kraftwerke: <a href="https://datasets.wri.org/dataset/globalpowerplantdatabase">WRI GPPD, CC BY 4.0</a>',
      aircraft: 'Flugdaten: <a href="https://adsb.lol/">adsb.lol</a> (ODbL), <a href="https://adsb.fi/">adsb.fi</a>, <a href="https://opensky-network.org/">OpenSky</a>',
      sondes: 'Radiosonden: <a href="https://sondehub.org/">SondeHub</a>',
      sats: 'Bahndaten: <a href="https://celestrak.org/">CelesTrak</a>',
      webcams: 'Webcams: <a href="https://www.windy.com/webcams">Windy</a>, <a href="https://www.digitraffic.fi/">Digitraffic</a> (CC BY 4.0), <a href="https://www.vegagerdin.is/vegagerdin/gagnasafn/vefthjonustur/vefmyndavelar">Vegagerðin</a>, <a href="https://data.calgary.ca">Calgary</a>, <a href="https://www.drivebc.ca">DriveBC</a> (OGL), <a href="https://opendata.transport.nsw.gov.au">TfNSW</a> (CC BY 4.0), <a href="https://www.nzta.govt.nz">NZTA</a>',
      'webcams-world': 'Kamera-Positionen (Heatmap): Aggregat der Webcam-Feeds (siehe „Webcams")',
      'webcams-osm': 'Webcams: © OpenStreetMap',
      alpr: 'ALPR: © OpenStreetMap-Mitwirkende, <a href="https://deflock.org/">DeFlock</a>',
      blitzer: 'Blitzer: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap-Mitwirkende</a> (ODbL) – Lageplan, keine Fahrwarnung',
      lightning: 'Blitze: <a href="https://www.blitzortung.org/">Blitzortung.org</a> – nicht amtlich, nur zur privaten Information, nicht für Warnzwecke',
      'lightning-thunder': 'Donner: <a href="https://www.blitzortung.org/">Blitzortung.org</a> – nicht amtlich, nur zur privaten Information, nicht für Warnzwecke',
      'launch-live': 'Raketenstarts: <a href="https://thespacedevs.com/">The Space Devs</a>',
      ships: 'AIS: <a href="https://www.digitraffic.fi/">Fintraffic</a> (CC BY 4.0), <a href="https://aisstream.io/">aisstream.io</a>',
      trains: 'Züge & ÖPNV: <a href="https://transitous.org/">Transitous</a>, <a href="https://www.digitraffic.fi/">Fintraffic</a> (CC BY 4.0), <a href="https://amtraker.com/">Amtraker</a>, Entur (NLOD), MBTA, SEPTA, TTC (OGL – Toronto), data.gov.my (CC BY 4.0), Transport Victoria (CC BY 4.0), CTA, Trafiklab',
      ports: 'Häfen: <a href="https://msi.nga.mil/Publications/WPI">NGA World Port Index</a>, UN/LOCODE von <a href="https://opendata.upply.com/seaports">Upply</a> (CC BY 4.0)',
    };
    for (const id of ['ports', 'power', 'osm-power', 'aircraft', 'aircraft-rotor', 'sondes', 'sats', 'sat-track', 'webcams', 'webcams-world', 'webcams-osm', 'webcams-fov', 'alpr', 'alpr-fov', 'blitzer', 'lightning', 'lightning-wave', 'lightning-line', 'lightning-sta', 'lightning-thunder', 'airports-far', 'launch-live', 'launch-live-line', 'ships', 'trains', 'busnet-stops']) {      if (!m.getSource(id)) m.addSource(id, { type: 'geojson', data: empty(), attribution: ATTR[id] });
    }
    const hidden = { visibility: 'none' as const };
    const add = (layer: LayerSpecification, before?: string) => {
      if (!m.getLayer(layer.id)) m.addLayer(layer, before && m.getLayer(before) ? before : undefined);
    };
    // points: below the event icons
    add(
      {
        id: 'power',
        type: 'circle',
        source: 'power',
        filter: ['in', ['get', 'cat'], ['literal', []]],
        layout: { 'circle-sort-key': ['get', 'mw'] },
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, ['max', 1.5, ['*', 0.09, ['sqrt', ['get', 'mw']]]], 8, ['max', 3, ['*', 0.4, ['sqrt', ['get', 'mw']]]]],
          'circle-opacity': 0.85,
          'circle-stroke-color': 'rgba(0,0,0,0.45)',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 3, 0, 7, 0.8],
        },
      },
      'gauges',
    );
    add(
      {
        id: 'osm-power',
        type: 'circle',
        source: 'osm-power',
        minzoom: 10,
        filter: ['in', ['get', 'cat'], ['literal', []]],
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': ['case', ['get', 'turbine'], 3.5, 6],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1,
        },
      },
      'gauges',
    );
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
    // transport networks
    const rasterOverlay = (id: string, tiles: string[], attribution: string, maxzoom = 19, opacity = 0.9) => {
      if (!m.getSource(id)) m.addSource(id, { type: 'raster', tiles, tileSize: 256, maxzoom, attribution });
      add({ id, type: 'raster', source: id, layout: hidden, paint: { 'raster-opacity': opacity } }, 'lbl-border-country');
    };
    const orm = (style: string) => ['a', 'b', 'c'].map((sub) => `https://${sub}.tiles.openrailwaymap.org/${style}/{z}/{x}/{y}.png`);
    rasterOverlay('railspeed', orm('maxspeed'), 'Streckengeschwindigkeit: <a href="https://www.openrailwaymap.org/">OpenRailwayMap</a> (CC BY-SA)');
    rasterOverlay('railelec', orm('electrification'), 'Elektrifizierung: <a href="https://www.openrailwaymap.org/">OpenRailwayMap</a> (CC BY-SA)');
    rasterOverlay('cyclenet', ['https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png'], 'Radrouten: <a href="https://cycling.waymarkedtrails.org/">Waymarked Trails</a> (CC BY-SA)', 18, 0.95);
    rasterOverlay('hikenet', ['https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png'], 'Wanderwege: <a href="https://hiking.waymarkedtrails.org/">Waymarked Trails</a> (CC BY-SA)', 18, 0.95);
    const road = (id: string, cls: string[], minzoom: number, color: string, w: [number, number, number, number]) =>
      add(
        {
          id,
          type: 'line',
          source: 'ofm',
          'source-layer': 'transportation',
          minzoom,
          filter: ['all', ['in', ['get', 'class'], ['literal', cls]], ['!=', ['get', 'ramp'], 1]],
          layout: { ...hidden, 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': color,
            'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], w[0], w[1], w[2], w[3]],
            'line-opacity': ['case', ['==', ['get', 'brunnel'], 'tunnel'], 0.45, 0.9],
          },
        },
        'lbl-border-country',
      );
    road('road-secondary', ['secondary'], 8, '#ffe082', [8, 0.6, 14, 4]);
    road('road-primary', ['primary'], 6, '#ffb74d', [6, 0.6, 14, 5]);
    road('road-trunk', ['trunk'], 4, '#ff8a65', [4, 0.6, 14, 6]);
    road('road-motorway', ['motorway'], 3, '#e53935', [3, 0.7, 14, 7]);
    add(
      {
        id: 'road-ref',
        type: 'symbol',
        source: 'ofm',
        'source-layer': 'transportation_name',
        minzoom: 6,
        filter: ['all', ['has', 'ref'], ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary']]]],
        layout: {
          ...hidden,
          'symbol-placement': 'line',
          'symbol-spacing': 400,
          'text-field': ['get', 'ref'],
          'text-font': FONT_BOLD,
          'text-size': 10,
          'text-rotation-alignment': 'viewport',
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': ['match', ['get', 'class'], 'motorway', '#1565c0', 'trunk', '#c62828', '#ef6c00'],
          'text-halo-width': 3,
        },
      },
      'marker',
    );
    // earth & environment
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
    // live lightning: newest strikes bright yellow/white, ageing to dark red
    const strikeColor: ExpressionSpecification = ['match', ['get', 'age'], 0, '#ffffff', 1, '#ffe14d', 2, '#ff9100', '#d32f2f'];
    // expanding ring of a fresh strike (grows with "k", fades via "o"); detector lines: white,
    // only a little thicker when the capturing detector sits close to the strike
    // thunder (Unteroption "Donner"): drew the backmost lightning layer first, so it never
    // washes out the wave, lines or strike dots
    add(
      {
        id: 'lightning-thunder',
        type: 'circle',
        source: 'lightning-thunder',
        layout: hidden,
        paint: {
          'circle-color': 'rgba(255,255,255,0.24)',
          'circle-opacity': ['get', 'o'],
          // real geographic radius: screen px = km * A * 2^zoom / cos(lat) – stops every second
          // zoom make the exponential(2) interpolation exact, so the circle scales with the zoom
          'circle-radius': thunderRadius,
        },
      },
      'marker',
    );
    // detector lines (Unteroption "Linien"): line from every capturing detector to the strike (like lightningmaps.org)
    add(
      {
        id: 'lightning-line',
        type: 'line',
        source: 'lightning-line',
        layout: { ...hidden, 'line-join': 'round' },
        paint: {
          // weiß in jeder Entfernung; die Dicke kodiert sie: nah (dc 0) etwas dicker, sonst Basis.
          // Zoom-Ausdruck bleibt top-level im Interpolate (der dc-Faktor sitzt in den Stops, sonst
          // verwirft MapLibre das Paint und schaltet die Linien komplett aus)
          'line-color': '#ffffff',
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            1, ['*', ['match', ['get', 'dc'], 0, 1.3, 1, 1.1, 1], 0.6],
            8, ['*', ['match', ['get', 'dc'], 0, 1.3, 1, 1.1, 1], 1.1],
            12, ['*', ['match', ['get', 'dc'], 0, 1.3, 1, 1.1, 1], 1.6],
          ],
          'line-opacity': ['get', 'o'],
        },
      },
      'marker',
    );
    // detector stations (Unteroption "Detektoren"): small dots at every station that got
    // learned from the feed while it was enabled
    add(
      {
        id: 'lightning-sta',
        type: 'circle',
        source: 'lightning-sta',
        layout: hidden,
        paint: {
          'circle-color': 'rgba(140,190,255,0.85)',
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 1.6, 6, 3.2, 10, 5],
          'circle-stroke-color': 'rgba(15,25,45,0.75)',
          'circle-stroke-width': 1,
        },
      },
      'marker',
    );
    add(
      {
        id: 'lightning-glow',
        type: 'circle',
        source: 'lightning',
        layout: hidden,
        filter: ['==', ['get', 'age'], 0],
        paint: {
          'circle-color': 'rgba(255,230,80,0.35)',
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 5, 8, 12],
          'circle-blur': 0.8,
        },
      },
      'marker',
    );
    add(
      {
        id: 'lightning',
        type: 'circle',
        source: 'lightning',
        layout: hidden,
        paint: {
          'circle-color': strikeColor,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 1.6, 6, 3, 10, 5],
          'circle-stroke-color': 'rgba(0,0,0,0.5)',
          'circle-stroke-width': 0.5,
        },
      },
      'marker',
    );
    // strike wave (Unteroption "Einschlagskreis"): like on Blitzortung.org a fresh strike
    add(
      {
        id: 'lightning-wave',
        type: 'circle',
        source: 'lightning-wave',
        layout: hidden,
        paint: {
          'circle-color': 'rgba(255,50,50,0.28)',
          // max. Größe erst ab Zoom 3: bei Weltansicht bleiben die Kreise klein (≤ 8 px),
          // ab Zoom 3 bis 36 px und danach wie bisher weiterwachsen
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            0, ['+', 2, ['*', 6, ['get', 'k']]],
            3, ['+', 6, ['*', 30, ['get', 'k']]],
            6, ['+', 8, ['*', 96, ['get', 'k']]],
            12, ['+', 10, ['*', 180, ['get', 'k']]],
          ],
          'circle-opacity': ['get', 'o'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 1, 1.2, 8, 2.2],
          'circle-stroke-opacity': ['get', 'o'],
        },
      },
      'marker',
    );
    // transport
    const airportLayer = (id: string, minzoom: number, classes: string[], textOverlap: boolean): LayerSpecification => ({
      id,
      type: 'symbol',
      source: 'ofm',
      'source-layer': 'aerodrome_label',
      minzoom,
      filter: ['all', ['has', 'iata'], ['in', ['get', 'class'], ['literal', classes]]],
      layout: {
        ...hidden,
        'icon-image': 'glyph-airport',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 1, 0.8, 3, 1, 9, 1.3],
        'text-field': ['step', ['zoom'], '', 4, ['get', 'iata']],
        'text-font': FONT_BOLD,
        'text-size': 10,
        'text-offset': [0, 1.1],
        'text-anchor': 'top',
        'text-optional': true,
        // icons and names stay visible at medium zoom (~50 km) and are not hidden by place labels of the base map
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'text-allow-overlap': textOverlap,
      },
      paint: { 'text-color': '#cfe6ff', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1.2 },
    });
    add(airportLayer('airports', 1, ['international'], true), 'marker');
    // The map tiles only carry airports from zoom 8. The big ones (from our own airport list, by size) show up earlier:
    // the largest from zoom 5, then 6 and 7.
    AIRPORT_FAR.forEach((id, i) => {
      const spec = airportLayer(id, 5 + i, [], true);
      add({ ...spec, source: 'airports-far', 'source-layer': undefined, maxzoom: 8, filter: ['==', ['get', 'tier'], i + 1], layout: { ...spec.layout, 'text-field': ['get', 'iata'] } } as LayerSpecification, 'marker');
    });
    add(airportLayer('airports-minor', 5.5, ['public', 'regional', 'other', 'military', 'private'], false), 'marker');
    if (!m.getSource('railmap'))
      m.addSource('railmap', {
        type: 'raster',
        tiles: ['a', 'b', 'c'].map((sub) => `https://${sub}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png`),
        tileSize: 256,
        maxzoom: 19,
        attribution: 'Bahnnetz: <a href="https://www.openrailwaymap.org/">OpenRailwayMap</a> (CC BY-SA)',
      });
    add({ id: 'railmap', type: 'raster', source: 'railmap', layout: hidden, paint: { 'raster-opacity': 0.85 } }, 'lbl-border-country');
    const vehicleLayers = (id: string, label: string, filter: ExpressionSpecification) => {
      add(
        {
          id,
          type: 'circle',
          source: 'trains',
          filter,
          layout: hidden,
          paint: {
            'circle-color': ['get', 'color'],
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 2.6, 10, 5, 14, 7],
            'circle-stroke-color': ['case', ['==', ['get', 'realTime'], false], 'rgba(255,255,255,0.45)', '#ffffff'],
            'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 4, 0.8, 10, 1.5],
          },
        },
        'marker',
      );
      add(
        {
          id: label,
          type: 'symbol',
          source: 'trains',
          filter,
          minzoom: 9,
          layout: {
            ...hidden,
            'text-field': ['get', 'name'],
            'text-font': FONT_BOLD,
            'text-size': 10,
            'text-offset': [0, 1.0],
            'text-anchor': 'top',
            'text-optional': true,
          },
          paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.85)', 'text-halo-width': 1.3 },
        },
        'marker',
      );
    };
    vehicleLayers('trains', 'trains-label', ['==', ['get', 'rail'], true]);
    vehicleLayers('transit-veh', 'transit-label', ['!=', ['get', 'rail'], true]);
    // ports: the bigger, the earlier (zoom 2 / 5 / 7 / 9 / 11); a port that is not yet "due" has radius 0
    const byTier = (...v: number[]): ExpressionSpecification => ['case', ['<=', ['get', 'tier'], 1], v[0], ['<=', ['get', 'tier'], 2], v[1], ['<=', ['get', 'tier'], 3], v[2], ['<=', ['get', 'tier'], 4], v[3], v[4]];
    const dueAt = (tier: number, r: number): ExpressionSpecification => ['case', ['<=', ['get', 'tier'], tier], r, 0];
    add(
      {
        id: 'ports',
        type: 'circle',
        source: 'ports',
        layout: { ...hidden, 'circle-sort-key': ['-', 0, ['get', 'tier']] },
        paint: {
          'circle-color': '#ffb74d',
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, dueAt(1, 3.5), 4.5, dueAt(1, 5), 5, dueAt(2, 4.5), 7, dueAt(3, 4.5), 9, dueAt(4, 5), 11, byTier(7, 6.5, 6, 5.5, 5)],
          'circle-stroke-color': '#1b1200',
          'circle-stroke-width': 1,
        },
      },
      'marker',
    );
    add(
      {
        id: 'ports-label',
        type: 'symbol',
        source: 'ports',
        layout: {
          ...hidden,
          'text-field': ['step', ['zoom'], '', 5, ['case', ['<=', ['get', 'tier'], 1], ['get', 'name'], ''], 7, ['case', ['<=', ['get', 'tier'], 2], ['get', 'name'], ''], 9, ['case', ['<=', ['get', 'tier'], 3], ['get', 'name'], ''], 11, ['get', 'name']],
          'text-font': FONT_REGULAR,
          'text-size': 11,
          'text-offset': [0, 0.9],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: { 'text-color': '#ffe0b2', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1.2 },
      },
      'marker',
    );
    add(
      {
        id: 'ships',
        type: 'symbol',
        source: 'ships',
        layout: {
          ...hidden,
          'icon-image': 'sil-vessel',
          'icon-size': ['interpolate', ['linear'], ['zoom'], 3, 0.45, 8, 0.8, 12, 1.15],
          'icon-rotate': ['get', 'rot'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'text-field': ['step', ['zoom'], '', 10, ['get', 'name']],
          'text-font': FONT_REGULAR,
          'text-size': 10,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: {
          'icon-color': ['get', 'color'],
          'icon-opacity': ['case', ['get', 'moving'], 1, 0.6],
          'icon-halo-color': 'rgba(0,0,0,0.7)',
          'icon-halo-width': 1,
          'text-color': '#e0f7fa',
          'text-halo-color': 'rgba(0,0,0,0.8)',
          'text-halo-width': 1.2,
        },
      },
      'marker',
    );
    // live track of the rocket currently followed in the launch panel (trail + symbol);
    // visible only while the panel feeds data (independent of the launches toggle) –
    // the layers start hidden: 'visible' with empty data would keep the attribution
    add(
      {
        id: 'launch-live-line',
        type: 'line',
        source: 'launch-live-line',
        layout: { visibility: 'none' as const, 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#ff6e40', 'line-width': 2.2, 'line-opacity': 0.85 },
      },
      'marker',
    );
    add(
      {
        id: 'launch-live',
        type: 'symbol',
        source: 'launch-live',
        layout: {
          visibility: 'none' as const,
          'icon-image': 'glyph-rocket',
          'icon-size': 1.4,
          'icon-allow-overlap': true,
          'icon-rotate': ['get', 'rot'],
          'icon-rotation-alignment': 'map',
          'text-field': ['get', 'when'],
          'text-font': FONT_BOLD,
          'text-size': 10.5,
          'text-offset': [0, 1.5],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: { 'text-color': '#ff8a65', 'text-halo-color': 'rgba(0,0,0,0.85)', 'text-halo-width': 1.3 },
      },
      'marker',
    );
    // cameras
    const camIcon = (id: string, source: string): LayerSpecification => ({
      id,
      type: 'circle',
      source,
      minzoom: CAM_DOT_ZOOM,
      layout: hidden,
      paint: { 'circle-color': CAM_COLOR, 'circle-radius': ['interpolate', ['linear'], ['zoom'], CAM_DOT_ZOOM, 1.8, CAM_DETAIL_ZOOM, 3, 14, 6], 'circle-opacity': 0.8 },
    });
    add(camIcon('webcams', 'webcams'), 'marker');
    add(camIcon('webcams-osm', 'webcams-osm'), 'marker');
    // viewing direction of OpenStreetMap webcams (camera:direction), same sectors as the ALPR cameras
    add(
      {
        id: 'webcams-cone',
        type: 'fill',
        source: 'webcams-fov',
        layout: hidden,
        paint: { 'fill-color': CAM_COLOR, 'fill-opacity': 0.28 },
      },
      'marker',
    );
    add(
      {
        id: 'webcams-cone-line',
        type: 'line',
        source: 'webcams-fov',
        layout: hidden,
        paint: { 'line-color': CAM_COLOR, 'line-width': 1.2, 'line-opacity': 0.85 },
      },
      'marker',
    );
    add(
      {
        id: 'blitzer',
        type: 'circle',
        source: 'blitzer',
        layout: hidden,
        paint: {
          // red: fixed camera · orange: monitored stretch (average speed) · violet: red-light camera
          'circle-color': ['match', ['get', 'kind'], 'section', '#fb8c00', 'signals', '#ba68c8', CAM_ZOOM_RED],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 3, 14, 6],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 9, 0.6, 14, 1.5],
        },
      },
      'marker',
    );
    // field of view as real-size sectors (metres on the ground, so they scale with the zoom)
    add(
      {
        id: 'alpr-cone',
        type: 'fill',
        source: 'alpr-fov',
        layout: hidden,
        paint: { 'fill-color': ALPR_RED, 'fill-opacity': 0.28 },
      },
      'marker',
    );
    add(
      {
        id: 'alpr-cone-line',
        type: 'line',
        source: 'alpr-fov',
        layout: hidden,
        paint: { 'line-color': ALPR_RED, 'line-width': 1.2, 'line-opacity': 0.85 },
      },
      'marker',
    );
    add(
      {
        id: 'alpr',
        type: 'circle',
        source: 'alpr',
        layout: hidden,
        paint: {
          'circle-color': ['case', ['get', 'flock'], ALPR_RED, '#ff9800'],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 3, 14, 6],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 11, 0, 14, 1.5],
        },
      },
      'marker',
    );
    m.on('idle', () => this.updateCamFov());
    m.on('error', (ev) => {
      const e = ev as typeof ev & { sourceId?: string };
      if (e.sourceId !== 'alpr-us' && e.sourceId !== 'alpr-ca') return;
      if (!this.alprTilesFailed) console.warn('ALPR-Übersicht', e.error);
      this.alprTilesFailed = true;
      this.updateAlprNote();
    });
    // moving objects on top
    add(
      {
        id: 'sat-track',
        type: 'line',
        source: 'sat-track',
        layout: hidden,
        paint: { 'line-color': '#ffd23f', 'line-width': 1.5, 'line-dasharray': [2, 2], 'line-opacity': 0.9 },
      },
      'marker',
    );
    add(
      {
        id: 'sats-dot',
        type: 'circle',
        source: 'sats',
        filter: ['==', ['get', 'group'], 'starlink'],
        layout: hidden,
        paint: { 'circle-color': '#c7d0e8', 'circle-radius': 1.6, 'circle-opacity': 0.8 },
      },
      'marker',
    );
    add(
      {
        id: 'sats-icon',
        type: 'symbol',
        source: 'sats',
        filter: ['!=', ['get', 'group'], 'starlink'],
        layout: {
          ...hidden,
          'icon-image': 'sil-satellite',
          'icon-size': ['case', ['==', ['get', 'group'], 'stations'], 0.9, 0.55],
          'icon-allow-overlap': true,
        },
        paint: {
          'icon-color': ['match', ['get', 'group'], 'stations', '#ffd23f', 'weather', '#4fc3f7', 'gps-ops', '#7bd389', 'galileo', '#7bd389', '#d1b3ff'],
          'icon-halo-color': 'rgba(0,0,0,0.7)',
          'icon-halo-width': 1,
        },
      },
      'marker',
    );
    add(
      {
        id: 'sats-label',
        type: 'symbol',
        source: 'sats',
        filter: ['any', ['==', ['get', 'group'], 'stations'], ['==', ['get', 'group'], 'weather']],
        minzoom: 2,
        layout: {
          ...hidden,
          'text-field': ['get', 'name'],
          'text-font': FONT_REGULAR,
          'text-size': 10,
          'text-offset': [0, 1.1],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: { 'text-color': '#ffe9a8', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1.2 },
      },
      'marker',
    );
    add(
      {
        id: 'sondes',
        type: 'symbol',
        source: 'sondes',
        layout: { ...hidden, 'icon-image': 'sil-sonde', 'icon-size': 0.8, 'icon-allow-overlap': true },
        paint: { 'icon-color': '#ff8fab', 'icon-halo-color': 'rgba(0,0,0,0.7)', 'icon-halo-width': 1 },
      },
      'marker',
    );
    add(
      {
        id: 'aircraft',
        type: 'symbol',
        source: 'aircraft',
        filter: ['!=', ['get', 'kind'], 'vehicle'],
        layout: {
          ...hidden,
          'icon-image': ['concat', 'sil-', ['get', 'kind']],
          'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.9, 10, 1.3],
          'icon-rotate': ['case', ['==', ['get', 'kind'], 'balloon'], 0, ['get', 'track']],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'text-field': ['step', ['zoom'], '', 8, ['get', 'callsign']],
          'text-font': FONT_BOLD,
          'text-size': 10,
          'text-offset': [0, 1.3],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: {
          'icon-color': ['case', ['!=', ['get', 'emergency'], ''], '#ff2d55', ALT_COLOR],
          'icon-halo-color': 'rgba(0,0,0,0.75)',
          'icon-halo-width': 1,
          'text-color': '#ffffff',
          'text-halo-color': 'rgba(0,0,0,0.8)',
          'text-halo-width': 1.2,
        },
      },
      'marker',
    );
    // the rotor blades of helicopters: an own icon around the same centre, turned by a timer (see below)
    add(
      {
        id: 'aircraft-rotor',
        type: 'symbol',
        source: 'aircraft-rotor',
        layout: {
          ...hidden,
          'icon-image': 'sil-rotor',
          'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.9, 10, 1.3],
          'icon-rotate': ['get', 'rot'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: {
          'icon-color': ['case', ['!=', ['get', 'emergency'], ''], '#ff2d55', ALT_COLOR],
          'icon-halo-color': 'rgba(0,0,0,0.75)',
          'icon-halo-width': 1,
        },
      },
      'marker',
    );
    // the blades turn: the (few) helicopter positions go into their own source with a changing angle
    window.setInterval(() => {
      if (document.hidden || !this.on.has('aircraft')) return;
      if (!this.heliFeatures.length && !this.rotorShown) return;
      const rot = (performance.now() * 0.3) % 360;
      this.rotorShown = this.heliFeatures.length > 0;
      this.setData('aircraft-rotor', { type: 'FeatureCollection', features: this.heliFeatures.map((f) => ({ ...f, properties: { ...f.properties, rot } })) });
    }, 90);
    // vehicles on the airfield (ADS-B category C1/C2): small car icon + callsign, clickable
    add(
      {
        id: 'aircraft-vehicle',
        type: 'symbol',
        source: 'aircraft',
        minzoom: 12,
        filter: ['==', ['get', 'kind'], 'vehicle'],
        layout: {
          ...hidden,
          'icon-image': 'sil-vehicle',
          'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.55, 16, 0.85, 19, 1.1],
          'icon-rotate': ['get', 'track'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'text-field': ['step', ['zoom'], '', 13, ['get', 'callsign']],
          'text-font': FONT_BOLD,
          'text-size': 9,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-optional': true,
          'text-allow-overlap': false,
        },
        paint: {
          'icon-color': '#ffd23f',
          'icon-halo-color': 'rgba(0,0,0,0.7)',
          'icon-halo-width': 1,
          'text-color': '#ffd23f',
          'text-halo-color': 'rgba(0,0,0,0.8)',
          'text-halo-width': 1.2,
        },
      },
      'marker',
    );
    // low-poly 3D ships from zoom 11 on the flat map; the 2D icons (still clickable) fade out then
    this.ships3d = new ShipsLayer({
      enabled: () => this.on.has('ships'),
      modeChanged: (on) => {
        if (!m.getLayer('ships')) return;
        m.setPaintProperty('ships', 'icon-opacity', on ? 0 : ['case', ['get', 'moving'], 1, 0.6]);
        // the names move with the models as plain elements instead
        m.setPaintProperty('ships', 'text-opacity', on ? 0 : 1);
      },
    });
    m.addLayer(this.ships3d, 'marker');
    // low-poly 3D trains, subways, trams, buses … from zoom 12 on the flat map and only while
    // few enough of them are in view (otherwise they lag); the 2D dots step aside
    this.vehicles3d = new VehiclesLayer({
      enabled: () => this.on.has('trains') || this.on.has('transit'),
      modeChanged: (on) => {
        for (const id of ['trains', 'transit-veh']) {
          if (!m.getLayer(id)) continue;
          m.setPaintProperty(id, 'circle-opacity', on ? 0 : 1);
          m.setPaintProperty(id, 'circle-stroke-opacity', on ? 0 : 1);
        }
        for (const id of ['trains-label', 'transit-label']) if (m.getLayer(id)) m.setPaintProperty(id, 'text-opacity', on ? 0 : 1);
      },
    });
    m.addLayer(this.vehicles3d, 'marker');
    this.airport3d = new Airport3D(m, 'marker', { info: (i) => this.set('airport3d', i), modeChanged: () => this.refreshLiveIcons(), iconsTick: () => this.refreshLiveIcons() });
    this.airport3d.init();
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
    return this.lightning?.delay;
  }

  /** The map layers of a layer entry (for the draw order), in their style order. */
  layerIds(id: ExtraId): string[] {
    return LAYERS[id] ?? [];
  }

  /** Unteroptionen von "Blitze Live": Ton (mit Lautstärke), Einschlagskreis, Detektoren, Donner. */
  setLightningOptions(o: { sound?: boolean; wave?: boolean; detectors?: boolean; lines?: boolean; thunder?: boolean; volume?: number }) {
    const vol = o.volume != null && Number.isFinite(o.volume) ? Math.max(0, Math.min(100, o.volume)) : 70;
    const next = { sound: !!o.sound, wave: !!o.wave, detectors: !!o.detectors, lines: !!o.lines, thunder: !!o.thunder, volume: vol };
    const prev = this.lightningOpts;
    if (prev.sound === next.sound && prev.wave === next.wave && prev.detectors === next.detectors && prev.lines === next.lines && prev.thunder === next.thunder && prev.volume === next.volume) return;
    this.lightningOpts = next;
    if (!this.ready) return;
    this.updateLightningVis();
    // the AudioContext must be created inside a user gesture once, so that the tick sounds work
    if (next.sound && this.on.has('lightning')) this.ensureAudio();
    if (!this.on.has('lightning')) return;
    if (!next.wave) this.setData('lightning-wave', empty());
    if (!next.lines) this.setData('lightning-line', empty());
    if (!next.thunder) this.setData('lightning-thunder', empty());
    if (!next.detectors) {
      this.setData('lightning-sta', empty());
      this.lightningStationsPushed = -1;
    }
    this.syncLightningAnim();
  }

  /** Visibility of the optional lightning sub layers follows the options. */
  private updateLightningVis() {
    const on = this.on.has('lightning');
    this.vis('lightning-wave', on && this.lightningOpts.wave);
    this.vis('lightning-line', on && this.lightningOpts.lines);
    this.vis('lightning-sta', on && this.lightningOpts.detectors);
    this.vis('lightning-thunder', on && this.lightningOpts.thunder);
  }

  /** Wave, detector lines and thunder only animate while there are fresh strikes around. */
  private syncLightningAnim() {
    const o = this.lightningOpts;
    const want = this.on.has('lightning') && (o.wave || o.lines || o.thunder);
    if (want) {
      if (this.lightningIdle) {
        this.lightningIdle = false;
        this.updateLightningExtras();
      } else {
        this.every('lightning-anim', 200, () => this.updateLightningExtras());
      }
      return;
    }
    this.clear('lightning-anim');
    if (!this.lightningIdle) {
      this.lightningIdle = true;
      this.setData('lightning-wave', empty());
      this.setData('lightning-line', empty());
      this.setData('lightning-thunder', empty());
    }
  }

  /** A fresh strike arrived: the sound plays right away, wave/lines/thunder get their first frame. */
  private lightningStrike() {
    if (!this.on.has('lightning')) return;
    const o = this.lightningOpts;
    if (o.sound) this.playStrikeTick();
    if (o.wave || o.lines || o.thunder) this.updateLightningExtras();
  }

  /** Short click tone for a strike (like lightningmaps.org), throttled for strike bursts. */
  private ensureAudio() {
    if (this.lightningAudio) return;
    try {
      this.lightningAudio = new AudioContext();
    } catch {
      this.lightningAudio = null;
      return;
    }
    void this.lightningAudio.resume().catch(() => {});
  }

  private playStrikeTick() {
    if (document.hidden) return;
    try {
      this.lightningAudio ??= new AudioContext();
      const ctx = this.lightningAudio;
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
        return;
      }
      const t = ctx.currentTime;
      if (t - this.lightningLastTick < 0.09) return;
      this.lightningLastTick = t;
      const peak = 0.2 * (this.lightningOpts.volume / 100);
      if (peak <= 0) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(660, t);
      osc.frequency.exponentialRampToValueAtTime(190, t + 0.05);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(peak, t + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.09);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    } catch {
      /* no audio available */
    }
  }

  private updateLightningExtras() {
    const o = this.lightningOpts;
    const l = this.lightning;
    if (!l || !this.on.has('lightning') || !(o.wave || o.lines || o.thunder)) {
      this.syncLightningAnim();
      return;
    }
    const now = Date.now();
    const keep = Math.max(LIGHTNING_LINES_MS, o.thunder ? LIGHTNING_THUNDER_MS : 0);
    const young = l.hasYoung(now, keep);
    if (!young && this.lightningIdle) return; // everything faded out, nothing left to do
    this.lightningIdle = !young;
    if (young) this.every('lightning-anim', 200, () => this.updateLightningExtras());
    if (o.wave) this.setData('lightning-wave', l.waveFeatures(now));
    if (o.lines) this.setData('lightning-line', l.lineFeatures(now));
    if (o.thunder) this.setData('lightning-thunder', l.thunderFeatures(now));
    if (!young) this.clear('lightning-anim');
  }

  stop() {
    for (const t of Object.values(this.timers)) clearInterval(t);
    this.timers = {};
  }

  resume() {
    if (this.ready) this.apply();
  }

  /** Called after the map stopped moving. */
  onMoveEnd() {
    for (const def of EXTRAS) if (def.onMoveEnd && this.on.has(def.id)) def.onMoveEnd(this.ctx);
    if (this.wantsAircraft()) this.loadAircraftNow();
    if (this.on.has('airport3d')) this.airport3d?.onMoveEnd();
    if (this.on.has('trains') || this.on.has('transit')) this.loadFeedsNow();
    if (this.on.has('trains') || this.on.has('transit')) this.loadSegmentsNow();
    if (this.on.has('ships') && this.ais) this.ais.start(this.viewBounds(4));
    if (this.on.has('webcams')) this.loadWebcamsNow();
    if (this.on.has('alpr')) this.loadAlprNow();
    if (this.on.has('blitzer')) this.loadBlitzerNow();
    if (this.on.has('waves')) this.loadWavesNow();
    if (this.on.has('rivers')) this.loadRiversNow();
    if (POWER_EXTRAS.some((id) => this.on.has(id))) this.loadOsmPowerNow();
  }

  // -------------------------------------------------------------------------

  private set(id: ExtraId, i: Info) {
    this.info[id] = { ...this.info[id], ...i };
    this.hooks.changed();
  }

  /** Big airports from our own list for the zoom levels 5–8, where the map tiles have none yet. */
  private async loadFarAirports() {
    const list = await staticAirports();
    const area = (b: number[]) => (b[2] - b[0]) * Math.cos((((b[1] + b[3]) / 2) * Math.PI) / 180) * (b[3] - b[1]) * 111.32 ** 2; // km²
    const features: Feature<Point>[] = list
      .filter((a) => a.iata)
      .map((a) => {
        const km2 = area(a.bbox);
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [(a.bbox[0] + a.bbox[2]) / 2, (a.bbox[1] + a.bbox[3]) / 2] },
          properties: { icao: a.icao, iata: a.iata, name: a.name, tier: km2 >= 45 ? 1 : km2 >= 30 ? 2 : 3 },
        };
      });
    this.setData('airports-far', { type: 'FeatureCollection', features });
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
    // power plants share layers – filter by the categories of the enabled extras
    const cats = [...new Set(POWER_EXTRAS.filter((id) => this.on.has(id)).flatMap((id) => POWER_CATS[id]!))];
    this.map.setFilter('power', ['in', ['get', 'cat'], ['literal', cats]]);
    this.map.setFilter('osm-power', ['in', ['get', 'cat'], ['literal', cats]]);
    // the optional lightning sub layers only show with their Unteroption enabled
    this.updateLightningVis();

    // 3D layout of the airports, 3D aircraft with trails, and whether the 2D aircraft icons are shown
    this.airport3d?.configure({ layout: this.on.has('airport3d'), planes: this.wantsAircraft(), icons: this.on.has('aircraft') });
    this.refreshAircraftIcons();
    // the radiosondes fly along with the aircraft: feed their positions into the 3D tracker (again
    // after each toggle and whenever the last feed lies back; the feed itself is fresh every 60 s)
    const sondesOn = this.on.has('sondes');
    if (sondesOn !== this.sondes3D) {
      this.sondes3D = sondesOn;
      if (sondesOn && this.lastSondes) {
        this.lastSondesFed = Date.now();
        this.airport3d?.feedSondes(this.lastSondes);
      } else if (!sondesOn) this.airport3d?.clearSondes();
    }
    if (sondesOn && this.lastSondes && Date.now() - this.lastSondesFed > 20000) {
      this.lastSondesFed = Date.now();
      this.airport3d?.feedSondes(this.lastSondes);
    }
    this.refreshSondesIcons();
    // the airport symbols make room for the 3D airport once it is drawn
    const maxZoom = this.on.has('airport3d') ? AIRPORT_ZOOM : 24;
    for (const [id, min] of [['airports', 1], ['airports-minor', 5.5]] as const) if (this.map.getLayer(id)) this.map.setLayerZoomRange(id, min, maxZoom);

    for (const def of EXTRAS) {
      const on = this.on.has(def.id);
      if (!on) {
        this.clear(def.id);
        def.disable?.(this.ctx);
        continue;
      }
      def.enable?.(this.ctx);
      switch (def.id) {
        case 'aircraft':
          this.loadAircraftNow();
          this.every('aircraft', 10000, () => this.loadAircraftNow());
          break;
        case 'airport3d':
          this.loadAircraftNow();
          this.every('airport3d', 10000, () => this.loadAircraftNow());
          break;
        case 'sondes':
          this.loadOnce('sondes', 60000, async () => {
            const fc = await loadSondes();
            this.lastSondes = fc;
            this.lastSondesFed = Date.now();
            this.airport3d?.feedSondes(fc);
            this.setData('sondes', fc);
            this.refreshSondesIcons();
            return { count: fc.features.length };
          });
          break;
        case 'sats':
        case 'starlink':
          this.startSatellites();
          break;
          break;
        case 'wind':
        case 'solar':
        case 'water':
        case 'nuclear':
        case 'coal':
        case 'gas':
        case 'oil':
        case 'biomass':
        case 'plants':
          this.ensurePower();
          break;
        case 'webcams':
          this.loadOnce('webcams', 6 * 60 * 60000, async () => {
            try {
              this.fiCams = await loadDigitrafficCams();
            } catch (e) {
              console.warn('Digitraffic', e);
            }
            this.mergeWebcams();
            return {};
          });
          this.ensureWebcamHeat();
          void this.loadWorldHeat();
          this.loadWebcamsNow();
          break;
        case 'alpr':
          this.ensureAlprTiles();
          this.loadAlprNow();
          break;
        case 'blitzer':
          this.loadBlitzerNow();
          break;
        case 'lightning':
          this.lightning ??= new LightningStream(() => this.lightningStatus());
          this.lightning.start();
          this.lightning.onStrike = () => this.lightningStrike();
          this.every('lightning', 3000, () => this.updateLightning());
          this.updateLightning();
          break;
        case 'waves':
          this.loadWavesNow();
          break;
        case 'rivers':
          this.loadRiversNow();
          break;
        case 'jmaradar':
          this.loadOnce('jmaradar', 5 * 60000, () => this.loadJmaRadar());
          break;
        case 'jmanowcast':
          this.loadOnce('jmanowcast', 5 * 60000, () => this.loadJmaRadar('jmanowcast'));
          break;
        case 'airports':
          this.set('airports', { note: 'Klick auf einen Flughafen zeigt Abflüge & Ankünfte vom Vortag' });
          void this.loadFarAirports();
          break;
        case 'ports':
          this.loadOnce('ports', Infinity, async () => {
            const fc = await loadPorts();
            this.setData('ports', fc);
            return { count: fc.features.length, note: 'Größere Häfen ab kleinem Zoom, kleinere beim Heranzoomen · Klick zeigt Hafendaten' };
          });
          break;
        case 'ships':
          this.loadOnce('ships', 60000, () => this.loadShips());
          if (hasAisLive()) {
            this.ais ??= new AisStream(() => this.mergeShips());
            this.ais.start(this.viewBounds(4));
            this.every('ais-push', 3000, () => this.mergeShips());
          }
          break;
        case 'trains':
          this.loadOnce('trains', 30000, () => this.loadGpsTrains());
          break;
      }
    }
    if (!this.on.has('sats') && !this.on.has('starlink')) this.clear('sat-pos');
    if (this.on.has('trains') || this.on.has('transit')) {
      this.loadSegmentsNow();
      this.every('veh-anim', 2000, () => this.updateVehicles());
      this.every('veh-fetch', 60000, () => this.loadSegmentsNow(true));
      this.loadFeedsNow();
      this.every('veh-feeds', 10000, () => this.loadFeedsNow());
    } else {
      this.clear('veh-anim');
      this.clear('veh-fetch');
      this.clear('veh-feeds');
    }
    if (!this.on.has('waves')) this.waveKey = '';
    if (!this.on.has('rivers')) this.riverKey = '';
    if (!this.on.has('lightning')) {
      this.clear('lightning');
      this.clear('lightning-anim');
      this.lightning?.stop();
      this.setData('lightning', empty());
      this.setData('lightning-wave', empty());
      this.setData('lightning-line', empty());
      this.setData('lightning-sta', empty());
      this.setData('lightning-thunder', empty());
      this.lightningStationsPushed = -1;
      this.lightningIdle = true;
    }
    if (!this.on.has('ships') || !hasAisLive()) {
      this.clear('ais-push');
      this.ais?.stop();
      if (!hasAisLive()) this.ais = null;
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

  /** Point a JMA source at its newest scan (observation) or the +60 min forecast frame (nowcast). */
  private async loadJmaRadar(id: 'jmaradar' | 'jmanowcast' = 'jmaradar') {
    const nowcast = id === 'jmanowcast';
    const r = await fetch(`https://www.jma.go.jp/bosai/jmatile/data/nowc/targetTimes_${nowcast ? 'N2' : 'N1'}.json`);
    if (!r.ok) throw new Error(`JMA ${r.status}`);
    const times = (await r.json()) as { basetime: string; validtime: string }[];
    const latest = nowcast ? times.reduce((a, t) => (t.basetime > a.basetime || (t.basetime === a.basetime && t.validtime > a.validtime) ? t : a), times[0]) : (times.find((t) => t.basetime === t.validtime) ?? times[0]);
    if (!latest) throw new Error('JMA: keine Radarzeit');
    (this.map.getSource(id) as RasterTileSource | undefined)?.setTiles([JMA_RADAR_TILES(latest.basetime, latest.validtime)]);
  }

  /** Throttled: no overlapping requests and at least 5 s between two (timer + map moves). */
  /** The aircraft feed also drives the 3D airport layer. */
  private wantsAircraft() {
    return this.on.has('aircraft') || this.on.has('airport3d');
  }

  private loadAircraftNow() {
    if (!this.wantsAircraft()) return;
    if (this.aircraftBusy) {
      this.aircraftAgain = true;
      return;
    }
    const wait = this.aircraftAt + 5000 - Date.now();
    if (wait > 0) {
      clearTimeout(this.aircraftDelay);
      this.aircraftDelay = window.setTimeout(() => this.loadAircraftNow(), wait);
      return;
    }
    this.aircraftBusy = true;
    this.aircraftAt = Date.now();
    this.fetchAircraft().finally(() => {
      this.aircraftBusy = false;
      if (this.aircraftAgain) {
        this.aircraftAgain = false;
        this.loadAircraftNow();
      }
    });
  }

  private selectedBusy = false;

  /** The selected aircraft is followed on its own, so it stays up to date outside the area of the map request. */
  private fetchSelected() {
    const hex = this.airport3d?.selectedHex();
    if (!hex || this.selectedBusy) return;
    this.selectedBusy = true;
    loadAircraftByHex(hex)
      .then((fc) => this.airport3d?.feed(fc))
      .catch(() => undefined)
      .finally(() => (this.selectedBusy = false));
  }

  private fetchAircraft(): Promise<void> {
    const m = this.map;
    this.fetchSelected();
    if (m.getZoom() < 5) {
      // the 3D airport layer only needs the live feed
      if (!this.on.has('aircraft')) return Promise.resolve();
      // zoomed out: coarse worldwide overview (positions refresh every 2 minutes)
      const seq = ++this.aircraftSeq;
      return loadGlobalAircraft()
        .then((fc) => {
          if (seq !== this.aircraftSeq || !this.on.has('aircraft')) return;
          this.setData('aircraft', fc);
          this.set('aircraft', { loading: false, count: fc.features.length, note: 'Weltübersicht (OpenSky, alle 2 min) – reinzoomen für Live-Details' });
        })
        .catch(() => {
          if (seq !== this.aircraftSeq) return;
          this.setData('aircraft', empty());
          this.set('aircraft', { note: 'Weltübersicht gerade nicht verfügbar – zum Anzeigen näher heranzoomen', count: undefined, loading: false });
        });
    }
    const c = m.getCenter();
    const b = m.getBounds();
    // radius = distance centre → corner in nautical miles
    const dLat = ((b.getNorth() - c.lat) * Math.PI) / 180;
    const dLon = ((b.getEast() - c.lng) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((c.lat * Math.PI) / 180) * Math.cos((b.getNorth() * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    const km = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const nm = km / 1.852;
    const seq = ++this.aircraftSeq;
    if (this.on.has('aircraft') && !this.info.aircraft?.count) this.set('aircraft', { loading: true, note: undefined });
    return loadAircraft(c.lat, c.lng, nm)
      .then((fc) => {
        this.aircraftErr = '';
        if (seq !== this.aircraftSeq || !this.wantsAircraft()) return;
        this.lastAircraft = fc;
        this.airport3d?.feed(fc, { lat: c.lat, lon: c.lng, nm });
        if (!this.on.has('aircraft')) return;
        this.refreshAircraftIcons();
        this.set('aircraft', { loading: false, count: fc.features.length, note: `via ${fc.source}${nm > 250 ? ' · nur Umkreis um die Kartenmitte' : ''}` });
      })
      .catch((e) => {
        // log once per distinct failure, not on every refresh
        const msg = e instanceof Error ? e.message : String(e);
        if (msg !== this.aircraftErr && msg !== AC_ALL_PAUSED) console.warn('aircraft', e);
        this.aircraftErr = msg;
        if (seq === this.aircraftSeq && this.on.has('aircraft'))
          this.set('aircraft', { loading: false, note: 'keine Flugdatenquelle erreichbar – ggf. Daten-Proxy einrichten (README)' });
      });
  }

  /** 2D aircraft icons: all aircraft, except those drawn as 3D models while the map is tilted. */
  private refreshAircraftIcons() {
    if (!this.on.has('aircraft') || !this.lastAircraft) return;
    const fc = this.lastAircraft;
    const airport = this.airport3d;
    // aircraft of the cache that the latest request did not return stay visible (they keep flying on their course)
    const cached = airport ? airport.cachedFeatures(new Set(fc.features.map((f) => String(f.properties?.hex)))) : [];
    let features = airport ? [...fc.features, ...cached].filter((f) => !airport.owns(String(f.properties?.hex))) : fc.features;
    // on a flat map the icons move like the 3D models: smoothed position and heading
    if (airport?.mode() === 'flat') {
      features = features.map((f) => {
        const live = airport.planeInfo(String(f.properties?.hex));
        return live ? { ...f, geometry: { type: 'Point', coordinates: [live.lon, live.lat] }, properties: { ...f.properties, track: live.track } } : f;
      });
    }
    this.heliFeatures = features.filter((f) => f.properties?.kind === 'heli') as Feature<Point>[];
    this.setData('aircraft', { ...fc, features });
  }

  /** 2D radiosonde symbols: hide the ones that are drawn as 3D balloon models (like the aircraft). */
  private refreshSondesIcons() {
    const fc = this.lastSondes;
    if (!fc || !this.on.has('sondes')) return;
    const air = this.airport3d;
    const features = air ? fc.features.filter((f) => !air.ownsSonde(String(f.properties?.serial))) : fc.features;
    if (features.length !== fc.features.length) this.setData('sondes', { ...fc, features });
  }

  /** 2D icon refresh for all live 3D traffic (aircraft and radiosondes). */
  private refreshLiveIcons() {
    this.refreshAircraftIcons();
    this.refreshSondesIcons();
  }

  /** Current data of an aircraft for the flight panel (smoothed position if it is tracked in 3D). */
  flightInfo(hex: string): FlightInfo | null {
    const f = this.lastAircraft?.features.find((x) => x.properties?.hex === hex) ?? this.airport3d?.cachedFeatures(new Set())?.find((x) => x.properties?.hex === hex);
    if (!f) return null;
    const p = f.properties as Record<string, unknown>;
    const live = this.airport3d?.planeInfo(hex);
    const [lon, lat] = f.geometry.coordinates;
    return {
      hex,
      callsign: String(p.callsign ?? ''),
      reg: String(p.reg ?? ''),
      type: String(p.type ?? ''),
      icao: String(p.icao ?? ''),
      operator: String(p.operator ?? ''),
      altM: live ? live.altM : Number(p.altM) || 0,
      speedKmh: p.speedKmh != null ? Number(p.speedKmh) : null,
      track: live ? live.track : Number(p.track) || 0,
      ground: !!p.ground,
      emergency: String(p.emergency ?? ''),
      squawk: String(p.squawk ?? ''),
      vsMs: p.vsMs != null ? Number(p.vsMs) : null,
      lon: live ? live.lon : lon,
      lat: live ? live.lat : lat,
      source: this.lastAircraft?.source ?? '',
      route: this.airport3d?.route(hex),
      history: live ? { alt: live.hist.map((h) => h[0]), speed: live.hist.map((h) => h[1]), vs: live.hist.map((h) => h[2]), track: live.hist.map((h) => h[3]) } : undefined,
    };
  }

  /** Aircraft under a screen point: the model, its trail or the wall below the trail. */
  pickFlight(x: number, y: number): string | null {
    return this.airport3d?.pick(x, y) ?? null;
  }

  /** Highlight the trail of an aircraft (null: none). */
  selectFlight(hex: string | null) {
    this.airport3d?.select(hex);
  }

  /** Zoom the map to the whole trail of an aircraft. */
  fitFlight(hex: string) {
    this.airport3d?.fitTrail(hex);
  }

  /** Current data of a radiosonde for the sonde panel (smoothed position if it is tracked in 3D). */
  sondeInfo(serial: string): SondeInfo | null {
    const f = this.lastSondes?.features.find((x) => x.properties?.serial === serial);
    if (!f) return null;
    const p = f.properties as Record<string, unknown>;
    const live = this.airport3d?.planeInfo(`sonde:${serial}`);
    return {
      serial,
      type: String(p.type ?? ''),
      subtype: String(p.subtype ?? ''),
      manufacturer: String(p.manufacturer ?? ''),
      altM: live ? live.altM : Number(p.altM) || 0,
      vsMs: p.velV != null ? Number(p.velV) : null,
      speedKmh: p.velH != null ? Math.round(Number(p.velH) * 36) / 10 : null,
      track: p.heading != null ? Number(p.heading) : null,
      frequency: p.frequency != null ? Number(p.frequency) : null,
      frame: p.frame != null ? Number(p.frame) : null,
      datetime: String(p.date ?? ''),
      timeReceived: String(p.timeReceived ?? ''),
      uploader: String(p.uploader ?? ''),
      antenna: String(p.antenna ?? ''),
      software: String(p.software ?? ''),
      url: String(p.url ?? ''),
      lon: live ? live.lon : f.geometry.coordinates[0],
      lat: live ? live.lat : f.geometry.coordinates[1],
      history: live ? { alt: live.hist.map((h) => h[0]), speed: live.hist.map((h) => h[1]), vs: live.hist.map((h) => h[2]), track: live.hist.map((h) => h[3]) } : undefined,
    };
  }

  /** Highlight the ascent trail of a radiosonde (null: none). */
  selectSonde(serial: string | null) {
    this.airport3d?.select(serial == null ? null : `sonde:${serial}`);
  }

  /** Zoom the map to the whole ascent of a radiosonde. */
  fitSonde(serial: string) {
    this.airport3d?.fitTrail(`sonde:${serial}`);
  }

  private startSatellites() {
    const wantBase = this.on.has('sats');
    const wantStarlink = this.on.has('starlink');
    if (wantBase && !this.sats.length && !this.satsLoading) {
      this.set('sats', { loading: true });
      this.satsLoading = loadSatellites()
        .then((s) => {
          this.sats = s;
          this.set('sats', { loading: false, count: s.length });
        })
        .catch(() => {
          this.set('sats', { loading: false, note: 'CelesTrak nicht erreichbar' });
          this.hooks.toast('Satellitendaten (CelesTrak) konnten nicht geladen werden.');
        })
        .finally(() => {
          this.satsLoading = null;
          this.updateSatPositions();
        });
    }
    if (wantStarlink && !this.starlink.length && !this.starlinkLoading) {
      this.set('starlink', { loading: true });
      this.starlinkLoading = loadSatGroup('starlink')
        .then((s) => {
          this.starlink = s;
          this.set('starlink', { loading: false, count: s.length });
        })
        .catch(() => this.set('starlink', { loading: false, note: 'CelesTrak nicht erreichbar' }))
        .finally(() => {
          this.starlinkLoading = null;
          this.updateSatPositions();
        });
    }
    this.updateSatPositions();
    this.clear('sat-pos');
    this.every('sat-pos', wantStarlink ? 4000 : 2000, () => this.updateSatPositions());
  }

  private updateSatPositions() {
    const list = [...(this.on.has('sats') ? this.sats : []), ...(this.on.has('starlink') ? this.starlink : [])];
    this.setData('sats', satelliteFeatures(list));
  }

  private ensurePower() {
    if (!this.powerLoaded && !this.powerLoading) {
      for (const id of POWER_EXTRAS) if (this.on.has(id)) this.set(id, { loading: true });
      this.powerLoading = loadPowerPlants()
        .then((fc) => {
          this.powerLoaded = true;
          this.setData('power', fc);
          this.powerCounts = { wind: 0, solar: 0, hydro: 0, nuclear: 0, coal: 0, gas: 0, oil: 0, biomass: 0, other: 0 };
          for (const f of fc.features) this.powerCounts[f.properties!.cat as PowerCat]++;
        })
        .catch(() => this.hooks.toast('Kraftwerksdatenbank konnte nicht geladen werden.'))
        .finally(() => {
          this.powerLoading = null;
          for (const id of POWER_EXTRAS) {
            this.set(id, { loading: false, count: this.powerLoaded ? this.powerCounts[POWER_CATS[id]![0]] : undefined });
          }
        });
    }
    this.loadOsmPowerNow();
  }

  private loadOsmPowerNow() {
    const m = this.map;
    if (m.getZoom() < 10) return;
    const b = m.getBounds();
    // snap to a grid so small pans reuse the last result
    const snap = (v: number, f: (x: number) => number) => f(v * 20) / 20;
    const bounds = {
      west: snap(b.getWest(), Math.floor),
      south: snap(b.getSouth(), Math.floor),
      east: snap(b.getEast(), Math.ceil),
      north: snap(b.getNorth(), Math.ceil),
    };
    const key = Object.values(bounds).join(',');
    if (key === this.osmPowerKey) return;
    this.osmPowerKey = key;
    loadOsmPower(bounds)
      .then((fc) => {
        if (this.osmPowerKey === key) this.setData('osm-power', fc);
      })
      .catch((e) => {
        if (isSuperseded(e) || this.osmPowerKey !== key) return;
        console.warn('Overpass', e);
        this.osmPowerKey = '';
      });
  }

  // -------------------------------------------------------------------------
  // Trains & public transport

  private async loadGpsTrains() {
    const [fi, us] = await Promise.allSettled([loadTrains(), loadAmtrak()]);
    const features = [...(fi.status === 'fulfilled' ? fi.value.features : []), ...(us.status === 'fulfilled' ? us.value : [])];
    this.gpsTrains = { type: 'FeatureCollection', features };
    this.updateVehicles();
    const failed = [fi.status === 'rejected' ? 'Finnland' : '', us.status === 'rejected' ? 'Amtrak' : ''].filter(Boolean);
    return { note: this.trainNote(failed) };
  }

  private trainNote(failed: string[] = []) {
    const z = this.map.getZoom();
    return [z < 5 ? 'Deutschland & Europa ab Zoomstufe 5' : '', failed.length ? `${failed.join(', ')} nicht erreichbar` : ''].filter(Boolean).join(' · ') || undefined;
  }

  /** Fetch Transitous trip segments for the view (rail from zoom 5, local transport from zoom 10). */
  private loadSegmentsNow(force = false) {
    const z = this.map.getZoom();
    const wantRail = this.on.has('trains') && z >= 5;
    const wantLocal = this.on.has('transit') && z >= 10;
    const cityNote = 'Fahrplan-Echtzeit (Transitous) ab Zoomstufe 10 – GPS-Regionen schon früher';
    if (this.on.has('transit')) this.set('transit', { note: z < 10 ? cityNote : this.info.transit?.note === cityNote ? undefined : this.info.transit?.note });
    if (this.on.has('trains')) this.set('trains', { note: this.trainNote() });
    if (!wantRail && !wantLocal) {
      this.segs = [];
      this.segKey = '';
      this.updateVehicles();
      return;
    }
    const b = this.viewBounds(z >= 10 ? 20 : 2);
    const key = `${Object.values(b).join(',')}|${Math.round(z)}`;
    if (this.segLoading || (!force && key === this.segKey && Date.now() - this.segAt < 60000)) return;
    this.segLoading = true;
    const now = Date.now();
    loadSegments(b, z, now - 30000, now + 3 * 60000)
      .then((segs) => {
        this.segs = segs;
        this.segKey = key;
        this.segAt = Date.now();
        this.updateVehicles();
      })
      .catch((e) => {
        console.warn('Transitous', e);
        if (this.on.has('trains')) this.set('trains', { note: 'Transitous nicht erreichbar – nur GPS-Züge (Finnland, USA)' });
        if (this.on.has('transit')) this.set('transit', { note: 'Transitous nicht erreichbar' });
      })
      .finally(() => {
        this.segLoading = false;
      });
  }

  /** GPS feeds (Norway, Boston, Toronto, …) for the regions in view, each at its own interval. */
  private loadFeedsNow() {
    if (this.map.getZoom() < 4) return;
    const b = this.map.getBounds();
    const view = { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() };
    const active = new Set<string>();
    for (const feed of feedsInView(view)) {
      active.add(feed.id);
      const prev = this.feedVeh.get(feed.id);
      if (this.feedLoading.has(feed.id) || (prev && Date.now() - prev.at < feed.every * 1000)) continue;
      this.feedLoading.add(feed.id);
      // Entur supports a bounding box – pad the view so small pans need no reload
      const padX = (view.east - view.west) * 0.3;
      const padY = (view.north - view.south) * 0.3;
      feed
        .load({ west: view.west - padX, east: view.east + padX, south: view.south - padY, north: view.north + padY })
        .then((list) => {
          this.feedVeh.set(feed.id, { at: Date.now(), features: vehicleFeatures(feed, list) });
          this.feedErrors.delete(feed.label);
          this.updateVehicles();
        })
        .catch((e) => {
          console.warn(feed.id, e);
          this.feedVeh.set(feed.id, { at: Date.now(), features: [] });
          this.feedErrors.add(feed.label);
          const note = `${[...this.feedErrors].join(', ')} nicht erreichbar`;
          if (this.on.has('transit')) this.set('transit', { note });
        })
        .finally(() => this.feedLoading.delete(feed.id));
    }
    // drop vehicles of regions that left the view
    for (const id of [...this.feedVeh.keys()]) if (!active.has(id)) this.feedVeh.delete(id);
  }

  private updateVehicles() {
    const rail = this.on.has('trains');
    const local = this.on.has('transit');
    const live = positionsAt(this.segs, Date.now(), (m) => (RAIL_MODES.has(m) ? rail : local));
    const gps = [...this.feedVeh.values()].flatMap((f) => f.features).filter((f) => (f.properties?.rail ? rail : local));
    const features = [...live.features, ...gps, ...(rail ? this.gpsTrains.features : [])];
    this.setData('trains', { type: 'FeatureCollection', features });
    this.vehicles3d?.setFeatures(features as Feature<Point>[]);
    const nRail = features.filter((f) => f.properties?.rail).length;
    if (rail && this.info.trains?.count !== nRail) this.set('trains', { count: nRail, loading: false });
    if (local && this.info.transit?.count !== features.length - nRail) this.set('transit', { count: features.length - nRail });
  }

  // -------------------------------------------------------------------------
  // Launches, ships

  /** Simulated live track of the rocket followed in the launch panel (null: hide it). */
  setLaunchLive(data: { line: FeatureCollection; pos: FeatureCollection } | null) {
    const none = empty();
    this.setData('launch-live-line', data?.line ?? none);
    this.setData('launch-live', data?.pos ?? none);
    // layer visibility follows the data: hidden layers drop their source's attribution
    const has = (fc: FeatureCollection | undefined) => !!fc?.features.length;
    this.vis('launch-live-line', has(data?.line));
    this.vis('launch-live', has(data?.pos));
  }

  private async loadShips() {
    let note: string | undefined;
    try {
      this.baltic = await loadDigitrafficShips();
    } catch (e) {
      console.warn('Digitraffic AIS', e);
      if (!hasAisLive()) throw e;
      note = 'Fintraffic nicht erreichbar';
    }
    this.mergeShips();
    return { note: note ?? this.info.ships?.note };
  }

  private waveKey = '';

  private loadWavesNow() {
    const b = this.map.getBounds();
    const z = this.map.getZoom();
    const q = (v: number) => Math.round(v / 2) * 2;
    const key = [q(b.getWest()), q(b.getSouth()), q(b.getEast()), q(b.getNorth())].join(',');
    if (key === this.waveKey) return;
    this.waveKey = key;
    this.set('waves', { loading: true });
    loadWaves({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth(), zoom: z })
      .then((r) => {
        if (this.waveKey !== key) return;
        this.setData('waves', r.fc);
        this.set('waves', { loading: false, count: r.fc.features.length, note: `Raster ${r.step}° · Zahl = Wellenhöhe in m – zoomen für feineres Raster` });
      })
      .catch((e) => {
        console.warn('Open-Meteo Marine', e);
        this.waveKey = '';
        this.set('waves', { loading: false, note: e instanceof Error && /Limit/.test(e.message) ? e.message : 'Open-Meteo Marine nicht erreichbar' });
      });
  }

  private riverKey = '';

  private loadRiversNow() {
    const b = this.map.getBounds();
    const q = (v: number) => Math.round(v / 2) * 2;
    const key = [q(b.getWest()), q(b.getSouth()), q(b.getEast()), q(b.getNorth())].join(',');
    if (key === this.riverKey) return;
    this.riverKey = key;
    this.set('rivers', { loading: true });
    loadRivers({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth(), zoom: this.map.getZoom() })
      .then((r) => {
        if (this.riverKey !== key) return;
        this.setData('rivers', r.fc);
        this.set('rivers', { loading: false, count: r.fc.features.length, note: r.fc.features.length ? `Raster ${r.step}° – zoomen für mehr Flüsse · Farbe = Abfluss (blau klein → lila/rot sehr groß)` : 'hier keine Flüsse im Modell – anderen Ausschnitt wählen' });
      })
      .catch((e) => {
        console.warn('Open-Meteo Flood', e);
        this.riverKey = '';
        this.set('rivers', { loading: false, note: e instanceof Error && /Limit/.test(e.message) ? e.message : 'Open-Meteo Flood nicht erreichbar' });
      });
  }

  private updateLightning() {
    const l = this.lightning;
    if (!l) return;
    this.setData('lightning', l.features());
    if (this.lightningOpts.detectors && this.lightningStationsPushed !== l.stationCount) {
      this.lightningStationsPushed = l.stationCount;
      this.setData('lightning-sta', l.stationFeatures());
    }
    this.lightningStatus();
  }

  private lightningStatus() {
    const l = this.lightning;
    if (!l) return;
    const d = l.delay;
    const note = l.error
      || (l.connected
        ? `live verbunden · ${fmt.num(l.received)} Blitze seit Aktivierung${d != null ? ` · Verzögerung ~${fmt.num(d, 1)} s` : ''} · weiß = jetzt, rot = bis 15 min`
        : 'verbinde …');
    const prev = this.info.lightning;
    if (prev?.count !== l.count || prev?.note !== note) this.set('lightning', { count: l.count, note });
  }

  /** True while the 3D ship models are drawn: the 2D icons are not clickable then (see pickShip). */
  ships3dActive() {
    return !!this.ships3d?.isActive();
  }

  /** The 3D ship model under a screen point as a click result (popup), if any. */
  pickShip(x: number, y: number, at: { lng: number; lat: number }): ClickResult | null {
    const ship = this.ships3d?.isActive() ? this.ships3d.pick(x, y) : null;
    if (!ship) return null;
    const feature = { ...shipFeatures([ship]).features[0], layer: { id: 'ships' } } as unknown as MapGeoJSONFeature;
    return this.click(feature, at);
  }

  /** True while the 3D vehicle models are drawn: the 2D dots are not clickable then (see pickVehicle). */
  vehicles3dActive() {
    return !!this.vehicles3d?.isActive();
  }

  /** The 3D vehicle model under a screen point as a click result (popup), if any. */
  pickVehicle(x: number, y: number, at: { lng: number; lat: number }): ClickResult | null {
    const f = this.vehicles3d?.isActive() ? this.vehicles3d.pick(x, y) : null;
    if (!f) return null;
    const feature = { ...f, layer: { id: f.properties?.rail ? 'trains' : 'transit-veh' } } as unknown as MapGeoJSONFeature;
    return this.click(feature, at);
  }

  /** Current data of a ship for the ship panel. */
  shipInfo(mmsi: number): ShipInfo | null {
    const ship = this.shipsAll.get(mmsi);
    if (!ship) return null;
    const pos = this.ships3d?.position(mmsi);
    return { ship, history: this.ships3d?.history(mmsi) ?? { speed: [], track: [] }, lon: pos?.[0] ?? ship.lon, lat: pos?.[1] ?? ship.lat };
  }

  private mergeShips() {
    const all = new Map<number, Ship>();
    for (const s of this.baltic) all.set(s.mmsi, s);
    if (this.ais) for (const s of this.ais.ships.values()) all.set(s.mmsi, s);
    this.shipsAll = all;
    this.setData('ships', shipFeatures(all.values()));
    this.ships3d?.setShips(all.values());
    const notes = [this.ais?.error, !hasAisLive() ? 'außerhalb der Ostsee mit Daten-Proxy oder kostenlosem aisstream.io-Schlüssel (Einstellungen)' : 'weltweit live im Kartenausschnitt (aisstream.io)'].filter(Boolean);
    const prev = this.info.ships;
    const note = notes.join(' · ');
    if (prev?.count !== all.size || prev?.note !== note) this.set('ships', { count: all.size, note });
  }

  // -------------------------------------------------------------------------
  // Cameras

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

  private mergeWebcams() {
    const feedCams = [...this.camFeeds.values()].flatMap((f) => f.features);
    const all = { type: 'FeatureCollection' as const, features: [...this.fiCams.features, ...this.windyCams.features, ...feedCams] };
    this.setData('webcams', all);
    this.set('webcams', { count: all.features.length + this.osmCamCount || undefined });
    this.updateWebcamNote();
  }

  private updateWebcamNote() {
    const notes: string[] = [];
    if (this.map.getZoom() < CAM_DETAIL_ZOOM) notes.push('Webcams aus OpenStreetMap ab Zoomstufe 9');
    if (this.camFeedErrors.size) notes.push(`${[...this.camFeedErrors].join(', ')} nicht erreichbar`);
    if (!hasWindyKey()) notes.push('weltweit viele weitere mit kostenlosem Windy-Schlüssel (Einstellungen)');
    else if (this.map.getZoom() < 5) notes.push('Windy-Webcams ab Zoomstufe 5');
    this.set('webcams', { note: notes.join(' · ') || undefined });
  }

  private loadWebcamsNow() {
    const m = this.map;
    const z = m.getZoom();
    // regional camera feeds (London, California, Hong Kong, …) once their region is in view
    const vb = m.getBounds();
    for (const feed of camFeedsInView({ west: vb.getWest(), south: vb.getSouth(), east: vb.getEast(), north: vb.getNorth() })) {
      const prev = this.camFeeds.get(feed.id);
      // signed image URLs (Singapore) expire – refresh those more often
      const maxAge = (feed.id === 'singapore' ? 4 : 10) * 60000;
      if (this.camFeedLoading.has(feed.id) || (prev && Date.now() - prev.at < maxAge)) continue;
      this.camFeedLoading.add(feed.id);
      // camera lists are mirrored daily into the data branch (images still load live)
      const load = SNAPSHOT_CAMS.has(feed.id) ? () => snapshotJson(`cams/${feed.id}.json`, () => feed.load()) : () => feed.load();
      load()
        .then((features) => {
          this.camFeeds.set(feed.id, { at: Date.now(), features });
          this.camFeedErrors.delete(feed.label);
          this.mergeWebcams();
        })
        .catch((e) => {
          console.warn('Webcams', feed.id, e);
          this.camFeeds.set(feed.id, { at: Date.now(), features: prev?.features ?? [] });
          this.camFeedErrors.add(feed.label);
          this.updateWebcamNote();
        })
        .finally(() => this.camFeedLoading.delete(feed.id));
    }
    // OpenStreetMap webcams for the visible area
    if (z >= CAM_DETAIL_ZOOM) {
      const b = this.viewBounds();
      const key = Object.values(b).join(',');
      if (key !== this.camKey) {
        this.camKey = key;
        loadOsmWebcams(b)
          .then((fc) => {
            if (this.camKey !== key) return;
            this.setData('webcams-osm', fc);
            this.osmCamFc = fc;
            this.osmCamCount = fc.features.length;
            this.updateCamFov();
            this.mergeWebcams();
          })
          .catch((e) => {
            if (isSuperseded(e) || this.camKey !== key) return;
            console.warn('Overpass webcams', e);
            this.camKey = '';
          });
      }
    }
    // Windy webcams around the map centre
    if (hasWindyKey() && z >= 5) {
      const c = m.getCenter();
      const b = m.getBounds();
      const km = Math.min(250, (Math.abs(b.getNorth() - b.getSouth()) * 111) / 2);
      const key = `${c.lat.toFixed(1)},${c.lng.toFixed(1)},${Math.round(km / 10)}`;
      // image URLs expire after 10 minutes on the free tier – reload at least that often
      if (key !== this.windyKey || Date.now() - (this.info.webcams?.at ?? 0) > 8 * 60000) {
        this.windyKey = key;
        loadWindyWebcams(c.lat, c.lng, km)
          .then((fc) => {
            if (this.windyKey !== key) return;
            this.windyCams = fc;
            this.mergeWebcams();
          })
          .catch((e) => {
            console.warn('Windy', e);
            this.windyKey = '';
            this.set('webcams', { note: 'Windy-Webcams nicht erreichbar – Schlüssel prüfen' });
          });
      }
    }
    this.updateWebcamNote();
  }

  /**
   * Closeable heatmap over all known camera positions worldwide (`cams/world.json` –
   * aggregate of all snapshot feeds plus Digitraffic, gathered daily by the data action).
   * Fills the gap of the regional detail feeds: at every zoom level the complete camera
   * distribution is visible. Built like the ALPR heatmap – 'heatmap' + 'circle' dots,
   * the heat fades out below the detail zoom, the dots stay until the detail feed (images!)
   * takes over. No shader work: MapLibre's built-in heatmap.
   */
  private ensureWebcamHeat() {
    if (this.webcamHeatAdded) return;
    this.webcamHeatAdded = true;
    const m = this.map;
    const before = m.getLayer('webcams') ? 'webcams' : undefined;
    // halo first, so it lies below the heatmap and does not tint its white core
    m.addLayer(
      {
        id: 'webcams-glow',
        type: 'circle',
        source: 'webcams-world',
        minzoom: CAM_DOT_ZOOM,
        paint: { 'circle-color': CAM_COLOR, 'circle-radius': ['interpolate', ['linear'], ['zoom'], CAM_DOT_ZOOM, 8, CAM_DETAIL_ZOOM, 9, 14, 7], 'circle-blur': 1, 'circle-opacity': 0.25 },
      },
      before,
    );
    m.addLayer(
      {
        id: 'webcams-heat',
        type: 'heatmap',
        source: 'webcams-world',
        paint: {
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 2, 4, 8, 14],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 2, 0.35, 8, 1],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.85, 10, 0.6, 12, 0],
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(0,191,165,0)', 0.2, 'rgba(0,191,165,0.45)', 0.45, '#26c6da', 0.65, '#80deea', 0.8, '#ffffff', 1, '#ffffff',
          ],
        },
      },
      before,
    );
    m.addLayer(
      {
        id: 'webcams-dots',
        type: 'circle',
        source: 'webcams-world',
        minzoom: CAM_DOT_ZOOM,
        paint: { 'circle-color': CAM_COLOR, 'circle-radius': ['interpolate', ['linear'], ['zoom'], CAM_DOT_ZOOM, 1.8, CAM_DETAIL_ZOOM, 3, 14, 6], 'circle-opacity': 0.8 },
      },
      before,
    );
  }

  private async loadWorldHeat() {
    if (this.webcamHeatLoaded) return;
    this.webcamHeatLoaded = true;
    try {
      const pts = await snapshotJson<[number, number][]>('cams/world.json');
      this.setData('webcams-world', {
        type: 'FeatureCollection',
        features: pts.map(([lon, lat]) => ({ type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [lon, lat] }, properties: {} })),
      });
    } catch (e) {
      this.webcamHeatLoaded = false;
      console.warn('Webcam-Heatmap', e);
    }
  }

  private ensureAlprTiles() {
    if (this.alprTilesAdded) return;
    this.alprTilesAdded = true;
    const m = this.map;
    const attribution = 'ALPR-Übersicht: <a href="https://github.com/flockhopper3/deflock-data">deflock-data</a>, © OpenStreetMap (ODbL)';
    m.addSource('alpr-us', { type: 'vector', url: ALPR_TILES_US, attribution });
    m.addSource('alpr-ca', { type: 'vector', url: ALPR_TILES_CA });
    for (const src of ['alpr-us', 'alpr-ca']) {
      m.addLayer(
        {
          id: `alpr-heat-${src}`,
          type: 'heatmap',
          source: src,
          'source-layer': ALPR_SOURCE_LAYER,
          paint: {
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 2, 4, 8, 14],
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 2, 0.35, 8, 1],
            'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.85, 10, 0.6, 14, 0.6],
            'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(239,68,68,0)', 0.2, 'rgba(239,68,68,0.45)', 0.5, '#f97316', 0.8, '#fde047', 1, '#ffffff'],
          },
        },
        'alpr-cone',
      );
      m.addLayer(
        {
          id: `alpr-dots-${src}`,
          type: 'circle',
          source: src,
          'source-layer': ALPR_SOURCE_LAYER,
          minzoom: 6,
          // no maxzoom: the tiles carry single cameras up to zoom 14, so the map stays filled when
          // the live Overpass query fails (the live layer is drawn on top of these dots)
          paint: { 'circle-color': ALPR_RED, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 1.8, CAM_DETAIL_ZOOM, 3, 14, 6], 'circle-opacity': 0.8 },
        },
        'alpr-cone',
      );
    }
    m.on('idle', () => this.updateAlprFov());
    LAYERS.alpr.push('alpr-heat-alpr-us', 'alpr-heat-alpr-ca', 'alpr-dots-alpr-us', 'alpr-dots-alpr-ca');
    this.apply();
  }

  /** Viewing-direction sectors for the cameras in view: live data plus what the overview tiles carry. */
  private updateAlprFov() {
    if (!this.on.has('alpr')) return;
    const m = this.map;
    const cams = new Map<string, [number, number, number]>();
    const take = (lon: number, lat: number, dir: unknown) => {
      const d = Number(dir);
      if (dir == null || dir === '' || !Number.isFinite(d) || d < 0) return;
      cams.set(`${lon.toFixed(6)},${lat.toFixed(6)},${d}`, [lon, lat, d]);
    };
    if (m.getZoom() >= ALPR_FOV_ZOOM) {
      for (const f of this.alprLive) take((f.geometry as Point).coordinates[0], (f.geometry as Point).coordinates[1], f.properties?.dir);
      if (this.alprTilesAdded && !this.alprTilesFailed) {
        for (const src of ['alpr-us', 'alpr-ca']) {
          if (!m.getSource(src)) continue;
          for (const f of m.querySourceFeatures(src, { sourceLayer: ALPR_SOURCE_LAYER, filter: ['has', 'direction'] })) {
            if (f.geometry.type === 'Point') take(f.geometry.coordinates[0], f.geometry.coordinates[1], f.properties?.direction);
          }
        }
      }
    }
    const key = [...cams.keys()].sort().join('|');
    if (key === this.alprFovKey) return;
    this.alprFovKey = key;
    this.setData('alpr-fov', { type: 'FeatureCollection', features: fovSectors([...cams.values()], ALPR_FOV_RADIUS, ALPR_FOV_ANGLE) });
  }

  /** Viewing-direction sectors for the OpenStreetMap webcams that carry a camera:direction tag. */
  private updateCamFov() {
    if (!this.on.has('webcams')) return;
    const cams: [number, number, number][] = [];
    if (this.map.getZoom() >= ALPR_FOV_ZOOM && this.osmCamFc) {
      for (const f of this.osmCamFc.features) {
        const dir = Number(f.properties?.dir);
        if (dir >= 0) cams.push([(f.geometry as Point).coordinates[0], (f.geometry as Point).coordinates[1], dir]);
      }
    }
    const key = cams.map((c) => c.join(',')).sort().join('|');
    if (key === this.camFovKey) return;
    this.camFovKey = key;
    this.setData('webcams-fov', { type: 'FeatureCollection', features: fovSectors(cams, CAM_FOV_RADIUS, CAM_FOV_ANGLE) });
  }

  private updateAlprNote() {
    const z = this.map.getZoom();
    if (z >= CAM_DETAIL_ZOOM) return; // keeps the per-view summary
    const notes: string[] = [];
    if (z < CAM_DETAIL_ZOOM)
      notes.push(this.alprTilesFailed ? 'Übersicht nicht erreichbar – ab Zoomstufe 9 live aus OpenStreetMap' : 'Übersicht USA/Kanada · Details ab Zoomstufe 9 (weltweit)');
    this.set('alpr', { note: notes.join(' · ') || undefined });
  }

  private loadAlprNow() {
    this.updateAlprNote();
    if (this.map.getZoom() < CAM_DETAIL_ZOOM) {
      this.setData('alpr', empty());
      this.alprLive = [];
      this.alprKey = '';
      return;
    }
    const b = this.viewBounds();
    const key = Object.values(b).join(',');
    if (key === this.alprKey) return;
    this.alprKey = key;
    this.set('alpr', { loading: true });
    loadAlpr(b)
      .then((fc) => {
        if (this.alprKey !== key) return;
        this.setData('alpr', fc);
        this.alprLive = fc.features;
        this.updateAlprFov();
        const flock = fc.features.filter((f) => f.properties?.flock).length;
        this.set('alpr', { loading: false, count: fc.features.length, note: fc.features.length ? `${flock} davon Flock Safety (im Ausschnitt)` : 'keine Kennzeichen-Kameras im Ausschnitt erfasst' });
      })
      .catch((e) => {
        if (isSuperseded(e) || this.alprKey !== key) return;
        console.warn('Overpass ALPR', e);
        this.alprKey = '';
        this.set('alpr', { loading: false, note: 'OpenStreetMap (Overpass) nicht erreichbar' });
      });
  }

  private loadBlitzerNow() {
    if (this.map.getZoom() < CAM_DETAIL_ZOOM) {
      this.setData('blitzer', empty());
      this.blitzerKey = '';
      this.set('blitzer', { note: `Details ab Zoomstufe ${CAM_DETAIL_ZOOM} · messpunktgenau, mobile Blitzer fehlen` });
      return;
    }
    const b = this.viewBounds();
    const key = Object.values(b).join(',');
    if (key === this.blitzerKey) return;
    this.blitzerKey = key;
    this.set('blitzer', { loading: true, note: undefined });
    loadSpeedcams(b)
      .then((fc) => {
        if (this.blitzerKey !== key) return;
        this.setData('blitzer', fc);
        const notes = ['Lageplan – keine Fahrwarnung (in DE verboten während der Fahrt)'];
        if (!fc.features.length) notes.unshift('keine Anlagen im Ausschnitt erfasst');
        this.set('blitzer', { loading: false, count: fc.features.length, note: notes.join(' · ') });
      })
      .catch((e) => {
        if (isSuperseded(e) || this.blitzerKey !== key) return;
        console.warn('Overpass Blitzer', e);
        this.blitzerKey = '';
        this.set('blitzer', { loading: false, note: 'OpenStreetMap (Overpass) nicht erreichbar' });
      });
  }

  // -------------------------------------------------------------------------
  // Clicks

  click(f: MapGeoJSONFeature, at: { lng: number; lat: number }): ClickResult | null {
    const pt = f.geometry.type === 'Point' ? (f.geometry as Point).coordinates : [at.lng, at.lat];
    const tileCam = f.layer.id.startsWith('alpr-dots-');
    const p = (tileCam ? alprTileProps(f.properties, pt[0], pt[1]) : f.properties) as Record<string, unknown>;
    const html = (glyph: GlyphId, color: string, extra?: string) =>
      cardHtml({ glyph, color, title: p.title, subtitle: p.subtitle, date: p.date, description: p.description, source: p.source, url: p.url, extra });
    const handler = CLICK_HANDLERS.get(f.layer.id);
    if (handler) return handler({ ctx: this.ctx, layerId: f.layer.id, p, pt, at, html });
    switch (tileCam ? 'alpr' : f.layer.id) {
      case 'sondes':
        return { type: 'sonde', serial: String(p.serial ?? ''), lng: pt[0], lat: pt[1] };
      case 'aircraft':
      case 'aircraft-vehicle':
      case 'ap3d-hit':
        return { type: 'flight', hex: String(p.hex), lng: pt[0], lat: pt[1] };
      case 'sats-icon':
      case 'sats-dot': {
        const sat = [...this.sats, ...this.starlink].find((s) => s.id === p.id);
        if (!sat) return null;
        const info = satPopupInfo(sat);
        this.setData('sat-track', groundTrack(sat));
        return {
          type: 'html',
          html: cardHtml({ glyph: 'satellite', color: '#b388ff', title: info.title, subtitle: info.subtitle, description: info.details, source: 'CelesTrak', url: info.url }),
          lng: pt[0],
          lat: pt[1],
        };
      }
      case 'webcams':
      case 'webcams-osm': {
        const img = safeUrl(p.image);
        // still images are cached by browsers – add a cache-buster (not for signed Windy URLs)
        const src = img && p.kind === 'road' ? `${img}${img.includes('?') ? '&' : '?'}t=${Math.floor(Date.now() / 60000)}` : img;
        const video = safeUrl(p.video);
        const dir = Number(p.dir);
        const subtitle = dir >= 0 ? [p.subtitle, `Blickrichtung ${Math.round(dir)}° (${CARDINAL[Math.round(dir / 45) % 8]})`].filter(Boolean).join(' · ') : p.subtitle;
        const extra = video
          ? `<video class="pop-cam" src="${escapeHtml(video)}" ${src ? `poster="${escapeHtml(src)}"` : ''} autoplay muted loop playsinline controls></video>`
          : src
          ? `<a class="pop-cam" href="${escapeHtml(safeUrl(p.url) ?? img)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(src)}" alt="Webcam-Bild" loading="lazy" referrerpolicy="no-referrer"></a>`
          : `<a class="btn small pop-cam-link" href="${escapeHtml(safeUrl(p.url) ?? '#')}" target="_blank" rel="noopener noreferrer">Webcam öffnen ↗</a>`;
        return { type: 'html', html: cardHtml({ glyph: 'webcam', color: '#00bfa5', title: p.title, subtitle, date: p.updated, source: p.source, url: p.url, extra }), lng: pt[0], lat: pt[1] };
      }
      case 'alpr': {
        const dir = Number(p.dir);
        const card = dir >= 0 ? CARDINAL[Math.round(dir / 45) % 8] : '';
        const rows = [
          ['Hersteller', p.brand],
          ['Betreiber', p.operator],
          ['Bereich', ALPR_ZONE[String(p.zone)] ?? p.zone],
          ['Montage', ALPR_MOUNT[String(p.mount)] ?? p.mount],
          ['Blickrichtung', dir >= 0 ? `${Math.round(dir)}° (${card})` : ''],
          ['Seit', p.since],
          ['Kennung', p.ref],
          ['Position', `${(pt[1] as number).toFixed(5)}, ${(pt[0] as number).toFixed(5)}`],
        ].filter(([, v]) => v);
        const photo = alprVendorImg(String(p.brand ?? ''));
        const extra = `${photo ? `<div class="pop-cam"><img src="${escapeHtml(photo)}" alt="${escapeHtml(String(p.brand))} (Beispielfoto)" loading="lazy" referrerpolicy="no-referrer"></div>` : ''}${rows.length ? `<div class="pop-grid two">${rows.map(([k, v]) => `<span>${k}</span><b>${escapeHtml(String(v))}</b>`).join('')}</div>` : ''}
          <div class="pop-foot"><a href="${escapeHtml(safeUrl(p.deflock) ?? '#')}" target="_blank" rel="noopener noreferrer">Auf DeFlock ansehen ↗</a></div>`;
        return { type: 'html', html: cardHtml({ glyph: 'alpr', color: p.flock ? ALPR_RED : '#ff9800', title: p.title, subtitle: p.subtitle, source: 'OpenStreetMap / DeFlock (Beispielfoto: deflock.org)', url: p.url, extra }), lng: pt[0], lat: pt[1] };
      }
      case 'blitzer': {
        const dir = Number(p.dir);
        const card = dir >= 0 ? CARDINAL[Math.round(dir / 45) % 8] : '';
        const raw = String(p.speed ?? '');
        const unit = /^\d+(\.\d+)?$/.test(raw) ? ' km/h' : '';
        const speed = /\d/.test(raw) ? `${raw}${unit}` : '';
        const rows = [
          ['Tempo', speed === 'no' || speed === 'none' ? '' : speed ? `${speed} km/h` : ''],
          ['Blickrichtung', dir >= 0 ? `${Math.round(dir)}° (${card})` : ''],
          ['Betreiber', p.operator],
          ['Kennung', p.ref],
          ['Position', `${(pt[1] as number).toFixed(5)}, ${(pt[0] as number).toFixed(5)}`],
        ].filter(([, v]) => v);
        const extra = `${rows.length ? `<div class="pop-grid two">${rows.map(([k, v]) => `<span>${k}</span><b>${escapeHtml(String(v))}</b>`).join('')}</div>` : ''}
          <div class="pop-sub">Lageplan – keine Fahrwarnung: Nutzung während der Fahrt in DE verboten (§ 23 StVO)</div>`;
        return { type: 'html', html: cardHtml({ glyph: 'blitzer', color: p.kind === 'section' ? '#fb8c00' : p.kind === 'signals' ? '#ba68c8' : CAM_ZOOM_RED, title: p.title, subtitle: p.subtitle, source: 'OpenStreetMap (ODbL)', url: p.url, extra }), lng: pt[0], lat: pt[1] };
      }
      case 'lightning': {
        const at = Number(p.at);
        const secs = Math.max(0, Math.round((Date.now() - at) / 1000));
        const ago = secs < 90 ? `vor ${secs} s` : `vor ${Math.round(secs / 60)} min`;
        const n = Number(p.n);
        const d = this.lightning?.delay;
        const extra = `<div class="pop-grid two"><span>Zeitpunkt</span><b>${new Date(at).toLocaleTimeString('de-DE')} Uhr (${ago})</b><span>Position</span><b>${fmt.num(pt[1], 3)}°, ${fmt.num(pt[0], 3)}°</b>${Number.isFinite(n) && n > 0 ? `<span>Detektoren</span><b>${n} Stationen</b>` : ''}${d != null ? `<span>Verzögerung</span><b>~${fmt.num(d, 1)} s</b>` : ''}</div>`;
        return { type: 'html', html: cardHtml({ glyph: 'bolt', color: '#ffd600', title: 'Blitzeinschlag', source: 'Blitzortung.org', url: 'https://www.blitzortung.org/', extra }), lng: pt[0], lat: pt[1] };
      }
      case 'airports-minor':
      case 'airports-far-1':
      case 'airports-far-2':
      case 'airports-far-3':
      case 'airports': {
        const icao = String(p.icao ?? '');
        const name = String(p['name:de'] ?? p.name ?? 'Flughafen');
        const code = [p.iata, icao].filter(Boolean).join(' / ');
        return {
          type: 'html',
          html: cardHtml({
            glyph: 'airport',
            color: '#90caf9',
            title: name,
            subtitle: [code, p.ele != null ? `${p.ele} m ü. NN` : ''].filter(Boolean).join(' · '),
            source: 'OpenStreetMap, OpenSky Network',
            url: icao ? `https://opensky-network.org/network/explorer?airport=${encodeURIComponent(icao)}` : undefined,
            extra: icao ? '<div class="pop-loading small">Flüge vom Vortag werden geladen …</div>' : '',
          }),
          lng: pt[0],
          lat: pt[1],
          after: (node) => {
            if (!icao) return;
            loadAirportFlights(icao)
              .then((r) => {
                const list = (l: { callsign: string; other: string; time: number }[], arrow: string) =>
                  l
                    .slice(0, 6)
                    .map((f) => `<span>${escapeHtml(new Date(f.time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }))}</span><b>${escapeHtml(f.callsign || '–')} ${arrow} ${escapeHtml(f.other)}</b>`)
                    .join('');
                const el = node.querySelector('.pop-loading');
                if (!el) return;
                el.outerHTML = r.departures.length + r.arrivals.length
                  ? `<div class="small muted">Vortag: ${r.departures.length} Abflüge, ${r.arrivals.length} Ankünfte</div>
                     ${r.departures.length ? `<div class="pop-sub">Letzte Abflüge</div><div class="pop-grid two">${list(r.departures, '→')}</div>` : ''}
                     ${r.arrivals.length ? `<div class="pop-sub">Letzte Ankünfte</div><div class="pop-grid two">${list(r.arrivals, '←')}</div>` : ''}`
                  : '<div class="small muted">Keine Flugdaten vom Vortag verfügbar.</div>';
              })
              .catch(() => {
                const el = node.querySelector('.pop-loading');
                if (el) el.textContent = 'OpenSky gerade nicht erreichbar (Tageskontingent ohne Konto begrenzt).';
              });
          },
        };
      }
      case 'ports': {
        const row = (k: string, v: unknown, unit = '') => (v === '' || v == null ? null : [k, `${v}${unit}`]);
        const rows = [
          row('Größe', p.size),
          row('Hafentyp', p.type),
          row('Fahrwassertiefe', p.channel, ' m'),
          row('Pier-Tiefe', p.pier, ' m'),
          row('Größtes Schiff', p.length, ' m lang'),
          row('Max. Tiefgang', p.draft, ' m'),
          row('Lotsen', p.pilot),
          row('Schutz', p.shelter),
          row('Umschlag', p.fac),
        ].filter(Boolean) as string[][];
        const extra = rows.length ? `<div class="pop-grid two">${rows.map(([k, v]) => `<span>${k}</span><b>${escapeHtml(v)}</b>`).join('')}</div>` : '';
        return {
          type: 'html',
          html: cardHtml({
            glyph: 'vessel',
            color: '#ffb74d',
            title: p.name,
            subtitle: [p.code, p.country].filter(Boolean).join(' · '),
            source: p.wpi ? 'NGA World Port Index' : 'UN/LOCODE (Upply, CC BY 4.0)',
            extra,
          }),
          lng: pt[0],
          lat: pt[1],
        };
      }
      case 'ships':
        return { type: 'ship', mmsi: Number(p.mmsi), lng: pt[0], lat: pt[1] };
      case 'trains':
      case 'transit-veh': {
        if (p.src === 'transitous' || p.src === 'amtrak' || p.src === 'gps') return this.vehicleCard(p, pt);
        const num = Number(p.num);
        return {
          type: 'html',
          html: cardHtml({
            glyph: 'train',
            color: '#ffca28',
            title: `Zug ${num}`,
            subtitle: `${fmt.num(Number(p.speed))} km/h`,
            source: 'Fintraffic Digitraffic',
            url: `https://www.junat.net/en/train/${num}`,
            extra: '<div class="pop-loading small">Details werden geladen …</div>',
          }),
          lng: pt[0],
          lat: pt[1],
          after: (node) => {
            loadTrainDetails(num, String(p.date))
              .then((d) => {
                const el = node.querySelector('.pop-loading');
                if (!el || !d) return el?.remove();
                const head = node.querySelector('.pop-head b');
                if (head) head.textContent = d.title;
                const rows = [
                  ['Art', d.category],
                  ['Strecke', d.from && d.to ? `${d.from} → ${d.to}` : ''],
                  ['Zuletzt', d.lastStation],
                  ['Verspätung', d.delay != null ? (d.delay > 0 ? `+${d.delay} min` : 'pünktlich') : ''],
                ].filter(([, v]) => v);
                el.outerHTML = `<div class="pop-grid two">${rows.map(([k, v]) => `<span>${k}</span><b>${escapeHtml(v)}</b>`).join('')}</div>`;
              })
              .catch(() => node.querySelector('.pop-loading')?.remove());
          },
        };
      }
      case 'power':
      case 'osm-power': {
        const glyph: GlyphId = p.cat === 'wind' ? 'wind' : p.cat === 'solar' ? 'solar' : p.cat === 'hydro' ? 'hydro' : p.cat === 'nuclear' ? 'radiation' : 'plant';
        return { type: 'html', html: html(glyph, String(p.color)), lng: pt[0], lat: pt[1] };
      }
    }
    return null;
  }

  private vehicleCard(p: Record<string, unknown>, pt: number[]): ClickResult {
    const st = modeStyle(String(p.mode));
    const t = (ms: unknown) => new Date(Number(ms)).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const delay = Number(p.delay);
    const rows =
      p.src === 'amtrak' || p.src === 'gps'
        ? [
            ['Art', st.label],
            ...(p.src === 'gps' ? [['Von', p.from], ['Nach', p.to], ['Verspätung', delay === -999 ? '' : delay > 0 ? `+${delay} min` : 'pünktlich']] : []),

            ['Strecke', p.from && p.to ? `${p.from} → ${p.to}` : ''],
            ['Geschwindigkeit', p.speed != null ? `${p.speed} km/h` : ''],
            ['Status', p.timely],
          ]
        : [
            ['Art', st.label],
            ['Abschnitt', `${p.from} → ${p.to}`],
            ['Ankunft', `${t(p.arr)} Uhr`],
            ['Verspätung', delay === -999 ? 'keine Echtzeitdaten' : delay > 0 ? `+${delay} min` : delay < 0 ? `${delay} min` : 'pünktlich'],
          ];
    const extra = `<div class="pop-grid two">${rows
      .filter(([, v]) => v)
      .map(([k, v]) => `<span>${k}</span><b>${escapeHtml(v)}</b>`)
      .join('')}</div>${p.src === 'transitous' ? '<div class="small muted">Position aus Echtzeitfahrplan berechnet</div>' : ''}`;
    return {
      type: 'html',
      html: cardHtml({
        glyph: 'train',
        color: String(p.color ?? st.color),
        title: p.name,
        source: p.src === 'amtrak' ? 'Amtraker (Amtrak-GPS)' : p.src === 'gps' ? `${p.feed} (GPS)` : 'Transitous',
        url: p.src === 'amtrak' ? 'https://amtraker.com/' : p.src === 'gps' ? undefined : 'https://transitous.org/',
        extra,
      }),
      lng: pt[0],
      lat: pt[1],
    };
  }

  clearSelection() {
    this.setData('sat-track', empty());
  }
}
