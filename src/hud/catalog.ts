import { INFRA_MENU, TRAFFIC_MENU, WX_FAMILIES, WX_MENU, type TrafficCat, type WxFamily, type WxMenuItem } from './menus';
import { EXTRAS, type CatId } from '../globe/layers';
import { GROUPS, LINKED_EXTRA_IDS } from '../globe/events';
import { BLACK_MARBLE, BLUE_MARBLE, EOX_S2, ESRI_CLARITY, OPENTOPO, gibsDate, type BaseId } from '../globe/style';

export { INFRA_MENU, TRAFFIC_MENU, WX_FAMILIES, WX_MENU };
export type { TrafficCat, WxFamily, WxMenuItem };

// What can be put on a Karte: weather main layers, overlay layers (extras + event groups) in flat
// categories, and the base maps. Pure data – no map access.

// ---------------------------------------------------------------------------
// Weather main layers (at most one per Karte)

export const OWM_FAMILY: WxFamily = {
  id: 'owm',
  label: 'OWM',
  hint: 'OpenWeatherMap-Karten (eigener Schlüssel)',
  icon: 'layers',
  color: '#9aa3b5',
  variants: [['owm-temp_new', 'Temperatur'], ['owm-precipitation_new', 'Niederschlag'], ['owm-clouds_new', 'Wolken'], ['owm-wind_new', 'Wind'], ['owm-pressure_new', 'Luftdruck']],
};

/** every layer the Verkehr menu manages */
export const TRAFFIC_LAYER_IDS = new Set(TRAFFIC_MENU.flatMap((c) => [...(c.defaults ?? []), ...c.rows.flatMap((r) => r.layers)]));
export const trafficCatOf = (layer: string) => TRAFFIC_MENU.find((c) => c.defaults?.includes(layer) || c.rows.some((r) => r.layers.includes(layer)));

export const INFRA_LAYER_IDS = new Set(INFRA_MENU.flatMap((c) => [...(c.defaults ?? []), ...c.rows.flatMap((r) => r.layers)]));
export const infraCatOf = (layer: string) => INFRA_MENU.find((c) => c.defaults?.includes(layer) || c.rows.some((r) => r.layers.includes(layer)));
/** the menu type of a Karten menu id ('' = none) */
export const MENU_LAYERS: Record<'wx' | 'traffic' | 'infra', Set<string>> = { wx: new Set(), traffic: TRAFFIC_LAYER_IDS, infra: INFRA_LAYER_IDS };

/** families whose forecast model provides isobars as an option */
export const ISOBAR_OPTION_MAINS = ['wind', 'pressure'];

// ---------------------------------------------------------------------------
// Overlay layers

export type { CatId };
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

const HIDDEN_EXTRAS = LINKED_EXTRA_IDS;

export const CATALOG: CatalogEntry[] = [
  ...EXTRAS.filter((d) => !HIDDEN_EXTRAS.has(d.id)).map<CatalogEntry>((d) => ({
    id: d.id, kind: 'extra', label: d.label, hint: d.hint, cat: d.cat, icon: d.icon, color: d.color, region: d.region,
  })),
  ...GROUPS.filter((g) => g.catalog).map<CatalogEntry>((g) => ({
    id: g.id, kind: 'group', label: g.catalog!.label, hint: g.catalog!.hint, cat: g.catalog!.cat, icon: g.catalog!.icon, color: g.catalog!.color, region: g.catalog!.region,
  })),
];
export const catalogOf = (id: string) => CATALOG.find((c) => c.id === id);

// ---------------------------------------------------------------------------
// Base maps

/** the four big thumbnails; the other base maps sit behind "Weitere" */
export const MAIN_BASES: BaseId[] = ['satellite', 'dark', 'light', 'topo'];
export const BASE_LABEL: Record<BaseId, string> = {
  satellite: 'Satellit', clarity: 'Satellit Clarity', mapbox: 'Mapbox Satellit', maptiler: 'MapTiler Satellit', sentinel: 'Sentinel-2', topo: 'Gelände', nasa: 'NASA Tagesbild', blue: 'Blue Marble', night: 'Nachtlichter', dark: 'Dunkel', light: 'Hell',
};
export const BASE_GRADIENT: Record<BaseId, string> = {
  satellite: 'linear-gradient(135deg,#1d3b2a,#3d5a3a 40%,#0d2340 41%,#163a66)',
  clarity: 'linear-gradient(135deg,#1d3b2a,#3d5a3a 40%,#0d2340 41%,#163a66)',
  mapbox: 'linear-gradient(135deg,#22402c,#44663f 40%,#0f2a48 41%,#1a4470)',
  maptiler: 'linear-gradient(135deg,#27402a,#4d6a3c 40%,#10304f 41%,#1b4a76)',
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
    case 'clarity': return `<img alt="" loading="lazy" src="${ESRI_CLARITY.replace('{z}/{y}/{x}', '3/2/4')}"/>`;
    case 'mapbox':
    case 'maptiler': return ''; // thumbnail would need the key in the markup – gradient only
    case 'sentinel': return `<img alt="" loading="lazy" src="${EOX_S2.replace('{z}/{y}/{x}', '3/2/4')}"/>`;
    case 'topo': return `<img alt="" loading="lazy" src="${OPENTOPO.replace('{z}/{x}/{y}', '3/4/2')}"/>`;
    case 'nasa': return `<img alt="" loading="lazy" src="https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_NOAA20_CorrectedReflectance_TrueColor/default/${gibsDate(1)}/GoogleMapsCompatible_Level9/3/2/4.jpg"/>`;
    case 'blue': return `<img alt="" loading="lazy" src="${BLUE_MARBLE.replace('{z}/{y}/{x}', '3/2/4')}"/>`;
    case 'night': return `<img alt="" loading="lazy" src="${BLACK_MARBLE.replace('{z}/{y}/{x}', '3/2/4')}"/>`;
    case 'dark': return miniMap('#111827', '#0b1a2e', '#3a4767', '#56638a');
    case 'light': return miniMap('#f3f0ea', '#a9cce9', '#f7d9a0', '#9c87b5');
  }
}
