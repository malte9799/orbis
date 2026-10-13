import type { ExpressionSpecification, GeoJSONSource, LayerSpecification, Map as MlMap, MapGeoJSONFeature } from 'maplibre-gl';
import type { FeatureCollection, Point } from 'geojson';
import { loadCityAirQuality, loadCityWeather, loadDwdWarnings, loadPegel } from '../api/europe';
import { cableUrl, FUELS, loadCableDetails, loadCables, loadIxps, loadOsmPower, loadPowerPlants, loadShippingLanes, type PowerCat } from '../api/infra';
import { groundTrack, loadAircraft, loadSatellites, loadSatGroup, loadSondes, satelliteFeatures, satPopupInfo, type Sat } from '../api/tracking';
import { ALPR_SOURCE_LAYER, ALPR_TILES_CA, ALPR_TILES_US, hasWindyKey, loadAlpr, loadDigitrafficCams, loadOsmWebcams, loadWindyWebcams } from '../api/cams';
import { loadAurora, loadFirePerimeters, loadGvpVolcanoes, loadRadiation, loadTsunami } from '../api/earth';
import {
  AisStream,
  countdown,
  hasAisKey,
  loadAirportFlights,
  loadDigitrafficShips,
  loadLaunches,
  loadTrainDetails,
  loadTrains,
  SHIP_LABELS,
  shipFeatures,
  type Launch,
  type Ship,
  type ShipCat,
} from '../api/transport';
import { escapeHtml, fmt, safeUrl } from '../util';
import { weatherIcon } from '../weather';
import { ensureWeatherIcons, registerSilhouettes, type GlyphId } from './icons';
import { cardHtml } from './popup';
import { FONT_BOLD, FONT_REGULAR } from './vector';

// Additional map content beyond weather: European measurements, live air/space traffic and
// infrastructure. Every source is free and keyless.

export type ExtraId =
  | 'cities'
  | 'dwdwarn'
  | 'gauges'
  | 'aq'
  | 'aircraft'
  | 'sondes'
  | 'sats'
  | 'starlink'
  | 'shipping'
  | 'cables'
  | 'wind'
  | 'solar'
  | 'plants'
  | 'webcams'
  | 'alpr'
  | 'aurora'
  | 'gvp'
  | 'fireareas'
  | 'tsunami'
  | 'radiation'
  | 'launches'
  | 'airports'
  | 'ships'
  | 'trains';

export type SectionId = 'europe' | 'earth' | 'air' | 'infra' | 'cams';

export interface ExtraDef {
  id: ExtraId;
  section: SectionId;
  label: string;
  hint: string;
  glyph: GlyphId;
  color: string;
}

export const SECTIONS: { id: SectionId; title: string }[] = [
  { id: 'europe', title: 'Europa & Messwerte' },
  { id: 'earth', title: 'Erde & Umwelt' },
  { id: 'air', title: 'Luftraum & Weltraum' },
  { id: 'infra', title: 'Verkehr & Infrastruktur' },
  { id: 'cams', title: 'Kameras' },
];

export const EXTRAS: ExtraDef[] = [
  { id: 'cities', section: 'europe', label: 'Städtewetter', hint: 'aktuelles Wetter in ~200 Städten', glyph: 'city', color: '#5b9dff' },
  { id: 'dwdwarn', section: 'europe', label: 'Unwetterwarnungen DE', hint: 'Deutscher Wetterdienst, amtlich', glyph: 'warn', color: '#e53935' },
  { id: 'gauges', section: 'europe', label: 'Pegel & Hochwasser DE', hint: 'PEGELONLINE, Bundeswasserstraßen', glyph: 'gauge', color: '#3d9ad1' },
  { id: 'aq', section: 'europe', label: 'Luftqualität & Pollen', hint: 'europäische Städte – Copernicus CAMS', glyph: 'air', color: '#50c878' },
  { id: 'aurora', section: 'earth', label: 'Polarlicht', hint: 'Vorhersage für die nächste Stunde – NOAA SWPC', glyph: 'aurora', color: '#3ddc84' },
  { id: 'gvp', section: 'earth', label: 'Alle Vulkane', hint: '~1.300 Vulkane mit letztem Ausbruch – Smithsonian GVP', glyph: 'volcano', color: '#ff7043' },
  { id: 'fireareas', section: 'earth', label: 'Brandflächen USA', hint: 'aktuelle Waldbrand-Umrisse – NIFC', glyph: 'fire', color: '#ff5722' },
  { id: 'tsunami', section: 'earth', label: 'Tsunami-Meldungen', hint: 'NOAA-Tsunamiwarnzentren, letzte 7 Tage', glyph: 'tsunami', color: '#1e88e5' },
  { id: 'radiation', section: 'earth', label: 'Radioaktivität', hint: 'Ortsdosisleistung – BfS (DE), Safecast (weltweit)', glyph: 'radiation', color: '#c0ca33' },
  { id: 'aircraft', section: 'air', label: 'Flugzeuge & Hubschrauber', hint: 'live, ADS-B – adsb.lol, adsb.fi, airplanes.live, OpenSky', glyph: 'plane', color: '#f2c94c' },
  { id: 'sondes', section: 'air', label: 'Wetterballons', hint: 'Radiosonden live – SondeHub', glyph: 'sonde', color: '#ff8fab' },
  { id: 'launches', section: 'air', label: 'Raketenstarts', hint: 'nächste Starts weltweit mit Countdown – The Space Devs', glyph: 'rocket', color: '#ff6e40' },
  { id: 'airports', section: 'air', label: 'Flughäfen', hint: 'mit Abflügen & Ankünften vom Vortag – OpenSky', glyph: 'airport', color: '#90caf9' },
  { id: 'sats', section: 'air', label: 'Satelliten', hint: 'ISS, Wetter-, GPS-, Galileo-Satelliten', glyph: 'satellite', color: '#b388ff' },
  { id: 'starlink', section: 'air', label: 'Starlink', hint: 'tausende Satelliten – CelesTrak', glyph: 'satellite', color: '#7e8aa8' },
  { id: 'ships', section: 'infra', label: 'Schiffe live (AIS)', hint: 'Ostsee frei (Fintraffic), weltweit mit kostenlosem aisstream-Schlüssel', glyph: 'vessel', color: '#4dd0e1' },
  { id: 'trains', section: 'infra', label: 'Züge live (Finnland)', hint: 'GPS-Position aller Züge – Fintraffic', glyph: 'train', color: '#ffca28' },
  { id: 'shipping', section: 'infra', label: 'Schiffsrouten & Fähren', hint: 'Hauptschifffahrtswege, Fährlinien (OSM)', glyph: 'ship', color: '#26c6da' },
  { id: 'cables', section: 'infra', label: 'Seekabel & Internetknoten', hint: 'TeleGeography, PeeringDB', glyph: 'cable', color: '#9c6bff' },
  { id: 'wind', section: 'infra', label: 'Windkraft', hint: 'Windparks, beim Zoomen einzelne Anlagen', glyph: 'wind', color: FUELS.Wind.color },
  { id: 'solar', section: 'infra', label: 'Solarparks', hint: 'Photovoltaik-Kraftwerke', glyph: 'solar', color: FUELS.Solar.color },
  { id: 'plants', section: 'infra', label: 'Weitere Kraftwerke', hint: 'Kern, Kohle, Gas, Wasser, Biomasse …', glyph: 'plant', color: FUELS.Nuclear.color },
  { id: 'webcams', section: 'cams', label: 'Live-Webcams', hint: 'Fintraffic, OpenStreetMap, optional Windy (kostenloser Schlüssel)', glyph: 'webcam', color: '#00bfa5' },
  { id: 'alpr', section: 'cams', label: 'Kennzeichen-Kameras', hint: 'ALPR/Flock-Kameras aus OpenStreetMap – DeFlock-Community', glyph: 'alpr', color: '#ef4444' },
];

const LAYERS: Record<ExtraId, string[]> = {
  cities: ['cities'],
  dwdwarn: ['dwd-warn-fill', 'dwd-warn-line'],
  gauges: ['gauges'],
  aq: ['aq-circle', 'aq-text'],
  aircraft: ['aircraft'],
  sondes: ['sondes'],
  sats: ['sats-icon', 'sats-label', 'sat-track'],
  starlink: ['sats-dot', 'sat-track'],
  shipping: ['ship-lanes', 'ferries'],
  cables: ['cables', 'landings', 'ixp'],
  wind: ['power', 'osm-power'],
  solar: ['power', 'osm-power'],
  plants: ['power', 'osm-power'],
  webcams: ['webcams', 'webcams-osm'],
  aurora: ['aurora'],
  gvp: ['gvp'],
  fireareas: ['fireareas-fill', 'fireareas-line'],
  tsunami: ['tsunami-ring', 'tsunami'],
  radiation: ['radiation', 'radiation-label'],
  launches: ['launches'],
  airports: ['airports'],
  ships: ['ships'],
  trains: ['trains'],
  alpr: ['alpr-heat', 'alpr-dots', 'alpr-cone', 'alpr'],
};

const POWER_CAT: Partial<Record<ExtraId, PowerCat>> = { wind: 'wind', solar: 'solar', plants: 'other' };

/** Interactive layers this module answers clicks for. */
export const EXTRA_CLICK_LAYERS = ['cities', 'dwd-warn-fill', 'gauges', 'aq-circle', 'aircraft', 'sondes', 'sats-icon', 'sats-dot', 'cables', 'ixp', 'power', 'osm-power', 'webcams', 'webcams-osm', 'alpr', 'gvp', 'fireareas-fill', 'tsunami', 'radiation', 'launches', 'airports', 'ships', 'trains'];

/** Zoom from which cameras are loaded for the visible area (Overpass). */
const CAM_DETAIL_ZOOM = 9;

export type ClickResult =
  | { type: 'html'; html: string; lng: number; lat: number; after?: (node: HTMLElement) => void }
  | { type: 'weather'; lng: number; lat: number };

interface Info {
  count?: number;
  loading?: boolean;
  note?: string;
  at?: number;
}

const empty = (): FeatureCollection => ({ type: 'FeatureCollection', features: [] });

const ALT_COLOR: ExpressionSpecification = [
  'case',
  ['get', 'ground'],
  '#9aa3b5',
  ['interpolate', ['linear'], ['get', 'altM'], 0, '#ffd23f', 3000, '#7bd389', 8000, '#4fc3f7', 12000, '#b388ff'],
];

export class ExtraLayers {
  private on = new Set<ExtraId>();
  private info: Partial<Record<ExtraId, Info>> = {};
  private timers: Partial<Record<string, number>> = {};
  private sats: Sat[] = [];
  private starlink: Sat[] = [];
  private satsLoading: Promise<void> | null = null;
  private starlinkLoading: Promise<void> | null = null;
  private powerLoaded = false;
  private powerLoading: Promise<void> | null = null;
  private powerCounts: Record<PowerCat, number> = { wind: 0, solar: 0, other: 0 };
  private osmPowerKey = '';
  private aircraftSeq = 0;
  private ready = false;
  private fiCams: FeatureCollection = empty();
  private windyCams: FeatureCollection = empty();
  private camKey = '';
  private osmCamCount = 0;
  private windyKey = '';
  private alprKey = '';
  private alprTilesAdded = false;
  private alprTilesFailed = false;
  private launchData: FeatureCollection | null = null;
  private baltic: Ship[] = [];
  private ais: AisStream | null = null;

  constructor(
    private map: MlMap,
    private hooks: { changed(): void; toast(msg: string): void },
  ) {}

  /** Adds runtime sources/layers; call once after the style has loaded. */
  init() {
    const m = this.map;
    registerSilhouettes(m);
    const ATTR: Record<string, string> = {
      'ship-lanes': 'Schiffsrouten: <a href="https://doi.org/10.5281/zenodo.6361763">P. Benden, CC BY 4.0</a>',
      cables: 'Seekabel: <a href="https://www.submarinecablemap.com/">TeleGeography</a>',
      ixp: 'Internetknoten: <a href="https://www.peeringdb.com/">PeeringDB</a>',
      power: 'Kraftwerke: <a href="https://datasets.wri.org/dataset/globalpowerplantdatabase">WRI GPPD, CC BY 4.0</a>',
      aircraft: 'Flugdaten: <a href="https://adsb.lol/">adsb.lol</a> (ODbL), <a href="https://adsb.fi/">adsb.fi</a>, <a href="https://airplanes.live/">airplanes.live</a>, <a href="https://opensky-network.org/">OpenSky</a>',
      sondes: 'Radiosonden: <a href="https://sondehub.org/">SondeHub</a>',
      sats: 'Bahndaten: <a href="https://celestrak.org/">CelesTrak</a>',
      webcams: 'Webcams: <a href="https://www.digitraffic.fi/">Fintraffic Digitraffic</a> (CC BY 4.0), <a href="https://www.windy.com/webcams">Windy.com</a>',
      'webcams-osm': 'Webcams: © OpenStreetMap',
      alpr: 'ALPR: © OpenStreetMap-Mitwirkende, <a href="https://deflock.org/">DeFlock</a>',
      aurora: 'Polarlicht: <a href="https://www.swpc.noaa.gov/products/aurora-30-minute-forecast">NOAA SWPC</a>',
      gvp: 'Vulkane: <a href="https://volcano.si.edu/">Smithsonian GVP</a>',
      fireareas: 'Brandflächen: <a href="https://data-nifc.opendata.arcgis.com/">NIFC</a>',
      tsunami: 'Tsunami: <a href="https://www.tsunami.gov/">NOAA</a>',
      radiation: 'Radioaktivität: <a href="https://odlinfo.bfs.de/">BfS</a> (DL-DE 2.0), <a href="https://safecast.org/">Safecast</a> (CC0)',
      launches: 'Raketenstarts: <a href="https://thespacedevs.com/">The Space Devs</a>',
      ships: 'AIS: <a href="https://www.digitraffic.fi/">Fintraffic</a> (CC BY 4.0), <a href="https://aisstream.io/">aisstream.io</a>',
      trains: 'Züge: <a href="https://www.digitraffic.fi/">Fintraffic</a> (CC BY 4.0)',
    };
    for (const id of ['ship-lanes', 'cables', 'landings', 'ixp', 'power', 'osm-power', 'aircraft', 'sondes', 'sats', 'sat-track', 'webcams', 'webcams-osm', 'alpr', 'aurora', 'gvp', 'fireareas', 'tsunami', 'radiation', 'launches', 'ships', 'trains']) {
      if (!m.getSource(id)) m.addSource(id, { type: 'geojson', data: empty(), attribution: ATTR[id] });
    }
    const hidden = { visibility: 'none' as const };
    const add = (layer: LayerSpecification, before?: string) => {
      if (!m.getLayer(layer.id)) m.addLayer(layer, before && m.getLayer(before) ? before : undefined);
    };
    // lines: above weather, below labels
    add(
      {
        id: 'ship-lanes',
        type: 'line',
        source: 'ship-lanes',
        layout: { ...hidden, 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': 'rgba(110, 210, 255, 0.75)',
          'line-width': ['match', ['get', 'type'], 'major', 2.2, 'middle', 1.4, 0.8],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 1, 0.6, 6, 0.9],
        },
      },
      'lbl-border-country',
    );
    add(
      {
        id: 'ferries',
        type: 'line',
        source: 'ofm',
        'source-layer': 'transportation',
        minzoom: 4,
        filter: ['==', ['get', 'class'], 'ferry'],
        layout: hidden,
        paint: { 'line-color': 'rgba(150, 240, 255, 0.85)', 'line-width': 1.2, 'line-dasharray': [3, 2] },
      },
      'lbl-border-country',
    );
    add(
      {
        id: 'cables',
        type: 'line',
        source: 'cables',
        layout: { ...hidden, 'line-join': 'round' },
        paint: {
          'line-color': ['coalesce', ['get', 'color'], '#9c6bff'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 1, 1, 6, 2.2],
          'line-opacity': 0.85,
        },
      },
      'lbl-border-country',
    );
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
    add(
      {
        id: 'landings',
        type: 'circle',
        source: 'landings',
        minzoom: 2,
        layout: hidden,
        paint: { 'circle-color': '#ffffff', 'circle-radius': 2.2, 'circle-stroke-color': '#9c6bff', 'circle-stroke-width': 1 },
      },
      'gauges',
    );
    add(
      {
        id: 'ixp',
        type: 'circle',
        source: 'ixp',
        layout: { ...hidden, 'circle-sort-key': ['get', 'nets'] },
        paint: {
          'circle-color': '#e040fb',
          'circle-radius': ['interpolate', ['linear'], ['get', 'nets'], 0, 3, 100, 6, 1000, 12],
          'circle-opacity': 0.8,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1,
        },
      },
      'gauges',
    );
    // earth & environment
    add(
      {
        id: 'aurora',
        type: 'heatmap',
        source: 'aurora',
        layout: hidden,
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'v'], 3, 0.05, 30, 0.6, 90, 1],
          'heatmap-radius': ['interpolate', ['exponential', 2], ['zoom'], 0, 6, 3, 30, 6, 160],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 0.9, 5, 0.6],
          'heatmap-opacity': 0.8,
          'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,255,120,0)', 0.15, 'rgba(0,255,120,0.35)', 0.45, 'rgba(60,255,140,0.75)', 0.75, '#d4ff5a', 1, '#ff5ac8'],
        },
      },
      'lbl-border-country',
    );
    add(
      {
        id: 'fireareas-fill',
        type: 'fill',
        source: 'fireareas',
        layout: hidden,
        paint: { 'fill-color': '#ff3d00', 'fill-opacity': 0.4 },
      },
      'lbl-border-country',
    );
    add(
      {
        id: 'fireareas-line',
        type: 'line',
        source: 'fireareas',
        layout: hidden,
        paint: { 'line-color': '#ffab40', 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 10, 2] },
      },
      'lbl-border-country',
    );
    add(
      {
        id: 'gvp',
        type: 'circle',
        source: 'gvp',
        layout: { ...hidden, 'circle-sort-key': ['match', ['get', 'state'], 'recent', 3, 'historic', 2, 1] },
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, ['match', ['get', 'state'], 'recent', 4.5, 'historic', 3, 2], 8, ['match', ['get', 'state'], 'recent', 9, 'historic', 7, 5]],
          'circle-stroke-color': ['match', ['get', 'state'], 'recent', '#ffffff', 'rgba(0,0,0,0.5)'],
          'circle-stroke-width': 1,
        },
      },
      'gauges',
    );
    add(
      {
        id: 'radiation',
        type: 'circle',
        source: 'radiation',
        layout: { ...hidden, 'circle-sort-key': ['get', 'v'] },
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 3, 9, 7],
          'circle-stroke-color': 'rgba(0,0,0,0.55)',
          'circle-stroke-width': 1,
        },
      },
      'gauges',
    );
    add(
      {
        id: 'radiation-label',
        type: 'symbol',
        source: 'radiation',
        minzoom: 8,
        layout: { ...hidden, 'text-field': ['get', 'label'], 'text-font': FONT_BOLD, 'text-size': 10, 'text-offset': [0, 1.2], 'text-anchor': 'top', 'text-optional': true },
        paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1.2 },
      },
      'marker',
    );
    add(
      {
        id: 'tsunami-ring',
        type: 'circle',
        source: 'tsunami',
        layout: hidden,
        paint: { 'circle-color': 'rgba(0,0,0,0)', 'circle-radius': 16, 'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': 3, 'circle-stroke-opacity': 0.8 },
      },
      'marker',
    );
    add(
      {
        id: 'tsunami',
        type: 'symbol',
        source: 'tsunami',
        layout: { ...hidden, 'icon-image': 'glyph-tsunami', 'icon-size': 0.8, 'icon-allow-overlap': true },
      },
      'marker',
    );
    // transport
    add(
      {
        id: 'airports',
        type: 'symbol',
        source: 'ofm',
        'source-layer': 'aerodrome_label',
        minzoom: 3,
        filter: [
          'all',
          ['has', 'iata'],
          ['any', ['==', ['get', 'class'], 'international'], ['all', ['>=', ['zoom'], 6], ['==', ['get', 'class'], 'public']], ['>=', ['zoom'], 8]],
        ],
        layout: {
          ...hidden,
          'icon-image': 'glyph-airport',
          'icon-size': ['interpolate', ['linear'], ['zoom'], 3, 0.5, 9, 0.8],
          'text-field': ['step', ['zoom'], '', 5, ['get', 'iata']],
          'text-font': FONT_BOLD,
          'text-size': 10,
          'text-offset': [0, 1.1],
          'text-anchor': 'top',
          'text-optional': true,
          'symbol-sort-key': ['match', ['get', 'class'], 'international', 0, 1],
        },
        paint: { 'text-color': '#cfe6ff', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1.2 },
      },
      'marker',
    );
    add(
      {
        id: 'trains',
        type: 'symbol',
        source: 'trains',
        layout: {
          ...hidden,
          'icon-image': 'glyph-train',
          'icon-size': ['interpolate', ['linear'], ['zoom'], 4, 0.45, 10, 0.8],
          'icon-allow-overlap': true,
          'text-field': ['step', ['zoom'], '', 9, ['to-string', ['get', 'num']]],
          'text-font': FONT_BOLD,
          'text-size': 10,
          'text-offset': [0, 1.1],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: { 'text-color': '#ffe082', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1.2 },
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
    add(
      {
        id: 'launches',
        type: 'symbol',
        source: 'launches',
        layout: {
          ...hidden,
          'icon-image': 'glyph-rocket',
          'icon-size': ['interpolate', ['linear'], ['zoom'], 1, 0.7, 8, 1],
          'icon-allow-overlap': true,
          'text-field': ['step', ['zoom'], '', 2, ['get', 'when']],
          'text-font': FONT_BOLD,
          'text-size': 10,
          'text-offset': [0, 1.4],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: { 'text-color': '#ffccbc', 'text-halo-color': 'rgba(0,0,0,0.85)', 'text-halo-width': 1.3 },
      },
      'marker',
    );
    // cameras
    const camIcon = (id: string, source: string): LayerSpecification => ({
      id,
      type: 'symbol',
      source,
      layout: {
        ...hidden,
        'icon-image': 'glyph-webcam',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 3, 0.55, 9, 0.85],
        'icon-allow-overlap': ['step', ['zoom'], false, 8, true],
      },
      paint: { 'icon-opacity': 0.95 },
    });
    add(camIcon('webcams', 'webcams'), 'marker');
    add(camIcon('webcams-osm', 'webcams-osm'), 'marker');
    add(
      {
        id: 'alpr-cone',
        type: 'symbol',
        source: 'alpr',
        minzoom: 13,
        filter: ['>=', ['get', 'dir'], 0],
        layout: {
          ...hidden,
          'icon-image': 'sil-cone',
          'icon-size': ['interpolate', ['exponential', 2], ['zoom'], 13, 1.4, 16, 3.2, 18, 6],
          'icon-rotate': ['get', 'dir'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: { 'icon-color': ['case', ['get', 'flock'], '#ef4444', '#ff9800'], 'icon-opacity': 0.4 },
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
          'circle-color': ['case', ['get', 'flock'], '#ef4444', '#ff9800'],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 3, 14, 6],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 9, 0.6, 14, 1.5],
        },
      },
      'marker',
    );
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
    this.ready = true;
    this.apply();
  }

  isOn(id: ExtraId) {
    return this.on.has(id);
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

  /** Badge text in the panel: count, '…' while loading or empty. */
  badge(id: ExtraId): string {
    const i = this.info[id];
    if (!this.on.has(id) || !i) return '';
    if (i.loading) return '…';
    return i.count != null ? fmt.num(i.count) : '';
  }

  note(id: ExtraId): string | undefined {
    return this.on.has(id) ? this.info[id]?.note : undefined;
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
    if (this.on.has('aircraft')) this.loadAircraftNow();
    if (this.on.has('ships') && this.ais) this.ais.start(this.viewBounds(4));
    if (this.on.has('webcams')) this.loadWebcamsNow();
    if (this.on.has('alpr')) this.loadAlprNow();
    if (this.on.has('wind') || this.on.has('solar') || this.on.has('plants')) this.loadOsmPowerNow();
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
    // power plants share layers – filter by enabled categories
    const cats = (Object.keys(POWER_CAT) as ExtraId[]).filter((id) => this.on.has(id)).map((id) => POWER_CAT[id]!);
    this.map.setFilter('power', ['in', ['get', 'cat'], ['literal', cats]]);
    this.map.setFilter('osm-power', ['in', ['get', 'cat'], ['literal', cats]]);
    if (this.info.dwdwarn?.note && this.on.has('dwdwarn')) this.vis('dwd', true);
    else if (!this.on.has('dwdwarn')) this.vis('dwd', false);

    for (const def of EXTRAS) {
      const on = this.on.has(def.id);
      if (!on) {
        this.clear(def.id);
        continue;
      }
      switch (def.id) {
        case 'cities':
          this.loadOnce('cities', 60 * 60000, () => this.loadCities());
          break;
        case 'dwdwarn':
          this.loadOnce('dwdwarn', 10 * 60000, () => this.loadDwd());
          break;
        case 'gauges':
          this.loadOnce('gauges', 15 * 60000, async () => {
            const fc = await loadPegel();
            this.setData('gauges', fc);
            const high = fc.features.filter((f) => f.properties.state === 'high').length;
            return { count: fc.features.length, note: high ? `${high} Pegel mit Hochwasser` : undefined };
          });
          break;
        case 'aq':
          this.loadOnce('aq', 60 * 60000, async () => {
            const fc = await loadCityAirQuality();
            this.setData('aq', fc);
            return { count: fc.features.length };
          });
          break;
        case 'aircraft':
          this.loadAircraftNow();
          this.every('aircraft', 10000, () => this.loadAircraftNow());
          break;
        case 'sondes':
          this.loadOnce('sondes', 60000, async () => {
            const fc = await loadSondes();
            this.setData('sondes', fc);
            return { count: fc.features.length };
          });
          break;
        case 'sats':
        case 'starlink':
          this.startSatellites();
          break;
        case 'shipping':
          this.loadOnce('shipping', Infinity, async () => {
            const fc = await loadShippingLanes();
            this.setData('ship-lanes', fc);
            return { count: fc.features.length };
          });
          break;
        case 'cables':
          this.loadOnce('cables', Infinity, () => this.loadCablesAndIxps());
          break;
        case 'wind':
        case 'solar':
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
          this.loadWebcamsNow();
          break;
        case 'alpr':
          this.ensureAlprTiles();
          this.loadAlprNow();
          break;
        case 'aurora':
          this.loadOnce('aurora', 15 * 60000, async () => {
            const r = await loadAurora();
            this.setData('aurora', r.fc);
            const t = new Date(r.forecastTime);
            const kp = r.kp != null ? `Kp ${fmt.num(r.kp, 1)}${r.kp >= 5 ? ' – geomagnetischer Sturm!' : ''} · ` : '';
            return { count: undefined, note: `${kp}Vorhersage für ${t.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr` };
          });
          break;
        case 'gvp':
          this.loadOnce('gvp', Infinity, async () => {
            const fc = await loadGvpVolcanoes();
            this.setData('gvp', fc);
            const recent = fc.features.filter((f) => f.properties?.state === 'recent').length;
            return { count: fc.features.length, note: `${recent} mit Ausbruch seit letztem Jahr (rot)` };
          });
          break;
        case 'fireareas':
          this.loadOnce('fireareas', 30 * 60000, async () => {
            const fc = await loadFirePerimeters();
            this.setData('fireareas', fc);
            return { count: fc.features.length, note: fc.features.length ? undefined : 'derzeit keine aktiven Brandflächen' };
          });
          break;
        case 'tsunami':
          this.loadOnce('tsunami', 10 * 60000, async () => {
            const fc = await loadTsunami();
            this.setData('tsunami', fc);
            const warn = fc.features.filter((f) => f.properties?.level === 'warning').length;
            return { count: fc.features.length, note: !fc.features.length ? 'keine Meldungen in den letzten 7 Tagen' : warn ? `${warn} aktive Warnung(en)!` : undefined };
          });
          break;
        case 'radiation':
          this.loadOnce('radiation', 60 * 60000, async () => {
            const r = await loadRadiation();
            this.setData('radiation', r.fc);
            return { count: r.fc.features.length, note: r.failed.length ? `${r.failed.join(', ')} nicht erreichbar` : 'Normalbereich in Deutschland: 0,05–0,18 µSv/h' };
          });
          break;
        case 'launches':
          this.loadOnce('launches', 60 * 60000, async () => {
            this.launchData = await loadLaunches();
            this.updateLaunchLabels();
            return { count: this.launchData.features.length };
          });
          this.every('launch-labels', 60000, () => this.updateLaunchLabels());
          break;
        case 'airports':
          this.set('airports', { note: 'Klick auf einen Flughafen zeigt Abflüge & Ankünfte vom Vortag' });
          break;
        case 'ships':
          this.loadOnce('ships', 60000, () => this.loadShips());
          if (hasAisKey()) {
            this.ais ??= new AisStream(() => this.mergeShips());
            this.ais.start(this.viewBounds(4));
            this.every('ais-push', 3000, () => this.mergeShips());
          }
          break;
        case 'trains':
          this.loadOnce('trains', 15000, async () => {
            const fc = await loadTrains();
            this.setData('trains', fc);
            return { count: fc.features.length };
          });
          break;
      }
    }
    if (!this.on.has('sats') && !this.on.has('starlink')) this.clear('sat-pos');
    if (!this.on.has('launches')) this.clear('launch-labels');
    if (!this.on.has('ships') || !hasAisKey()) {
      this.clear('ais-push');
      this.ais?.stop();
      if (!hasAisKey()) this.ais = null;
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

  private async loadCities() {
    const list = await loadCityWeather();
    await ensureWeatherIcons(
      this.map,
      list.map((c) => ({ code: c.code, isDay: c.isDay })),
      (code, isDay) => weatherIcon(code, isDay, 64),
    );
    this.setData('cities', {
      type: 'FeatureCollection',
      features: list.map((c) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
        properties: { name: c.name, temp: `${Math.round(c.temp)}°`, icon: `wx-${c.code}-${c.isDay ? 'd' : 'n'}`, rank: c.rank },
      })),
    });
    return { count: list.length };
  }

  private async loadDwd() {
    try {
      const fc = await loadDwdWarnings();
      this.setData('dwd-warn', fc);
      this.vis('dwd', false);
      return { count: fc.features.length, note: fc.features.length ? undefined : 'derzeit keine Warnungen' };
    } catch (e) {
      // WFS unavailable – fall back to the rendered WMS image (not clickable)
      console.warn('DWD WFS', e);
      this.vis('dwd', this.on.has('dwdwarn'));
      return { note: 'nur als Kartenbild verfügbar' };
    }
  }

  private loadAircraftNow() {
    const m = this.map;
    if (m.getZoom() < 5) {
      this.setData('aircraft', empty());
      this.set('aircraft', { note: 'zum Anzeigen näher heranzoomen', count: undefined, loading: false });
      return;
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
    if (!this.info.aircraft?.count) this.set('aircraft', { loading: true, note: undefined });
    loadAircraft(c.lat, c.lng, nm)
      .then((fc) => {
        if (seq !== this.aircraftSeq || !this.on.has('aircraft')) return;
        this.setData('aircraft', fc);
        this.set('aircraft', { loading: false, count: fc.features.length, note: `via ${fc.source}${nm > 250 ? ' · nur Umkreis um die Kartenmitte' : ''}` });
      })
      .catch((e) => {
        console.warn('aircraft', e);
        if (seq === this.aircraftSeq)
          this.set('aircraft', { loading: false, note: 'keine Flugdatenquelle erreichbar – ggf. eigenen Proxy in den Einstellungen eintragen' });
      });
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

  private async loadCablesAndIxps() {
    const [cables, ixps] = await Promise.allSettled([loadCables(), loadIxps()]);
    let count = 0;
    const missing: string[] = [];
    if (cables.status === 'fulfilled') {
      this.setData('cables', cables.value.cables);
      this.setData('landings', cables.value.landings);
      count += cables.value.cables.features.length;
    } else missing.push('Seekabel');
    if (ixps.status === 'fulfilled') {
      this.setData('ixp', ixps.value);
      count += ixps.value.features.length;
    } else missing.push('Internetknoten');
    if (missing.length === 2) throw new Error('keine Quelle erreichbar');
    return { count, note: missing.length ? `${missing.join(', ')} nicht erreichbar` : undefined };
  }

  private ensurePower() {
    if (!this.powerLoaded && !this.powerLoading) {
      for (const id of ['wind', 'solar', 'plants'] as ExtraId[]) if (this.on.has(id)) this.set(id, { loading: true });
      this.powerLoading = loadPowerPlants()
        .then((fc) => {
          this.powerLoaded = true;
          this.setData('power', fc);
          this.powerCounts = { wind: 0, solar: 0, other: 0 };
          for (const f of fc.features) this.powerCounts[f.properties!.cat as PowerCat]++;
        })
        .catch(() => this.hooks.toast('Kraftwerksdatenbank konnte nicht geladen werden.'))
        .finally(() => {
          this.powerLoading = null;
          for (const id of ['wind', 'solar', 'plants'] as ExtraId[]) {
            this.set(id, { loading: false, count: this.powerLoaded ? this.powerCounts[POWER_CAT[id]!] : undefined });
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
        console.warn('Overpass', e);
        this.osmPowerKey = '';
      });
  }

  // -------------------------------------------------------------------------
  // Launches, ships

  private updateLaunchLabels() {
    if (!this.launchData) return;
    for (const f of this.launchData.features) f.properties!.when = countdown(String(f.properties!.next));
    this.setData('launches', this.launchData);
  }

  private async loadShips() {
    let note: string | undefined;
    try {
      this.baltic = await loadDigitrafficShips();
    } catch (e) {
      console.warn('Digitraffic AIS', e);
      if (!hasAisKey()) throw e;
      note = 'Fintraffic nicht erreichbar';
    }
    this.mergeShips();
    return { note: note ?? this.info.ships?.note };
  }

  private mergeShips() {
    const all = new Map<number, Ship>();
    for (const s of this.baltic) all.set(s.mmsi, s);
    if (this.ais) for (const s of this.ais.ships.values()) all.set(s.mmsi, s);
    this.setData('ships', shipFeatures(all.values()));
    const notes = [this.ais?.error, !hasAisKey() ? 'außerhalb der Ostsee mit kostenlosem aisstream.io-Schlüssel (Einstellungen)' : 'weltweit live im Kartenausschnitt (aisstream.io)'].filter(Boolean);
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
    const all = { type: 'FeatureCollection' as const, features: [...this.fiCams.features, ...this.windyCams.features] };
    this.setData('webcams', all);
    this.set('webcams', { count: all.features.length + this.osmCamCount || undefined });
    this.updateWebcamNote();
  }

  private updateWebcamNote() {
    const notes: string[] = [];
    if (this.map.getZoom() < CAM_DETAIL_ZOOM) notes.push('Webcams aus OpenStreetMap ab Zoomstufe 9');
    if (!hasWindyKey()) notes.push('weltweit viele weitere mit kostenlosem Windy-Schlüssel (Einstellungen)');
    else if (this.map.getZoom() < 5) notes.push('Windy-Webcams ab Zoomstufe 5');
    this.set('webcams', { note: notes.join(' · ') || undefined });
  }

  private loadWebcamsNow() {
    const m = this.map;
    const z = m.getZoom();
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
            this.osmCamCount = fc.features.length;
            this.mergeWebcams();
          })
          .catch((e) => {
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
          maxzoom: CAM_DETAIL_ZOOM + 0.5,
          paint: {
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 2, 4, 8, 14],
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 2, 0.35, 8, 1],
            'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.85, CAM_DETAIL_ZOOM + 0.5, 0],
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
          maxzoom: CAM_DETAIL_ZOOM,
          paint: { 'circle-color': '#ef4444', 'circle-radius': 1.8, 'circle-opacity': 0.8 },
        },
        'alpr-cone',
      );
    }
    LAYERS.alpr.push('alpr-heat-alpr-us', 'alpr-heat-alpr-ca', 'alpr-dots-alpr-us', 'alpr-dots-alpr-ca');
    this.apply();
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
        const flock = fc.features.filter((f) => f.properties?.flock).length;
        this.set('alpr', { loading: false, count: fc.features.length, note: fc.features.length ? `${flock} davon Flock Safety (im Ausschnitt)` : 'keine Kennzeichen-Kameras im Ausschnitt erfasst' });
      })
      .catch((e) => {
        console.warn('Overpass ALPR', e);
        this.alprKey = '';
        this.set('alpr', { loading: false, note: 'OpenStreetMap (Overpass) nicht erreichbar' });
      });
  }

  // -------------------------------------------------------------------------
  // Clicks

  click(f: MapGeoJSONFeature, at: { lng: number; lat: number }): ClickResult | null {
    const p = f.properties as Record<string, unknown>;
    const pt = f.geometry.type === 'Point' ? (f.geometry as Point).coordinates : [at.lng, at.lat];
    const html = (glyph: GlyphId, color: string, extra?: string) =>
      cardHtml({ glyph, color, title: p.title, subtitle: p.subtitle, date: p.date, description: p.description, source: p.source, url: p.url, extra });
    switch (f.layer.id) {
      case 'cities':
        return { type: 'weather', lng: pt[0], lat: pt[1] };
      case 'dwd-warn-fill':
        return { type: 'html', html: html('warn', String(p.color)), lng: at.lng, lat: at.lat };
      case 'gauges':
        return { type: 'html', html: html('gauge', String(p.color)), lng: pt[0], lat: pt[1] };
      case 'aq-circle':
        return { type: 'html', html: html('air', String(p.color)), lng: pt[0], lat: pt[1] };
      case 'sondes':
        return { type: 'html', html: html('sonde', '#ff8fab') + '', lng: pt[0], lat: pt[1] };
      case 'aircraft': {
        const kindLabel: Record<string, string> = { plane: 'Flugzeug', heli: 'Hubschrauber', glider: 'Segelflugzeug', balloon: 'Ballon', drone: 'Drohne' };
        const rows = [
          ['Typ', p.type || kindLabel[String(p.kind)]],
          ['Kennzeichen', p.reg],
          ['Betreiber', p.operator],
          ['Höhe', p.ground ? 'am Boden' : `${fmt.num(Number(p.altM))} m`],
          ['Geschwindigkeit', p.speedKmh != null ? `${p.speedKmh} km/h` : ''],
          ['Kurs', `${Math.round(Number(p.track))}°`],
          ['Notfall', p.emergency],
        ].filter(([, v]) => v);
        const extra = `<div class="pop-grid two">${rows.map(([k, v]) => `<span>${k}</span><b>${escapeHtml(v)}</b>`).join('')}</div>`;
        const hex = String(p.hex);
        return {
          type: 'html',
          html: cardHtml({
            glyph: (['plane', 'heli', 'glider', 'balloon', 'drone'].includes(String(p.kind)) ? p.kind : 'plane') as GlyphId,
            color: '#f2c94c',
            title: p.callsign,
            extra,
            source: 'adsb.lol (ADS-B Community)',
            url: `https://globe.adsb.lol/?icao=${encodeURIComponent(hex)}`,
          }),
          lng: pt[0],
          lat: pt[1],
        };
      }
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
      case 'cables': {
        const id = String(p.id ?? p.feature_id ?? '');
        const name = String(p.name ?? 'Seekabel');
        return {
          type: 'html',
          html: cardHtml({ glyph: 'cable', color: String(p.color ?? '#9c6bff'), title: name, subtitle: 'Unterseekabel', source: 'TeleGeography', url: id ? cableUrl(id) : undefined, extra: '<div class="pop-loading small">Details werden geladen …</div>' }),
          lng: at.lng,
          lat: at.lat,
          after: (node) => {
            if (!id) return;
            loadCableDetails(id)
              .then((d) => {
                const rows = [
                  ['Länge', d.length],
                  ['In Betrieb seit', d.rfs],
                  ['Betreiber', d.owners],
                  ['Anlandungen', d.landing_points?.map((l) => l.name).slice(0, 8).join(', ')],
                ].filter(([, v]) => v);
                const el = node.querySelector('.pop-loading');
                if (el) el.outerHTML = `<div class="pop-grid two">${rows.map(([k, v]) => `<span>${k}</span><b>${escapeHtml(v)}</b>`).join('')}</div>`;
              })
              .catch(() => node.querySelector('.pop-loading')?.remove());
          },
        };
      }
      case 'ixp':
        return { type: 'html', html: cardHtml({ glyph: 'cable', color: '#e040fb', title: p.title, subtitle: p.subtitle, source: 'PeeringDB', url: p.url }), lng: pt[0], lat: pt[1] };
      case 'webcams':
      case 'webcams-osm': {
        const img = safeUrl(p.image);
        // still images are cached by browsers – add a cache-buster (not for signed Windy URLs)
        const src = img && p.kind === 'road' ? `${img}?t=${Math.floor(Date.now() / 60000)}` : img;
        const extra = src
          ? `<a class="pop-cam" href="${escapeHtml(safeUrl(p.url) ?? img)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(src)}" alt="Webcam-Bild" loading="lazy" referrerpolicy="no-referrer"></a>`
          : `<a class="btn small pop-cam-link" href="${escapeHtml(safeUrl(p.url) ?? '#')}" target="_blank" rel="noopener noreferrer">Webcam öffnen ↗</a>`;
        return { type: 'html', html: cardHtml({ glyph: 'webcam', color: '#00bfa5', title: p.title, subtitle: p.subtitle, date: p.updated, source: p.source, url: p.url, extra }), lng: pt[0], lat: pt[1] };
      }
      case 'alpr': {
        const dir = Number(p.dir);
        const rows = [
          ['Hersteller', p.brand],
          ['Betreiber', p.operator],
          ['Blickrichtung', dir >= 0 ? `${Math.round(dir)}°` : ''],
          ['Montage', p.mount],
        ].filter(([, v]) => v);
        const extra = `${rows.length ? `<div class="pop-grid two">${rows.map(([k, v]) => `<span>${k}</span><b>${escapeHtml(v)}</b>`).join('')}</div>` : ''}
          <div class="pop-foot"><a href="${escapeHtml(safeUrl(p.deflock) ?? '#')}" target="_blank" rel="noopener noreferrer">Auf DeFlock ansehen ↗</a></div>`;
        return { type: 'html', html: cardHtml({ glyph: 'alpr', color: p.flock ? '#ef4444' : '#ff9800', title: p.title, source: 'OpenStreetMap / DeFlock', url: p.url, extra }), lng: pt[0], lat: pt[1] };
      }
      case 'gvp':
        return { type: 'html', html: html('volcano', String(p.color)), lng: pt[0], lat: pt[1] };
      case 'fireareas-fill':
        return { type: 'html', html: html('fire', '#ff5722'), lng: at.lng, lat: at.lat };
      case 'tsunami':
        return { type: 'html', html: html('tsunami', String(p.color)), lng: pt[0], lat: pt[1] };
      case 'radiation':
        return { type: 'html', html: html('radiation', String(p.color)), lng: pt[0], lat: pt[1] };
      case 'launches': {
        let list: Launch[] = [];
        try {
          list = JSON.parse(String(p.launches));
        } catch {
          /* ignore */
        }
        const items = list
          .slice(0, 4)
          .map(
            (l) => `<li><b>${escapeHtml(l.name)}</b><br><span class="small">${escapeHtml(fmt.dateTime(l.net))} · ${escapeHtml(countdown(l.net))}${l.status ? ` · ${escapeHtml(l.status)}` : ''}</span>
              ${l.provider || l.rocket ? `<br><span class="small muted">${escapeHtml([l.provider, l.rocket].filter(Boolean).join(' · '))}</span>` : ''}
              ${safeUrl(l.video) ? `<br><a class="small" href="${escapeHtml(safeUrl(l.video)!)}" target="_blank" rel="noopener noreferrer">▶ Livestream</a>` : ''}</li>`,
          )
          .join('');
        return {
          type: 'html',
          html: cardHtml({ glyph: 'rocket', color: '#ff6e40', title: p.pad || 'Startplatz', subtitle: p.place, source: 'The Space Devs', url: 'https://thespacedevs.com/', extra: `<ol class="pop-list">${items}</ol>` }),
          lng: pt[0],
          lat: pt[1],
        };
      }
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
      case 'ships': {
        const rows = [
          ['Typ', SHIP_LABELS[p.cat as ShipCat] ?? 'Schiff'],
          ['Geschwindigkeit', `${fmt.num(Number(p.sog), 1)} kn (${fmt.num(Number(p.sog) * 1.852, 0)} km/h)`],
          ['Kurs', `${Math.round(Number(p.rot))}°`],
          ['Ziel', p.dest],
          ['Rufzeichen', p.call],
          ['MMSI', p.mmsi],
          ['Position von', new Date(Number(p.at)).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr'],
        ].filter(([, v]) => v !== '' && v != null);
        const extra = `<div class="pop-grid two">${rows.map(([k, v]) => `<span>${k}</span><b>${escapeHtml(v)}</b>`).join('')}</div>`;
        return {
          type: 'html',
          html: cardHtml({ glyph: 'vessel', color: String(p.color), title: p.name, source: p.source, url: `https://www.marinetraffic.com/de/ais/details/ships/mmsi:${encodeURIComponent(String(p.mmsi))}`, extra }),
          lng: pt[0],
          lat: pt[1],
        };
      }
      case 'trains': {
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
        const glyph: GlyphId = p.cat === 'wind' ? 'wind' : p.cat === 'solar' ? 'solar' : 'plant';
        return { type: 'html', html: html(glyph, String(p.color)), lng: pt[0], lat: pt[1] };
      }
    }
    return null;
  }

  clearSelection() {
    this.setData('sat-track', empty());
  }
}
