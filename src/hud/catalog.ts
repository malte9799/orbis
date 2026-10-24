import { EXTRAS, type ExtraId } from '../globe/extras';
import type { EventKind } from '../api/events';
import { BLACK_MARBLE, BLUE_MARBLE, EOX_S2, OPENTOPO, gibsDate, type BaseId } from '../globe/style';

// What can be put on a Karte: weather main layers, overlay layers (extras + event groups) in flat
// categories, and the base maps. Pure data – no map access.

export type GroupId = 'fires' | 'hotspots' | 'storms' | 'tornado' | 'quakes' | 'volcanoes' | 'floods' | 'ice';
export type FeedId = 'eonet' | 'gdacs' | 'usgs' | 'emsc' | 'nws' | 'spc' | 'firms';

export const GROUPS: { id: GroupId; label: string; hint: string; icon: EventKind; feeds: FeedId[] }[] = [
  { id: 'fires', label: 'Waldbrände', hint: 'NASA EONET, GDACS', icon: 'fire', feeds: ['eonet', 'gdacs'] },
  { id: 'hotspots', label: 'Feuer-Hotspots', hint: 'NASA FIRMS Satellit (VIIRS)', icon: 'heat', feeds: [] },
  { id: 'storms', label: 'Stürme & Zyklone', hint: 'mit Zugbahnen – EONET, GDACS', icon: 'storm', feeds: ['eonet', 'gdacs'] },
  { id: 'tornado', label: 'Tornados & Unwetter (USA)', hint: 'NWS-Warnungen, SPC-Meldungen', icon: 'tornado', feeds: ['nws', 'spc'] },
  { id: 'quakes', label: 'Erdbeben', hint: '7 Tage – Europa ab M1.5 (EMSC), weltweit ab M2.5 (USGS)', icon: 'quake', feeds: ['usgs', 'emsc'] },
  { id: 'volcanoes', label: 'Vulkane', hint: 'aktive Ausbrüche (EONET, GDACS) und alle ~1.300 Vulkane (Smithsonian GVP)', icon: 'volcano', feeds: ['eonet', 'gdacs'] },
  { id: 'floods', label: 'Fluten, Dürren & Erdrutsche', hint: 'GDACS, EONET', icon: 'flood', feeds: ['eonet', 'gdacs'] },
  { id: 'ice', label: 'Eis, Schnee, Staub & Hitze', hint: 'Eisberge, Sandstürme – EONET', icon: 'ice', feeds: ['eonet'] },
];

/** event groups that also switch an extra layer (one entry in the UI instead of two) */
export const LINKED_EXTRA: Partial<Record<GroupId, ExtraId>> = { fires: 'fireareas', volcanoes: 'gvp' };
/** groups that are switched together with another one */
export const LINKED_GROUP: Partial<Record<GroupId, GroupId>> = { fires: 'hotspots' };

// ---------------------------------------------------------------------------
// Weather main layers (at most one per Karte)

export interface WxFamily {
  id: string;
  label: string;
  hint: string;
  icon: string;
  color: string;
  variants: [string, string][];
}

export const WX_FAMILIES: WxFamily[] = [
  { id: 'radar', label: 'Radar', hint: 'Live-Niederschlagsradar', icon: 'radar', color: '#4f8dff', variants: [['radar', 'Regen (RainViewer)'], ['dwd-radar', 'Deutschland (DWD)']] },
  { id: 'sat', label: 'Satellit', hint: 'HD-Tagesbild (VIIRS) und Live-Daten', icon: 'sat', color: '#8a94a8', variants: [['sat-hd', 'HD'], ['sat-ir', 'Wolken (IR)'], ['imerg', 'Niederschlag'], ['sat-storm', 'Gewitter live']] },
  { id: 'wind', label: 'Wind', hint: 'Vorhersage, mit Windpartikeln', icon: 'wind', color: '#36c2a8', variants: [['wind', 'Mittelwind'], ['gusts', 'Böen']] },
  { id: 'temp', label: 'Temperatur', hint: 'Vorhersage, 2 m über Grund', icon: 'thermo', color: '#ff8a4c', variants: [['temp', 'Luft'], ['feels', 'Gefühlt'], ['dewpoint', 'Taupunkt']] },
  { id: 'precip', label: 'Niederschlag', hint: 'Vorhersage (Modell)', icon: 'drop', color: '#3db8ff', variants: [['precip', '']] },
  { id: 'cloud', label: 'Wolken', hint: 'Vorhersage: Bewölkung', icon: 'cloud', color: '#b8c2d6', variants: [['cloud', '']] },
  { id: 'pressure', label: 'Luftdruck', hint: 'Vorhersage', icon: 'gauge', color: '#a58bff', variants: [['pressure', '']] },
  { id: 'humidity', label: 'Feuchte', hint: 'Vorhersage: relative Luftfeuchtigkeit', icon: 'humid', color: '#4fc3c8', variants: [['humidity', '']] },
  { id: 'snow', label: 'Schnee', hint: 'Vorhersage: Schneehöhe', icon: 'snow', color: '#d8e8ff', variants: [['snow', '']] },
  { id: 'ocean', label: 'Ozean', hint: 'Satellit (NASA, täglich): Meerestemperatur & Meereis', icon: 'ocean', color: '#2aa8c8', variants: [['water', 'Meer + Eis'], ['sst', 'Meerestemperatur'], ['seaice', 'Meereis']] },
  { id: 'cape', label: 'Gewitter', hint: 'Vorhersage: Gewitterenergie (CAPE)', icon: 'bolt', color: '#ffcc33', variants: [['cape', '']] },
];

/**
 * The curated weather menu under the Karten bar. Every entry points at a weather layer of
 * WX_FAMILIES (family + variant), so the menu and the editing stack always show the same choice.
 * A single entry without a label switches directly.
 */
export interface WxMenuItem {
  id: string;
  label: string;
  hint: string;
  icon: string;
  color: string;
  subs: { label: string; main: string; mainVar: string }[];
}
export const WX_MENU: WxMenuItem[] = [
  { id: 'sat', label: 'Satellit', hint: 'HD-Tagesbild (VIIRS) und Wolken (IR)', icon: 'sat', color: '#8a94a8', subs: [{ label: 'HD', main: 'sat', mainVar: 'sat-hd' }, { label: 'Wolken', main: 'sat', mainVar: 'sat-ir' }] },
  { id: 'radar', label: 'Radar', hint: 'Live-Niederschlagsradar (RainViewer)', icon: 'radar', color: '#4f8dff', subs: [{ label: '', main: 'radar', mainVar: 'radar' }] },
  { id: 'precip', label: 'Niederschlag', hint: 'Satellit (NASA IMERG) und Schneehöhe', icon: 'drop', color: '#3db8ff', subs: [{ label: 'Satellit', main: 'sat', mainVar: 'imerg' }, { label: 'Schnee', main: 'snow', mainVar: 'snow' }] },
  { id: 'storm', label: 'Gewitter', hint: 'Blitze live, CAPE-Vorhersage und Satellit live (Meteosat)', icon: 'bolt', color: '#ffcc33', subs: [{ label: 'Blitze Live', main: 'lightning', mainVar: 'lightning' }, { label: 'Vorhersage', main: 'cape', mainVar: 'cape' }, { label: 'Live', main: 'sat', mainVar: 'sat-storm' }] },
  { id: 'wind', label: 'Wind', hint: 'Vorhersage, mit Windpartikeln', icon: 'wind', color: '#36c2a8', subs: [{ label: 'Stärke', main: 'wind', mainVar: 'wind' }, { label: 'Böen', main: 'wind', mainVar: 'gusts' }] },
  { id: 'temp', label: 'Temperatur', hint: 'Vorhersage, 2 m über Grund; Wasser: Satellit (NASA)', icon: 'thermo', color: '#ff8a4c', subs: [{ label: 'Luft', main: 'temp', mainVar: 'temp' }, { label: 'Gefühlt', main: 'temp', mainVar: 'feels' }, { label: 'Wasser', main: 'ocean', mainVar: 'water' }] },
  { id: 'humid', label: 'Feuchtigkeit', hint: 'Vorhersage', icon: 'humid', color: '#4fc3c8', subs: [{ label: 'Relativ', main: 'humidity', mainVar: 'humidity' }, { label: 'Taupunkt', main: 'temp', mainVar: 'dewpoint' }] },
  { id: 'pressure', label: 'Luftdruck', hint: 'Vorhersage', icon: 'gauge', color: '#a58bff', subs: [{ label: '', main: 'pressure', mainVar: 'pressure' }] },
];

export const OWM_FAMILY: WxFamily = {
  id: 'owm',
  label: 'OWM',
  hint: 'OpenWeatherMap-Karten (eigener Schlüssel)',
  icon: 'layers',
  color: '#9aa3b5',
  variants: [['owm-temp_new', 'Temperatur'], ['owm-precipitation_new', 'Niederschlag'], ['owm-clouds_new', 'Wolken'], ['owm-wind_new', 'Wind'], ['owm-pressure_new', 'Luftdruck']],
};

/**
 * The Verkehr menu: one category at a time (radio). `defaults` are switched on with the category
 * and always stay on; every row inside switches one more layer (toggle).
 */
export interface TrafficCat {
  id: string;
  label: string;
  icon: string;
  defaults: string[];
  /** a row switches one or more layers together */
  rows: { label: string; layers: string[] }[];
}
export const TRAFFIC_MENU: TrafficCat[] = [
  { id: 'auto', label: 'Auto', icon: 'car', defaults: ['autobahn'], rows: [{ label: 'Straßen', layers: ['roadnet'] }, { label: 'Staus & Baustellen', layers: ['autobahn'] }] },
  {
    id: 'oepnv', label: 'ÖPNV', icon: 'bus', defaults: ['trains'],
    rows: [{ label: 'Busse live', layers: ['transit'] }, { label: 'Busnetz', layers: ['busnet'] }, { label: 'Züge live', layers: ['trains'] }, { label: 'Zugnetz', layers: ['railspeed'] }],
  },
  // aircraft always on; "Flughäfen" = the airport symbols plus the airports in 3D when zoomed in close
  { id: 'air', label: 'Flugzeug', icon: 'plane2', defaults: ['aircraft'], rows: [{ label: 'Flughäfen', layers: ['airports', 'airport3d'] }] },
  { id: 'ship', label: 'Schiff', icon: 'ship', defaults: ['ships'], rows: [{ label: 'Schiffsrouten', layers: ['shipping'] }] },
];
/** every layer the Verkehr menu manages */
export const TRAFFIC_LAYER_IDS = new Set(TRAFFIC_MENU.flatMap((c) => [...c.defaults, ...c.rows.flatMap((r) => r.layers)]));
export const trafficCatOf = (layer: string) => TRAFFIC_MENU.find((c) => c.defaults.includes(layer) || c.rows.some((r) => r.layers.includes(layer)));

/** families whose forecast model provides wind particles / isobars as options */
export const WIND_OPTION_MAINS = ['wind'];
export const ISOBAR_OPTION_MAINS = ['wind', 'pressure'];

// ---------------------------------------------------------------------------
// Overlay layers

export type CatId = 'wetter' | 'gefahr' | 'verkehr' | 'meer' | 'erde' | 'netze' | 'medien';
export const CATS: { id: CatId; label: string; icon: string }[] = [
  { id: 'wetter', label: 'Wetter', icon: 'cloud' },
  { id: 'gefahr', label: 'Warnungen & Ereignisse', icon: 'warn' },
  { id: 'verkehr', label: 'Verkehr live', icon: 'plane2' },
  { id: 'meer', label: 'Meer & Gewässer', icon: 'ocean' },
  { id: 'erde', label: 'Erde & Umwelt', icon: 'leaf' },
  { id: 'netze', label: 'Netze & Infrastruktur', icon: 'rail' },
  { id: 'medien', label: 'Kameras & Radio', icon: 'cam' },
];

export interface CatalogEntry {
  id: string;
  kind: 'extra' | 'group';
  label: string;
  hint: string;
  cat: CatId;
  icon: string;
  color: string;
  /** small tag for region-only layers ("DE", "USA" …) */
  region?: string;
}

const CAT_OF: Record<CatId, string[]> = {
  wetter: ['cities', 'aq', 'aurora', 'nexrad', 'ecradar', 'fmiradar', 'noaaradar', 'jmaradar', 'dwdnowcast', 'ecsnow', 'fmirain24', 'jmanowcast', 'lightning'],
  gefahr: ['dwdwarn', 'nina', 'fires', 'storms', 'tornado', 'quakes', 'volcanoes', 'floods', 'ice', 'tsunami', 'radiation'],
  verkehr: ['aircraft', 'ships', 'trains', 'transit', 'autobahn', 'sondes', 'launches', 'sats', 'starlink', 'airports', 'airport3d'],
  meer: ['waves', 'buoys', 'tides', 'rivers', 'gauges', 'bathymetry', 'chlorophyll'],
  erde: ['terrain', 'buildings3d', 'geology', 'plates', 'ndvi', 'lst', 'snowcover', 'aerosol', 'landcover', 'resources'],
  netze: ['roadnet', 'railmap', 'busnet', 'railspeed', 'railelec', 'cyclenet', 'hikenet', 'shipping', 'cables', 'pipelines', 'wind', 'solar', 'plants'],
  medien: ['webcams', 'radio', 'alpr'],
};

const ICON_OF: Record<string, string> = {
  cities: 'city', dwdwarn: 'warn', gauges: 'gauge', nina: 'warn', aq: 'air', aurora: 'aurora', tsunami: 'tsunami', lightning: 'bolt', radiation: 'radiation',
  resources: 'pick', geology: 'mountain', plates: 'quake', ndvi: 'leaf', lst: 'thermo', snowcover: 'snow', aerosol: 'air', landcover: 'map', waves: 'wave',
  rivers: 'flood', buoys: 'ocean', tides: 'wave', bathymetry: 'ocean', chlorophyll: 'leaf', nexrad: 'radar', ecradar: 'radar', fmiradar: 'radar',
  noaaradar: 'radar', jmaradar: 'radar', dwdnowcast: 'radar', ecsnow: 'snow', fmirain24: 'drop', jmanowcast: 'radar', terrain: 'mountain', buildings3d: 'city',
  aircraft: 'plane2', sondes: 'balloon', launches: 'rocket', airports: 'plane2', airport3d: 'plane2', sats: 'orbit', starlink: 'orbit', ships: 'ship', trains: 'train',
  transit: 'bus', roadnet: 'road', railmap: 'rail', busnet: 'bus', railspeed: 'rail', railelec: 'power', cyclenet: 'road', hikenet: 'mountain',
  autobahn: 'car', pipelines: 'pipe', shipping: 'ship', cables: 'cable', wind: 'windmill', solar: 'sun', plants: 'power', webcams: 'cam', radio: 'radio',
  alpr: 'cam', fires: 'fire', storms: 'storm', tornado: 'storm', quakes: 'quake', volcanoes: 'volcano', floods: 'flood', ice: 'snow',
};
const GROUP_COLOR: Record<string, string> = { fires: '#ff5722', storms: '#7c8cff', tornado: '#b07cff', quakes: '#ffb547', volcanoes: '#ff7043', floods: '#3d9ad1', ice: '#9ec5e8' };
const GROUP_LABEL: Record<string, [string, string]> = {
  fires: ['Feuer', 'Waldbrände, Satelliten-Hotspots und Brandflächen USA'],
  storms: ['Stürme & Zyklone', 'mit Zugbahnen – EONET, GDACS'],
  tornado: ['Tornados & Unwetter', 'NWS-Warnungen, SPC-Meldungen'],
  quakes: ['Erdbeben', '7 Tage – Europa ab M1.5, weltweit ab M2.5'],
  volcanoes: ['Vulkane', 'aktive Ausbrüche und alle ~1.300 Vulkane'],
  floods: ['Fluten & Dürren', 'GDACS, EONET'],
  ice: ['Eis, Staub & Hitze', 'Eisberge, Sandstürme – EONET'],
};
const REGION: Record<string, string> = {
  dwdwarn: 'DE', nina: 'DE', autobahn: 'DE', gauges: 'DE', dwdnowcast: 'DE', tornado: 'USA', tides: 'USA', nexrad: 'USA', noaaradar: 'USA',
  ecradar: 'CA', ecsnow: 'CA', fmiradar: 'FI', fmirain24: 'FI', jmaradar: 'JP', jmanowcast: 'JP', aq: 'EU',
};

const catOf = (id: string): CatId => (Object.keys(CAT_OF) as CatId[]).find((c) => CAT_OF[c].includes(id)) ?? 'erde';
const HIDDEN_EXTRAS = new Set<string>(Object.values(LINKED_EXTRA));

export const CATALOG: CatalogEntry[] = [
  ...EXTRAS.filter((d) => !HIDDEN_EXTRAS.has(d.id)).map<CatalogEntry>((d) => ({
    id: d.id, kind: 'extra', label: d.label, hint: d.hint, cat: catOf(d.id), icon: ICON_OF[d.id] ?? 'layers', color: d.color, region: REGION[d.id],
  })),
  ...GROUPS.filter((g) => g.id !== 'hotspots').map<CatalogEntry>((g) => ({
    id: g.id, kind: 'group', label: GROUP_LABEL[g.id][0], hint: GROUP_LABEL[g.id][1], cat: catOf(g.id), icon: ICON_OF[g.id], color: GROUP_COLOR[g.id], region: REGION[g.id],
  })),
];
export const catalogOf = (id: string) => CATALOG.find((c) => c.id === id);

// ---------------------------------------------------------------------------
// Base maps

/** the four big thumbnails; the other base maps sit behind "Weitere" */
export const MAIN_BASES: BaseId[] = ['satellite', 'dark', 'light', 'topo'];
export const BASE_LABEL: Record<BaseId, string> = {
  satellite: 'Satellit', sentinel: 'Sentinel-2', topo: 'Gelände', nasa: 'NASA Tagesbild', blue: 'Blue Marble', night: 'Nachtlichter', dark: 'Dunkel', light: 'Hell',
};
export const BASE_GRADIENT: Record<BaseId, string> = {
  satellite: 'linear-gradient(135deg,#1d3b2a,#3d5a3a 40%,#0d2340 41%,#163a66)',
  sentinel: 'linear-gradient(135deg,#2c4a2a,#5b6b3a 40%,#143a55 41%,#1d4f72)',
  topo: 'linear-gradient(135deg,#a8b88a,#d9cfa3 45%,#9cc4dd 46%)',
  nasa: 'linear-gradient(135deg,#243b57,#4c6b46 40%,#1a2f52 41%,#2a4c7a)',
  blue: 'linear-gradient(135deg,#1c4d8a,#3b7a48 40%,#14407a 41%,#1f5a9c)',
  night: 'linear-gradient(135deg,#05060c,#1b1405 40%,#04050a 41%,#0b0c14)',
  dark: 'linear-gradient(135deg,#141a2a,#1d2438 45%,#0a0f1c 46%)',
  light: 'linear-gradient(135deg,#e7e3da,#f1eee7 45%,#bcd3e6 46%)',
};

function miniMap(land: string, water: string, road: string, border: string) {
  return `<svg viewBox="0 0 64 64" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="64" height="64" fill="${water}"/>
    <path d="M0 10 C10 6 18 12 26 9 S40 4 46 12 S56 22 64 18 V64 H34 C30 56 22 58 18 50 S6 46 0 50Z" fill="${land}"/>
    <path d="M44 40 C50 36 58 40 60 46 S52 58 46 54 S40 44 44 40Z" fill="${water}"/>
    <path d="M6 30 L24 26 L38 34 L58 30 M20 14 L28 40 L24 62" stroke="${road}" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <path d="M2 40 C14 36 20 42 30 38 S44 24 52 26" stroke="${border}" stroke-width="1" stroke-dasharray="3 2" fill="none"/></svg>`;
}

/** thumbnail markup (tile image or small drawing) for a base map */
export function baseThumb(id: BaseId): string {
  switch (id) {
    case 'satellite': return `<img alt="" loading="lazy" src="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/3/2/4"/>`;
    case 'sentinel': return `<img alt="" loading="lazy" src="${EOX_S2.replace('{z}/{y}/{x}', '3/2/4')}"/>`;
    case 'topo': return `<img alt="" loading="lazy" src="${OPENTOPO.replace('{z}/{x}/{y}', '3/4/2')}"/>`;
    case 'nasa': return `<img alt="" loading="lazy" src="https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_NOAA20_CorrectedReflectance_TrueColor/default/${gibsDate(1)}/GoogleMapsCompatible_Level9/3/2/4.jpg"/>`;
    case 'blue': return `<img alt="" loading="lazy" src="${BLUE_MARBLE.replace('{z}/{y}/{x}', '3/2/4')}"/>`;
    case 'night': return `<img alt="" loading="lazy" src="${BLACK_MARBLE.replace('{z}/{y}/{x}', '3/2/4')}"/>`;
    case 'dark': return miniMap('#111827', '#0b1a2e', '#3a4767', '#56638a');
    case 'light': return miniMap('#f3f0ea', '#a9cce9', '#f7d9a0', '#9c87b5');
  }
}
