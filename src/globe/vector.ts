import type { ExpressionSpecification, LayerSpecification } from 'maplibre-gl';

// Base map and labels from OpenFreeMap (free, no API key, no request limits; OpenStreetMap
// data in the OpenMapTiles schema). https://openfreemap.org/

export const OFM_SOURCE = 'https://tiles.openfreemap.org/planet';
export const OFM_GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
export const OFM_ATTR =
  '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>';

export const FONT_REGULAR = ['Noto Sans Regular'];
export const FONT_BOLD = ['Noto Sans Bold'];
export const FONT_ITALIC = ['Noto Sans Italic'];

export type Theme = 'dark' | 'light';

// Colours follow the Protomaps basemap flavors (github.com/protomaps/basemaps, styles/src/flavors.ts):
// flat, unsaturated land tone for both themes, water as the strongest color, roads only levelled
// by lightness (white on light, near-dark grey on dark) with a slightly wider casing underneath.
// "background" is the land tone: the background layer paints everything, water polygons sit on top.
const PALETTE = {
  dark: {
    background: '#1f1f1f', // earth
    water: '#31353f',
    ice: '#2b2b2b',
    wood: '#1c2925', // landcover forest
    grass: '#1e291f', // landcover grassland
    residential: '#1c1c1c', // landcover urban_area
    industrial: '#222222',
    road: '#3d3d3d', // secondary/tertiary (minor_b)
    roadSmall: '#333333', // minor/street
    roadMajor: '#3d3d3d', // major roads
    highway: '#474747', // motorway
    roadCasing: '#1f1f1f',
    building: '#111111',
    border: '#5b6374',
  },
  light: {
    background: '#e2dfda', // earth
    water: '#80deea',
    ice: '#e7e7e7',
    wood: '#c4e7d2', // landcover forest
    grass: '#d2efcf', // landcover grassland
    residential: '#e6e6e6', // landcover urban_area
    industrial: '#d1dde1',
    road: '#ffffff', // secondary/tertiary (minor_b)
    roadSmall: '#ebebeb', // minor/street
    roadMajor: '#ffffff', // major roads
    highway: '#ffffff', // motorway
    roadCasing: '#e0e0e0',
    building: '#cccccc',
    border: '#adadad',
  },
};

/** Base map layers for one theme; every id starts with `vbase-<theme>-`. */
export function baseLayers(theme: Theme): LayerSpecification[] {
  const c = PALETTE[theme];
  const id = (s: string) => `vbase-${theme}-${s}`;
  const hidden = { visibility: 'none' as const };
  const roadWidth = (base: number): ExpressionSpecification => [
    'interpolate',
    ['exponential', 1.5],
    ['zoom'],
    5,
    base * 0.3,
    10,
    base,
    16,
    base * 6,
  ];
  return [
    { id: id('bg'), type: 'background', layout: hidden, paint: { 'background-color': c.background } },
    {
      id: id('landcover'),
      type: 'fill',
      source: 'ofm',
      'source-layer': 'landcover',
      layout: hidden,
      paint: {
        'fill-color': ['match', ['get', 'class'], 'ice', c.ice, 'wood', c.wood, 'forest', c.wood, c.grass],
        'fill-opacity': ['match', ['get', 'class'], 'ice', 0.9, 0.85],
      },
    },
    {
      id: id('landuse'),
      type: 'fill',
      source: 'ofm',
      'source-layer': 'landuse',
      minzoom: 8,
      filter: ['in', ['get', 'class'], ['literal', ['residential', 'suburb', 'neighbourhood', 'commercial', 'industrial']]],
      layout: hidden,
      paint: {
        'fill-color': ['match', ['get', 'class'], 'commercial', c.industrial, 'industrial', c.industrial, c.residential],
        'fill-opacity': 0.8,
      },
    },
    {
      id: id('waterway'),
      type: 'line',
      source: 'ofm',
      'source-layer': 'waterway',
      minzoom: 6,
      layout: hidden,
      paint: { 'line-color': c.water, 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.5, 14, 3] },
    },
    { id: id('water'), type: 'fill', source: 'ofm', 'source-layer': 'water', layout: hidden, paint: { 'fill-color': c.water } },
    {
      id: id('building'),
      type: 'fill',
      source: 'ofm',
      'source-layer': 'building',
      minzoom: 14,
      layout: hidden,
      paint: { 'fill-color': c.building },
    },
    {
      id: id('roads-minor-casing'),
      type: 'line',
      source: 'ofm',
      'source-layer': 'transportation',
      minzoom: 11,
      filter: ['in', ['get', 'class'], ['literal', ['secondary', 'tertiary', 'minor', 'street']]],
      layout: { ...hidden, 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': c.roadCasing, 'line-width': roadWidth(1.05) },
    },
    {
      id: id('roads-major-casing'),
      type: 'line',
      source: 'ofm',
      'source-layer': 'transportation',
      minzoom: 5,
      filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary']]],
      layout: { ...hidden, 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': c.roadCasing, 'line-width': roadWidth(1.6) },
    },
    {
      id: id('roads-minor'),
      type: 'line',
      source: 'ofm',
      'source-layer': 'transportation',
      minzoom: 11,
      filter: ['in', ['get', 'class'], ['literal', ['secondary', 'tertiary', 'minor', 'street']]],
      layout: { ...hidden, 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['match', ['get', 'class'], 'minor', c.roadSmall, 'street', c.roadSmall, c.road],
        'line-width': roadWidth(0.6),
      },
    },
    {
      id: id('roads-major'),
      type: 'line',
      source: 'ofm',
      'source-layer': 'transportation',
      minzoom: 5,
      filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary']]],
      layout: { ...hidden, 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['match', ['get', 'class'], 'motorway', c.highway, c.roadMajor],
        'line-width': roadWidth(1),
      },
    },
  ];
}

const NAME: ExpressionSpecification = ['coalesce', ['get', 'name:de'], ['get', 'name_de'], ['get', 'name:latin'], ['get', 'name']];

/** Borders and place names drawn above the weather layers (ids start with `lbl-`).
 *  Continents and regions come last: later symbol layers are placed first, so they win label collisions. */
export function labelLayers(): LayerSpecification[] {
  const hidden = { visibility: 'none' as const };
  const text = {
    'text-color': '#7a7a7a', // city_label (Protomaps DARK)
    'text-halo-color': 'rgba(33,33,33,0.9)', // city_label_halo
    'text-halo-width': 1.3,
  };
  return [
    {
      id: 'lbl-border-country',
      type: 'line',
      source: 'ofm',
      'source-layer': 'boundary',
      filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]],
      layout: { ...hidden, 'line-join': 'round' },
      paint: { 'line-color': '#5b6374', 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.6, 8, 1.6] },
    },
    {
      id: 'lbl-border-state',
      type: 'line',
      source: 'ofm',
      'source-layer': 'boundary',
      minzoom: 4,
      filter: ['all', ['==', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]],
      layout: { ...hidden, 'line-join': 'round' },
      paint: { 'line-color': 'rgba(91,99,116,0.45)', 'line-width': 0.8, 'line-dasharray': [3, 2] },
    },
    {
      id: 'lbl-border-water',
      type: 'line',
      source: 'ofm',
      'source-layer': 'water',
      filter: ['==', ['get', 'class'], 'ocean'],
      layout: { ...hidden, 'line-join': 'round' },
      paint: { 'line-color': 'rgba(160,170,190,0.4)', 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.6, 8, 1.6] },
    },
    {
      id: 'lbl-water',
      type: 'symbol',
      source: 'ofm',
      'source-layer': 'water_name',
      filter: ['in', ['get', 'class'], ['literal', ['ocean', 'sea']]],
      layout: { ...hidden, 'text-field': NAME, 'text-font': FONT_ITALIC, 'text-size': 12, 'text-max-width': 6 },
      paint: { ...text, 'text-color': '#717784', 'text-halo-width': 0.8 }, // ocean_label
    },
    {
      id: 'lbl-town',
      type: 'symbol',
      source: 'ofm',
      'source-layer': 'place',
      minzoom: 8,
      filter: ['in', ['get', 'class'], ['literal', ['town', 'village']]],
      layout: {
        ...hidden,
        'text-field': NAME,
        'text-font': FONT_REGULAR,
        'text-size': ['interpolate', ['linear'], ['zoom'], 8, 10, 14, 14],
        'symbol-sort-key': ['coalesce', ['get', 'rank'], 99],
      },
      paint: text,
    },
    {
      id: 'lbl-city',
      type: 'symbol',
      source: 'ofm',
      'source-layer': 'place',
      minzoom: 3,
      filter: ['==', ['get', 'class'], 'city'],
      layout: {
        ...hidden,
        'text-field': NAME,
        'text-font': FONT_REGULAR,
        'text-size': ['interpolate', ['linear'], ['zoom'], 3, 10, 8, 14, 12, 17],
        'symbol-sort-key': ['coalesce', ['get', 'rank'], 99],
        'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
        'text-radial-offset': 0.4,
      },
      paint: text,
    },
    {
      id: 'lbl-state',
      type: 'symbol',
      source: 'ofm',
      'source-layer': 'place',
      minzoom: 5,
      maxzoom: 9,
      filter: ['==', ['get', 'class'], 'state'],
      layout: {
        ...hidden,
        'text-field': NAME,
        'text-font': FONT_REGULAR,
        'text-size': 11,
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.1,
      },
      paint: { ...text, 'text-color': '#4a4a4a' }, // state_label, a bit lifted from #3d3d3d for readability
    },
    {
      id: 'lbl-country',
      type: 'symbol',
      source: 'ofm',
      'source-layer': 'place',
      maxzoom: 8,
      filter: ['==', ['get', 'class'], 'country'],
      layout: {
        ...hidden,
        'text-field': NAME,
        'text-font': FONT_BOLD,
        'text-size': ['interpolate', ['linear'], ['zoom'], 1, 10, 6, 15],
        'text-max-width': 7,
        'symbol-sort-key': ['coalesce', ['get', 'rank'], 99],
      },
      paint: text,
    },
    {
      id: 'lbl-continent',
      type: 'symbol',
      source: 'regions',
      filter: ['==', ['get', 'kind'], 'continent'],
      maxzoom: 3.5,
      layout: {
        ...hidden,
        'text-field': ['get', 'name'],
        'text-font': FONT_BOLD,
        'text-size': ['interpolate', ['linear'], ['zoom'], 0, 14, 3, 20],
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.18,
        'text-max-width': 8,
        'text-allow-overlap': true,
        'symbol-sort-key': 0,
      },
      paint: { ...text, 'text-opacity': ['interpolate', ['linear'], ['zoom'], 3, 1, 3.5, 0] },
    },
    {
      id: 'lbl-region',
      type: 'symbol',
      source: 'regions',
      filter: ['!=', ['get', 'kind'], 'continent'],
      minzoom: 1.2,
      maxzoom: 3.5,
      layout: {
        ...hidden,
        'text-field': ['get', 'name'],
        'text-font': FONT_ITALIC,
        'text-size': ['interpolate', ['linear'], ['zoom'], 1.2, 10, 3.5, 13],
        'text-letter-spacing': 0.08,
        'text-max-width': 7,
        'symbol-sort-key': ['get', 'rank'],
      },
      paint: { ...text, 'text-opacity': ['interpolate', ['linear'], ['zoom'], 1.2, 0, 1.8, 0.9, 3, 0.9, 3.5, 0] },
    },
  ];
}

/** Text colours for the label layers depending on the base map. `onBaseDark` is the Protomaps dark
 *  flavor (city_label #7a7a7a, country #5c5c5c, boundaries #5b6374 …); `onDark` keeps bright labels
 *  for the imagery bases (satellite, NASA, …). */
export function labelPaint(theme: 'onDark' | 'onBaseDark' | 'onLight') {
  if (theme === 'onBaseDark') {
    return {
      color: '#7a7a7a', // city_label
      halo: 'rgba(33,33,33,0.9)', // city_label_halo
      water: '#717784', // ocean_label
      subplace: '#6a6a6a',
      state: '#4a4a4a', // state_label, a bit lifted from #3d3d3d for readability
      country: '#5c5c5c',
      border: '#5b6374', // boundaries
      waterBorder: 'rgba(160,170,190,0.4)',
      stateBorder: 'rgba(91,99,116,0.45)',
    };
  }
  if (theme === 'onLight') {
    return {
      color: '#5c5c5c', // city_label
      halo: 'rgba(224,224,224,0.9)', // city_label_halo
      water: '#728dd4', // ocean_label
      subplace: '#8f8f8f', // subplace_label
      state: '#b3b3b3',
      country: '#a3a3a3',
      border: '#adadad', // boundaries
      waterBorder: 'rgba(140,155,175,0.5)',
      stateBorder: 'rgba(173,173,173,0.5)',
    };
  }
  return {
    color: '#ffffff',
    halo: 'rgba(0,0,0,0.75)',
    water: 'rgba(190,215,255,0.85)',
    subplace: '#ffffff',
    state: 'rgba(255,255,255,0.7)',
    country: '#ffffff',
    border: 'rgba(255,255,255,0.55)',
    waterBorder: 'rgba(255,255,255,0.55)',
    stateBorder: 'rgba(255,255,255,0.3)',
  };
}
