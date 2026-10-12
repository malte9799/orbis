import type { StyleSpecification } from 'maplibre-gl';

export type BaseId = 'satellite' | 'nasa' | 'dark' | 'light';

export const BASES: { id: BaseId; label: string }[] = [
  { id: 'satellite', label: 'Satellit' },
  { id: 'nasa', label: 'NASA Tagesbild' },
  { id: 'dark', label: 'Dunkel' },
  { id: 'light', label: 'Hell' },
];

const carto = (style: string) => ['a', 'b', 'c', 'd'].map((s) => `https://${s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}@2x.png`);
const CARTO_ATTR = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, © <a href="https://carto.com/attributions">CARTO</a>';

export function gibsDate(daysAgo = 1): string {
  return new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
}

export const gibsTrueColor = (date: string) =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_NOAA20_CorrectedReflectance_TrueColor/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;

/** NASA FIRMS thermal anomalies rendered by GIBS WMS (works for its vector layers too). */
export const gibsFires = (date: string) =>
  `https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=VIIRS_NOAA20_Thermal_Anomalies_375m_All&STYLES=&FORMAT=image/png&TRANSPARENT=true&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&TIME=${date}`;

export const DWD_WMS =
  'https://maps.dwd.de/geoserver/dwd/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=dwd:Warnungen_Gemeinden_vereinigt&STYLES=&FORMAT=image/png&TRANSPARENT=true&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256';

const empty = { type: 'geojson' as const, data: { type: 'FeatureCollection' as const, features: [] } };

/**
 * Complete style with every layer present but hidden; the panel only flips visibility,
 * which keeps the z-order stable: base → weather → warnings → labels → night → events.
 */
export function buildStyle(nasaDate: string, firesDate: string): StyleSpecification {
  return {
    version: 8,
    projection: { type: 'globe' },
    sky: {
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
    },
    sources: {
      satellite: {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        maxzoom: 18,
        attribution: 'Bilder © Esri, Maxar, Earthstar Geographics',
      },
      nasa: {
        type: 'raster',
        tiles: [gibsTrueColor(nasaDate)],
        tileSize: 256,
        maxzoom: 9,
        attribution: 'NASA EOSDIS GIBS / VIIRS',
      },
      dark: { type: 'raster', tiles: carto('dark_nolabels'), tileSize: 256, maxzoom: 18, attribution: CARTO_ATTR },
      light: { type: 'raster', tiles: carto('voyager_nolabels'), tileSize: 256, maxzoom: 18, attribution: CARTO_ATTR },
      'labels-dark': { type: 'raster', tiles: carto('dark_only_labels'), tileSize: 256, maxzoom: 18 },
      'labels-light': { type: 'raster', tiles: carto('voyager_only_labels'), tileSize: 256, maxzoom: 18 },
      field: {
        type: 'raster',
        tiles: ['wxfield://temp/0/{z}/{x}/{y}'],
        tileSize: 256,
        maxzoom: 5,
        attribution: 'Modelldaten: <a href="https://open-meteo.com/">Open-Meteo</a>',
      },
      hotspots: {
        type: 'raster',
        tiles: [gibsFires(firesDate)],
        tileSize: 256,
        minzoom: 1,
        maxzoom: 9,
        attribution: 'NASA FIRMS / GIBS',
      },
      dwd: {
        type: 'raster',
        tiles: [DWD_WMS],
        tileSize: 256,
        bounds: [5.5, 47, 15.5, 55.2],
        attribution: 'Warnungen © <a href="https://www.dwd.de/">DWD</a>',
      },
      night: empty,
      'nws-poly': empty,
      tracks: empty,
      quakes: empty,
      firms: empty,
      events: empty,
      marker: empty,
    },
    layers: [
      { id: 'space', type: 'background', paint: { 'background-color': '#05070d' } },
      ...(['satellite', 'nasa', 'dark', 'light'] as const).map((id) => ({
        id: `base-${id}`,
        type: 'raster' as const,
        source: id,
        layout: { visibility: 'none' as const },
        paint: id === 'satellite' ? { 'raster-saturation': -0.15, 'raster-brightness-max': 0.85 } : {},
      })),
      {
        id: 'field',
        type: 'raster',
        source: 'field',
        layout: { visibility: 'none' },
        paint: { 'raster-resampling': 'linear', 'raster-fade-duration': 200 },
      },
      // Radar & OWM layers are inserted before this anchor at runtime.
      { id: 'anchor-weather', type: 'background', layout: { visibility: 'none' }, paint: { 'background-opacity': 0 } },
      { id: 'dwd', type: 'raster', source: 'dwd', layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.75 } },
      { id: 'hotspots', type: 'raster', source: 'hotspots', layout: { visibility: 'none' } },
      { id: 'labels-dark', type: 'raster', source: 'labels-dark', layout: { visibility: 'none' } },
      { id: 'labels-light', type: 'raster', source: 'labels-light', layout: { visibility: 'none' } },
      {
        id: 'night',
        type: 'fill',
        source: 'night',
        layout: { visibility: 'none' },
        paint: { 'fill-color': '#000814', 'fill-opacity': 0.38, 'fill-antialias': false },
      },
      {
        id: 'nws-fill',
        type: 'fill',
        source: 'nws-poly',
        layout: { visibility: 'none' },
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.3 },
      },
      {
        id: 'nws-line',
        type: 'line',
        source: 'nws-poly',
        layout: { visibility: 'none' },
        paint: { 'line-color': ['get', 'color'], 'line-width': 1.5 },
      },
      {
        id: 'tracks',
        type: 'line',
        source: 'tracks',
        layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#b8c0ff', 'line-width': 2, 'line-dasharray': [2, 2], 'line-opacity': 0.85 },
      },
      {
        id: 'firms',
        type: 'circle',
        source: 'firms',
        layout: { visibility: 'none' },
        paint: {
          'circle-color': ['interpolate', ['linear'], ['get', 'frp'], 0, '#ffd23f', 20, '#ff8c1a', 100, '#ff2d2d'],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 1.2, 5, 2.5, 9, 5],
          'circle-opacity': 0.9,
          'circle-blur': 0.3,
        },
      },
      {
        id: 'quakes',
        type: 'circle',
        source: 'quakes',
        layout: { visibility: 'none', 'circle-sort-key': ['get', 'mag'] },
        paint: {
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.55,
          'circle-stroke-color': ['get', 'color'],
          'circle-stroke-width': 1.5,
          'circle-radius': ['interpolate', ['exponential', 1.6], ['get', 'mag'], 2.5, 3, 5, 9, 7, 20, 9, 36],
        },
      },
      {
        id: 'ev-circle',
        type: 'circle',
        source: 'events',
        filter: ['in', ['get', 'group'], ['literal', []]],
        layout: { 'circle-sort-key': ['get', 'weight'] },
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, ['+', 6, ['*', 5, ['get', 'weight']]], 6, ['+', 10, ['*', 6, ['get', 'weight']]]],
          'circle-stroke-color': 'rgba(255,255,255,0.85)',
          'circle-stroke-width': 1.2,
        },
      },
      {
        id: 'ev-glyph',
        type: 'symbol',
        source: 'events',
        filter: ['in', ['get', 'group'], ['literal', []]],
        layout: {
          'icon-image': ['concat', 'glyph-', ['get', 'kind']],
          'icon-size': ['interpolate', ['linear'], ['zoom'], 0, ['+', 0.5, ['*', 0.4, ['get', 'weight']]], 6, ['+', 0.85, ['*', 0.45, ['get', 'weight']]]],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'symbol-sort-key': ['get', 'weight'],
        },
      },
      {
        id: 'marker',
        type: 'circle',
        source: 'marker',
        paint: {
          'circle-radius': 7,
          'circle-color': '#4f8cff',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 3,
        },
      },
    ],
  };
}
