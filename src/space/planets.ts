// Map sources per body. Shared by the 3D close-up tiles (space view) and the 2D map view
// (views/planetmap.ts), so the "zoom in far → map" feature is one global mechanism: a body
// only needs an entry here. `enabled` switches it on – for now Earth (weather map) and Mars.
//
// All sources are equirectangular tile pyramids (level 0 = 2 × 1 tiles, level z spans
// 180 / 2^z degrees per tile, rows counted from the north pole).

import { MARS_MOSAICS } from './mars-mosaics';

export interface TileLayer {
  id: string;
  label: string;
  credit: string;
  /** WMTS-style tile, row from the north */
  url: (z: number, row: number, col: number) => string;
  /** tile size in pixels */
  px: number;
  /** finest level the server delivers */
  maxZ: number;
  /** grey-scale mosaics are tinted in the 3D view so they blend with the colour base */
  tint?: number;
}

const trek = (body: string, layer: string, label: string, credit: string, maxZ: number, ext = 'jpg'): TileLayer => ({
  id: layer,
  label,
  credit,
  px: 256,
  maxZ,
  url: (z, r, c) => `https://trek.nasa.gov/tiles/${body}/EQ/${layer}/1.0.0/default/default028mm/${z}/${r}/${c}.${ext}`,
});

/** USGS Astrogeology planetary WMS (CORS enabled) as a tile layer. */
const usgsWms = (map: string, layer: string, id: string, label: string, credit: string, maxZ: number): TileLayer => ({
  id,
  label,
  credit,
  px: 256,
  maxZ,
  url: (z, r, c) => {
    const span = 180 / 2 ** z;
    const lon0 = -180 + c * span;
    const lat1 = 90 - r * span;
    return `https://planetarymaps.usgs.gov/cgi-bin/mapserv?map=/maps/${map}&SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${layer}&STYLES=&SRS=EPSG:4326&BBOX=${lon0},${lat1 - span},${lon0 + span},${lat1}&WIDTH=256&HEIGHT=256&FORMAT=image/jpeg`;
  },
});

export interface MapSite {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface PlanetMapConfig {
  id: string;
  name: string;
  radiusKm: number;
  /** feature switch: zoom far in → map view */
  enabled: boolean;
  /** the 3D view opens the map below this camera distance (in body radii) */
  openAt: number;
  /** selectable 2D map layers, the first is the default */
  layers: TileLayer[];
  /** tile source used for the close-up tiles in the 3D view, by level */
  detail3d: (z: number) => TileLayer;
  /** level the global base texture of the 3D body already corresponds to (256 px tiles) */
  baseLevel: number;
  /** sharper regional mosaics drawn on top in the map ('auto' type), finest last */
  regional?: RegionalLayer[];
}

export interface RegionalLayer {
  id: string;
  title: string;
  /** west, south, east, north */
  bbox: [number, number, number, number];
  layer: TileLayer;
}

const MARS_COLOR = trek('Mars', 'Mars_Viking_MDIM21_ClrMosaic_global_232m', 'Farbmosaik (Viking, 232 m)', 'NASA/USGS Viking MDIM 2.1 · NASA Mars Trek', 7);
const MARS_CTX: TileLayer = {
  id: 'ctx',
  label: 'Kontextkamera CTX (≈ 5 m)',
  credit: 'NASA/JPL/MSSS/Caltech Murray Lab · Esri',
  px: 512,
  maxZ: 12,
  tint: 0xe3b79c,
  url: (z, r, c) => `https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX/MapServer/tile/${z}/${r}/${c}`,
};
const MARS_MOLA = trek('Mars', 'Mars_MGS_MOLA_ClrShade_merge_global_463m', 'Höhenrelief (MOLA, 463 m)', 'NASA MGS MOLA · NASA Mars Trek', 7);
const MARS_THEMIS = usgsWms('mars/mars_simp_cyl.map', 'THEMIS', 'themis', 'Infrarot (THEMIS, 100 m)', 'NASA/ASU THEMIS · USGS Astrogeology', 9);

/** NASA Mars Trek regional HiRISE / CTX mosaics (generated list, see scripts/mars-mosaics.mjs). */
const MARS_REGIONAL: RegionalLayer[] = MARS_MOSAICS.map(([label, title, fmt, bbox, maxZ]) => ({
  id: label,
  title,
  bbox,
  layer: trek('Mars', label, title, 'NASA/JPL/University of Arizona (HiRISE), NASA/JPL/MSSS (CTX) · NASA Mars Trek', maxZ, fmt),
}));

const MOON_WAC = trek('Moon', 'LRO_WAC_Mosaic_Global_303ppd_v02', 'LRO-Mosaik (WAC, ≈ 100 m)', 'NASA/GSFC/ASU LRO WAC · NASA Moon Trek', 7);
const MERCURY_BDR = trek('Mercury', 'Mercury_MESSENGER_MDIS_Basemap_BDR_Mosaic_Global_166m', 'MESSENGER-Mosaik (166 m)', 'NASA/JHUAPL/CIW MESSENGER MDIS · NASA Mercury Trek', 7);
const MERCURY_COLOR = trek('Mercury', 'Mercury_MESSENGER_MDIS_Basemap_EnhancedColor_Mosaic_Global_665m', 'Farbkontrast (665 m)', 'NASA/JHUAPL/CIW MESSENGER MDIS · NASA Mercury Trek', 6);

export const PLANET_MAPS: Record<string, PlanetMapConfig> = {
  // Earth keeps its own weather map (views/globe.ts)
  earth: { id: 'earth', name: 'Erde', radiusKm: 6371, enabled: true, openAt: 1.45, layers: [], detail3d: () => MARS_COLOR, baseLevel: 99 },
  mars: {
    id: 'mars',
    name: 'Mars',
    radiusKm: 3389.5,
    enabled: true,
    openAt: 1.1,
    layers: [MARS_CTX, MARS_COLOR, MARS_MOLA, MARS_THEMIS],
    // colour mosaic as far as it goes, then the 5 m CTX mosaic (≥ 2× finer from level 7 on)
    detail3d: (z) => (z <= 6 ? MARS_COLOR : MARS_CTX),
    baseLevel: 4, // 8k texture
    regional: MARS_REGIONAL,
  },
  // prepared, switched on later
  moon: { id: 'moon', name: 'Mond', radiusKm: 1737.4, enabled: false, openAt: 1.1, layers: [MOON_WAC], detail3d: () => MOON_WAC, baseLevel: 4 },
  mercury: { id: 'mercury', name: 'Merkur', radiusKm: 2439.7, enabled: false, openAt: 1.1, layers: [MERCURY_BDR, MERCURY_COLOR], detail3d: () => MERCURY_BDR, baseLevel: 4 },
  venus: { id: 'venus', name: 'Venus', radiusKm: 6051.8, enabled: false, openAt: 1.1, layers: [], detail3d: () => MERCURY_BDR, baseLevel: 4 },
};

export const mapEnabled = (id: string) => !!PLANET_MAPS[id]?.enabled && PLANET_MAPS[id].layers.length > 0;
