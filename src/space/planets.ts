// Map sources per body. Shared by the 3D close-up tiles (space view) and the 2D map view
// (views/planetmap.ts), so the "zoom in far → map" feature is one global mechanism: a body
// only needs an entry here. `enabled` switches it on – for now Earth (weather map), Mars and the Moon.
//
// All sources are equirectangular tile pyramids (level 0 = 2 × 1 tiles, level z spans
// 180 / 2^z degrees per tile, rows counted from the north pole).

import { MARS_PRODUCTS, type TrekProduct } from './mars-products';
import { MOON_PRODUCTS } from './moon-products';

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
  /** levels the server fills with the wrong picture (the same scene repeated) – the next finer level is used instead */
  skipLevels?: number[];
  /** not verified against the server: the map hides the entry if its preview tile cannot be loaded */
  optional?: boolean;
}

const trek = (body: string, layer: string, label: string, credit: string, maxZ: number, ext = 'jpg'): TileLayer => ({
  id: layer,
  label,
  credit,
  px: 256,
  maxZ,
  url: (z, r, c) => `https://trek.nasa.gov/tiles/${body}/EQ/${layer}/1.0.0/default/default028mm/${z}/${r}/${c}.${ext}`,
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
  /** labels of the automatic map ("auto": base + regional mosaics) and of the plain global colour mosaic */
  autoLabel?: string;
  globalLabel?: string;
  /** more map products (NASA Trek): global maps, regional mosaics, thematic overlays */
  products?: MapProduct[];
}

export interface MapProduct {
  id: string;
  title: string;
  /** base: global map · mosaic: composited into "auto" · region: regional map · overlay: transparent thematic layer */
  group: 'base' | 'mosaic' | 'region' | 'overlay';
  /** west, south, east, north */
  bbox: [number, number, number, number];
  layer: TileLayer;
}

const MARS_COLOR = trek('Mars', 'Mars_Viking_MDIM21_ClrMosaic_global_232m', 'Farbmosaik (Viking, 232 m)', 'NASA/USGS Viking MDIM 2.1 · NASA Mars Trek', 7);
const MARS_CTX: TileLayer = {
  id: 'ctx',
  label: 'Kontextkamera (CTX, ≈ 5 m)',
  credit: 'NASA/JPL/MSSS/Caltech Murray Lab · Esri',
  px: 512,
  maxZ: 12,
  tint: 0xe3b79c,
  // Esri's level 7 is broken in places: tiles show one and the same crater scene (e.g. 7/49/186, 7/50/186, 7/70/200)
  skipLevels: [7],
  url: (z, r, c) => `https://astro.arcgis.com/arcgis/rest/services/OnMars/CTX/MapServer/tile/${z}/${r}/${c}`,
};

/** NASA Trek products (generated lists, see scripts/mars-products.mjs and scripts/moon-products.mjs). */
const trekProducts = (list: TrekProduct[], credit: { trek: string; esri: string }): MapProduct[] =>
  list.map(([id, title, group, tpl, px, bbox, maxZ]) => {
    const base = tpl.replace(/^~\//, 'https://trek.nasa.gov/');
    const esri = base.includes('arcgis.com');
    return {
      id,
      title,
      group,
      bbox,
      layer: {
        id,
        label: title,
        credit: esri ? credit.esri : credit.trek,
        px,
        maxZ,
        url: (z, r, c) => base.replace('{z}', String(z)).replace('{r}', String(r)).replace('{c}', String(c)),
      },
    };
  });
const MARS_TREK_PRODUCTS = trekProducts(MARS_PRODUCTS, { trek: 'NASA/JPL/USGS/ASU/ESA/University of Arizona · NASA Mars Trek', esri: 'NASA/JPL/University of Arizona (HiRISE) · Esri' });
const MOON_TREK_PRODUCTS = trekProducts(MOON_PRODUCTS, { trek: 'NASA/GSFC/ASU/JAXA/USGS · NASA Moon Trek', esri: 'NASA/GSFC/ASU LROC · Esri' });

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
    // colour mosaic = "global only", relief and infrared come from the Trek products (higher resolution)
    layers: [MARS_CTX],
    // colour mosaic as far as it goes, then the 5 m CTX mosaic (≥ 2× finer from level 7 on)
    detail3d: (z) => (z <= 6 ? MARS_COLOR : MARS_CTX),
    baseLevel: 4, // 8k texture
    autoLabel: 'Automatisch (Farbe → 5 m → HiRISE)',
    globalLabel: 'Farbmosaik (Viking, 232 m)',
    products: MARS_TREK_PRODUCTS,
  },
  // the space view keeps its own close-up tiles for the Moon; its map takes over very close to the surface
  moon: { id: 'moon', name: 'Mond', radiusKm: 1737.4, enabled: true, openAt: 1.03, layers: [MOON_WAC], detail3d: () => MOON_WAC, baseLevel: 4, autoLabel: 'Automatisch (WAC → LROC-NAC)', products: MOON_TREK_PRODUCTS },
  // prepared, switched on later
  mercury: { id: 'mercury', name: 'Merkur', radiusKm: 2439.7, enabled: false, openAt: 1.1, layers: [MERCURY_BDR, MERCURY_COLOR], detail3d: () => MERCURY_BDR, baseLevel: 4 },
  venus: { id: 'venus', name: 'Venus', radiusKm: 6051.8, enabled: false, openAt: 1.1, layers: [], detail3d: () => MERCURY_BDR, baseLevel: 4 },
};

export const mapEnabled = (id: string) => !!PLANET_MAPS[id]?.enabled && PLANET_MAPS[id].layers.length > 0;
