import type { StyleSpecification } from 'maplibre-gl';
import { baseLayers, FONT_BOLD, FONT_REGULAR, labelLayers, OFM_ATTR, OFM_GLYPHS, OFM_SOURCE } from './vector';

export type BaseId = 'satellite' | 'sentinel' | 'topo' | 'nasa' | 'blue' | 'night' | 'dark' | 'light';

export const BASES: { id: BaseId; label: string }[] = [
  { id: 'satellite', label: 'Satellit' },
  { id: 'sentinel', label: 'Sentinel-2' },
  { id: 'topo', label: 'Topografie' },
  { id: 'nasa', label: 'NASA Tagesbild' },
  { id: 'blue', label: 'NASA Blue Marble' },
  { id: 'night', label: 'Nachtlichter' },
  { id: 'dark', label: 'Dunkel' },
  { id: 'light', label: 'Hell' },
];


/** Sentinel-2 cloudless mosaic (EOX, CC BY-NC-SA 4.0 – non-commercial use). */
export const EOX_S2 = 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/{z}/{y}/{x}.jpg';
export const OPENTOPO = 'https://tile.opentopomap.org/{z}/{x}/{y}.png';

export function gibsDate(daysAgo = 1): string {
  return new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
}

export const gibsTrueColor = (date: string, sat = 'VIIRS_NOAA20') =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${sat}_CorrectedReflectance_TrueColor/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;

/** NASA Blue Marble: static, cloud-free, gap-free full-earth image – fills swath gaps and night. */
export const BLUE_MARBLE =
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg';

/** Earth at night (NASA Black Marble 2016 composite). */
export const BLACK_MARBLE = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png';

/** NASA FIRMS thermal anomalies rendered by GIBS WMS (works for its vector layers too). */
export const gibsFires = (date: string) =>
  `https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=VIIRS_NOAA20_Thermal_Anomalies_375m_All&STYLES=&FORMAT=image/png&TRANSPARENT=true&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256&TIME=${date}`;

/** Live global infrared cloud composite (multi-satellite) from EUMETSAT's view service. */
export const EUMETSAT_IR =
  'https://view.eumetsat.int/geoserver/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=mumi:worldcloudmap_ir108&STYLES=&FORMAT=image/png&TRANSPARENT=true&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256';

/** NASA GPM IMERG satellite precipitation rate (30 min, latest available). */
export const IMERG_WMS =
  'https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=IMERG_Precipitation_Rate&STYLES=&FORMAT=image/png&TRANSPARENT=true&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256';

/** Daily satellite ocean products from NASA GIBS (two days back – processing latency). */
export const gibsSst = (date: string) =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/GHRSST_L4_MUR_Sea_Surface_Temperature/default/${date}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png`;
export const gibsSeaIce = (date: string) =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/GHRSST_L4_MUR_Sea_Ice_Concentration/default/${date}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png`;

/** HD satellite: daily true-colour mosaic of NOAA-21 VIIRS (fewest gaps of the three VIIRS satellites, ~250 m). */
export const HD_SAT = 'VIIRS_NOAA21';
/** used instead when NOAA-21 delivers nothing at all (probed in globe.ts) */
export const HD_SAT_BACKUP = 'VIIRS_NOAA20';

/** DWD precipitation radar composite for Germany (5 min, 1 km), latest scan. */
export const DWD_RADAR_WMS =
  'https://maps.dwd.de/geoserver/dwd/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=dwd:Niederschlagsradar&STYLES=&FORMAT=image/png&TRANSPARENT=true&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256';

export const DWD_WMS =
  'https://maps.dwd.de/geoserver/dwd/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=dwd:Warnungen_Gemeinden_vereinigt&STYLES=&FORMAT=image/png&TRANSPARENT=true&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256';

const empty = { type: 'geojson' as const, data: { type: 'FeatureCollection' as const, features: [] } };

/**
 * Complete style with every layer present but hidden; the panel only flips visibility,
 * which keeps the z-order stable: base → weather → warnings → labels → night → events.
 */
export function buildStyle(nasaDate: string, firesDate: string, projection: 'globe' | 'mercator'): StyleSpecification {
  return {
    version: 8,
    projection: { type: projection },
    glyphs: OFM_GLYPHS,
    sky: {
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
    },
    sources: {
      satellite: {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        maxzoom: 18,
        attribution: 'Powered by <a href="https://www.esri.com/">Esri</a> · Bilder: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
      },
      sentinel: {
        type: 'raster',
        tiles: [EOX_S2],
        tileSize: 256,
        maxzoom: 14,
        attribution:
          '<a href="https://s2maps.eu">Sentinel-2 cloudless</a> by <a href="https://eox.at">EOX IT Services GmbH</a> (Contains modified Copernicus Sentinel data 2024, CC BY-NC-SA 4.0)',
      },
      opentopo: {
        type: 'raster',
        tiles: [OPENTOPO],
        tileSize: 256,
        maxzoom: 17,
        attribution: 'Karte © <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA), Daten © OpenStreetMap-Mitwirkende, SRTM',
      },
      bluemarble: {
        type: 'raster',
        tiles: [BLUE_MARBLE],
        tileSize: 256,
        maxzoom: 8,
        attribution: 'NASA Blue Marble',
      },
      nasa: {
        type: 'raster',
        tiles: [gibsTrueColor(nasaDate)],
        tileSize: 256,
        maxzoom: 9,
        attribution: 'NASA EOSDIS GIBS / VIIRS',
      },
      hd: { type: 'raster', tiles: [gibsTrueColor(nasaDate, HD_SAT)], tileSize: 256, maxzoom: 9, attribution: 'NASA EOSDIS GIBS / VIIRS' },
      blackmarble: {
        type: 'raster',
        tiles: [BLACK_MARBLE],
        tileSize: 256,
        maxzoom: 8,
        attribution: 'Nachtlichter: NASA Black Marble',
      },
      ofm: { type: 'vector', url: OFM_SOURCE, attribution: OFM_ATTR },
      'dwd-radar': {
        type: 'raster',
        tiles: [DWD_RADAR_WMS],
        tileSize: 256,
        bounds: [1.5, 45.5, 19, 56.5],
        attribution: 'Radar © <a href="https://www.dwd.de/">DWD</a>',
      },
      field: {
        type: 'raster',
        tiles: ['wxfield://temp/0/{z}/{x}/{y}'],
        tileSize: 256,
        maxzoom: 5,
        attribution: 'Modelldaten: <a href="https://open-meteo.com/">Open-Meteo</a>',
      },
      'sat-ir': {
        type: 'raster',
        tiles: [EUMETSAT_IR],
        tileSize: 256,
        maxzoom: 7,
        attribution: `Satellit © <a href="https://view.eumetsat.int/">EUMETSAT</a> ${new Date().getUTCFullYear()}`,
      },
      imerg: {
        type: 'raster',
        tiles: [IMERG_WMS],
        tileSize: 256,
        maxzoom: 7,
        attribution: 'NASA GPM IMERG',
      },
      sst: {
        type: 'raster',
        tiles: [gibsSst(gibsDate(2))],
        tileSize: 256,
        maxzoom: 7,
        attribution: 'Meerestemperatur: NASA GHRSST MUR / GIBS',
      },
      seaice: {
        type: 'raster',
        tiles: [gibsSeaIce(gibsDate(2))],
        tileSize: 256,
        maxzoom: 7,
        attribution: 'Meereis: NASA GHRSST MUR / GIBS',
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
      'dwd-warn': { ...empty, attribution: 'Warnungen © <a href="https://www.dwd.de/">DWD</a>' },
      gauges: { ...empty, attribution: 'Pegel: <a href="https://www.pegelonline.wsv.de/">WSV PEGELONLINE</a>' },
      cities: { ...empty, attribution: 'Wetter: <a href="https://open-meteo.com/">Open-Meteo</a>' },
      aq: { ...empty, attribution: 'Luftqualität: Copernicus CAMS / Open-Meteo' },
      isobars: { ...empty, attribution: 'Isobaren: <a href="https://open-meteo.com/">Open-Meteo.com</a> (CC BY 4.0)' },
      'nws-poly': { ...empty, attribution: 'Warnungen USA: <a href="https://www.weather.gov/">NOAA/NWS</a>' },
      tracks: { ...empty, attribution: 'Sturmbahnen: <a href="https://eonet.gsfc.nasa.gov/">NASA EONET</a>' },
      quakes: { ...empty, attribution: 'Erdbeben: USGS, <a href="https://www.emsc-csem.org/">EMSC</a>' },
      firms: { ...empty, attribution: 'Feuer: <a href="https://firms.modaps.eosdis.nasa.gov/">NASA FIRMS</a>' },
      events: {
        ...empty,
        attribution:
          'Ereignisse: <a href="https://eonet.gsfc.nasa.gov/">NASA EONET</a>, <a href="https://www.gdacs.org/">GDACS</a>, <a href="https://www.spc.noaa.gov/">NOAA SPC</a>, <a href="https://www.weather.gov/">NWS</a>, USGS, <a href="https://www.emsc-csem.org/">EMSC</a>',
      },
      marker: empty,
    },
    layers: [
      { id: 'space', type: 'background', paint: { 'background-color': '#05070d' } },
      {
        id: 'base-satellite',
        type: 'raster' as const,
        source: 'satellite',
        layout: { visibility: 'none' as const },
        paint: { 'raster-saturation': -0.15, 'raster-brightness-max': 0.85 },
      },
      { id: 'base-sentinel', type: 'raster' as const, source: 'sentinel', layout: { visibility: 'none' as const } },
      { id: 'base-topo', type: 'raster' as const, source: 'opentopo', layout: { visibility: 'none' as const } },
      { id: 'base-nasa', type: 'raster' as const, source: 'nasa', layout: { visibility: 'none' as const } },
      { id: 'base-blue', type: 'raster' as const, source: 'bluemarble', layout: { visibility: 'none' as const } },
      { id: 'base-night', type: 'raster' as const, source: 'blackmarble', layout: { visibility: 'none' as const } },
      ...baseLayers('dark'),
      ...baseLayers('light'),
      { id: 'hd', type: 'raster' as const, source: 'hd', layout: { visibility: 'none' as const } },
      {
        id: 'field',
        type: 'raster',
        source: 'field',
        layout: { visibility: 'none' },
        paint: { 'raster-resampling': 'linear', 'raster-fade-duration': 0 },
      },
      { id: 'dwd-radar', type: 'raster', source: 'dwd-radar', layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.85 } },
      { id: 'sat-ir', type: 'raster', source: 'sat-ir', layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.9 } },
      { id: 'imerg', type: 'raster', source: 'imerg', layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.9 } },
      { id: 'sst', type: 'raster', source: 'sst', layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.85 } },
      { id: 'seaice', type: 'raster', source: 'seaice', layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.9 } },
      // Radar & OWM layers are inserted before this anchor at runtime.
      { id: 'anchor-weather', type: 'background', layout: { visibility: 'none' }, paint: { 'background-opacity': 0 } },
      { id: 'dwd', type: 'raster', source: 'dwd', layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.75 } },
      { id: 'hotspots', type: 'raster', source: 'hotspots', layout: { visibility: 'none' } },
      {
        id: 'dwd-warn-fill',
        type: 'fill',
        source: 'dwd-warn',
        layout: { visibility: 'none' },
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.45 },
      },
      {
        id: 'dwd-warn-line',
        type: 'line',
        source: 'dwd-warn',
        layout: { visibility: 'none' },
        paint: { 'line-color': ['get', 'color'], 'line-width': 1 },
      },
      ...labelLayers(),
      {
        id: 'night',
        type: 'fill',
        source: 'night',
        layout: { visibility: 'none' },
        paint: { 'fill-color': '#000814', 'fill-opacity': 0.38, 'fill-antialias': false },
      },
      {
        id: 'isobars',
        type: 'line',
        source: 'isobars',
        filter: ['==', ['geometry-type'], 'LineString'],
        layout: { visibility: 'none', 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': 'rgba(255,255,255,0.75)',
          'line-width': ['case', ['get', 'major'], 1.6, 0.9],
        },
      },
      {
        id: 'isobar-labels',
        type: 'symbol',
        source: 'isobars',
        filter: ['==', ['geometry-type'], 'LineString'],
        layout: {
          visibility: 'none',
          'symbol-placement': 'line',
          'symbol-spacing': 320,
          'text-field': ['to-string', ['get', 'p']],
          'text-font': FONT_BOLD,
          'text-size': 11,
          'text-keep-upright': true,
        },
        paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.65)', 'text-halo-width': 1.4 },
      },
      {
        id: 'pressure-centers',
        type: 'symbol',
        source: 'isobars',
        filter: ['==', ['geometry-type'], 'Point'],
        layout: {
          visibility: 'none',
          'text-field': ['format', ['get', 'label'], { 'font-scale': 1.5 }, '\n', {}, ['to-string', ['get', 'p']], { 'font-scale': 0.75 }],
          'text-font': FONT_BOLD,
          'text-size': 15,
          'text-allow-overlap': true,
        },
        paint: {
          'text-color': ['case', ['==', ['get', 'kind'], 'high'], '#ff6b6b', '#6bb6ff'],
          'text-halo-color': 'rgba(0,0,0,0.7)',
          'text-halo-width': 1.5,
        },
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
        id: 'gauges',
        type: 'circle',
        source: 'gauges',
        layout: { visibility: 'none', 'circle-sort-key': ['get', 'weight'] },
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 3, 8, 6, 12, 8],
          'circle-stroke-color': 'rgba(255,255,255,0.9)',
          'circle-stroke-width': 1,
        },
      },
      {
        id: 'aq-circle',
        type: 'circle',
        source: 'aq',
        layout: { visibility: 'none' },
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 9, 8, 14],
          'circle-stroke-color': 'rgba(0,0,0,0.5)',
          'circle-stroke-width': 1,
        },
      },
      {
        id: 'aq-text',
        type: 'symbol',
        source: 'aq',
        layout: {
          visibility: 'none',
          'text-field': ['to-string', ['get', 'aqi']],
          'text-font': FONT_BOLD,
          'text-size': ['interpolate', ['linear'], ['zoom'], 3, 9, 8, 12],
          'text-allow-overlap': true,
        },
        paint: { 'text-color': '#10131c' },
      },
      {
        id: 'cities',
        type: 'symbol',
        source: 'cities',
        layout: {
          visibility: 'none',
          'icon-image': ['get', 'icon'],
          'icon-size': ['interpolate', ['linear'], ['zoom'], 2, 0.75, 7, 1],
          'text-field': ['format', ['get', 'temp'], { 'font-scale': 1.1, 'text-font': ['literal', FONT_BOLD] }, '\n', {}, ['get', 'name'], { 'font-scale': 0.8 }],
          'text-font': FONT_REGULAR,
          'text-size': 12,
          'text-anchor': 'left',
          'text-offset': [1.3, 0],
          'text-justify': 'left',
          'symbol-sort-key': ['get', 'rank'],
          'icon-padding': 4,
        },
        paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1.3 },
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
