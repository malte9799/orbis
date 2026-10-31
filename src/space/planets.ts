// Map sources per body. Shared by the 3D close-up tiles (space view) and the 2D map view
// (views/planetmap.ts), so the "zoom in far → map" feature is one global mechanism: a body
// only needs an entry here. `enabled` switches it on – Earth (weather map), Mars, the Moon,
// Mercury and the smaller Trek bodies (Titan, Saturn's moons, Vesta, Ceres).
//
// All sources are equirectangular tile pyramids (level 0 = 2 × 1 tiles, level z spans
// 180 / 2^z degrees per tile, rows counted from the north pole).

import { MARS_PRODUCTS, type TrekProduct } from './mars-products';
import { MOON_PRODUCTS } from './moon-products';
import { TREK_PRODUCTS } from './trek-products';

export interface TileLayer {
  id: string;
  /** message-key suffix (space.layer.*); display texts are translated in the views */
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
  /** labels of the automatic map ("auto": base + regional mosaics) and of the plain global colour mosaic (message-key suffixes) */
  autoLabel?: string;
  globalLabel?: string;
  /** more map products (NASA Trek): global maps, regional mosaics, thematic overlays */
  products?: MapProduct[];
  /** global height model for the 3D relief (NASA Trek serves it as a stretched 8-bit image) */
  dem?: DemConfig;
}

export interface DemConfig {
  layer: TileLayer;
  /** height at grey 0 / grey 255 – Trek stretches the DEM over its full range, the metres are approximate */
  minM: number;
  maxM: number;
}

export interface MapProduct {
  id: string;
  title: string;
  /** base: global map · mosaic: composited into "auto" · region: regional map · overlay: transparent thematic layer · dem: regional height model (3D terrain) */
  group: 'base' | 'mosaic' | 'region' | 'overlay' | 'dem';
  /** west, south, east, north */
  bbox: [number, number, number, number];
  layer: TileLayer;
}

const MARS_COLOR = trek('Mars', 'Mars_Viking_MDIM21_ClrMosaic_global_232m', 'marsColor', 'NASA/USGS Viking MDIM 2.1 · NASA Mars Trek', 7);
const MARS_CTX: TileLayer = {
  id: 'ctx',
  label: 'ctx',
  credit: 'NASA/JPL/MSSS/Caltech Murray Lab · Powered by Esri',
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
        // HRSC products are CC BY-SA 3.0 IGO and must name ESA/DLR/FU Berlin
        credit: (esri ? credit.esri : credit.trek) + (/HRSC/i.test(`${id} ${title}`) ? ' · HRSC: ESA/DLR/FU Berlin, CC BY-SA 3.0 IGO' : ''),
        px,
        maxZ,
        url: (z, r, c) => base.replace('{z}', String(z)).replace('{r}', String(r)).replace('{c}', String(c)),
      },
    };
  });
const MARS_TREK_PRODUCTS = trekProducts(MARS_PRODUCTS, { trek: 'NASA/JPL/USGS/ASU/ESA/University of Arizona · NASA Mars Trek', esri: 'NASA/JPL/University of Arizona (HiRISE) · Powered by Esri' });
const MOON_TREK_PRODUCTS = trekProducts(MOON_PRODUCTS, { trek: 'NASA/GSFC/ASU/JAXA/USGS · NASA Moon Trek', esri: 'NASA/GSFC/ASU LROC · Powered by Esri' });
/** the Trek portals without their own script (see scripts/trek-products.mjs) */
const trekList = (id: string) => trekProducts(TREK_PRODUCTS[id] ?? [], { trek: 'NASA/JPL/USGS · NASA Trek', esri: 'NASA/JPL/USGS · NASA Trek' });

const MOON_WAC = trek('Moon', 'LRO_WAC_Mosaic_Global_303ppd_v02', 'moonWac', 'NASA/GSFC/ASU LRO WAC · NASA Moon Trek', 7);
const MERCURY_BDR = trek('Mercury', 'Mercury_MESSENGER_MDIS_Basemap_BDR_Mosaic_Global_166m', 'mercuryBdr', 'NASA/JHUAPL/CIW MESSENGER MDIS · NASA Mercury Trek', 7);
const MERCURY_COLOR = trek('Mercury', 'Mercury_MESSENGER_MDIS_Basemap_EnhancedColor_Mosaic_Global_665m', 'mercuryColor', 'NASA/JHUAPL/CIW MESSENGER MDIS · NASA Mercury Trek', 6);

// global height models (Trek serves them as a grey-scale image stretched over the full range;
// LOLA spans about -9.1 … +10.8 km, the Cassini DEM of Enceladus about ± 1.5 km) – PNG only
const MOON_LOLA_DEM = trek('Moon', 'LRO_LOLA_DEM_Global_128ppd_v04', 'lolaDem', 'NASA/GSFC/ASU LRO LOLA · NASA Moon Trek', 5, 'png');
const ENCELADUS_DEM = trek('Enceladus', 'Cassini_ISS_DEM_375m_Global', 'enceladusDem', 'NASA/JPL/SSI/DLR · NASA Trek', 4, 'png');
// colour hillshades: relief as a basemap where no usable DEM tiles exist (Mars, Mercury, Ceres)
const MOON_LOLA_CLRSHADE = trek('Moon', 'LRO_LOLA_ClrShade_Global_128ppd_v04', 'lolaClrShade', 'NASA/GSFC/ASU LRO LOLA · NASA Moon Trek', 5, 'png');
const MERCURY_SHADE = trek('Mercury', 'Mercury_Messenger_USGS_DEM_665m_v2_HillshadeColor', 'mercuryShade', 'NASA/JHUAPL/CIW MESSENGER MDIS · NASA Mercury Trek', 5, 'png');

// Saturnmonde und Kleinkörper aus den Trek-Portalen (Kacheln bis zum letzten Level gegenprüft)
const TITAN_CASSINI = trek('Titan', 'Titan_global_32ppd_ColorRatio_v2', 'titanCassini', 'NASA/JPL/SSI · NASA Trek', 4, 'png');
const MIMAS_CASSINI = trek('Mimas', 'MI_170630_DLR_basemap', 'mimasCassini', 'NASA/JPL/SSI/DLR · NASA Trek', 4);
const ENCELADUS_CASSINI = trek('Enceladus', 'Enceladus_Cassini_mosaic_global_110m', 'enceladusCassini', 'NASA/JPL/SSI/DLR · NASA Trek', 5);
const TETHYS_CASSINI = trek('Tethys', 'Tethys_Cassini_mosaic_global_293m', 'tethysCassini', 'NASA/JPL/SSI/DLR · NASA Trek', 4);
const DIONE_CASSINI = trek('Dione', 'Dione_Cassini_Voyageglobal_154m', 'dioneCassini', 'NASA/JPL/SSI · NASA Trek', 5);
const RHEA_DLR = trek('Rhea', 'RH_120803_DLR_basemap', 'rheaDlr', 'NASA/JPL/SSI/DLR · NASA Trek', 4);
const IAPETUS_CASSINI = trek('Iapetus', 'Iapetus_Cassini_Voyager_mosaic_global_783m', 'iapetusCassini', 'NASA/JPL/SSI · NASA Trek', 3);
const VESTA_GRAND = trek('Vesta', 'Vesta_Dawn_GRaND_ClrIronCorrectedCounts_Global_2ppd', 'vestaGrand', 'NASA/JPL-Caltech/UCLA/MPS/DLR/IDA · NASA Trek', 1);
const CERES_DAWN = trek('Ceres', 'Ceres_Dawn_FC_HAMO_ClrShade_DLR_Global_60ppd_Oct2016', 'ceresDawn', 'NASA/JPL-Caltech/UCLA/MPS/DLR/IDA · NASA Trek', 5);

const wide = (b: [number, number, number, number]) => b[2] - b[0] >= 300;

/** assumed height ranges of the global Trek DEMs (served stretched; the metres are approximate) */
const DEM_RANGE: Record<string, [number, number]> = { venus: [-2600, 11400], io: [-9000, 9000], phobos: [-3500, 5500], titan: [-2000, 2000], vesta: [-26000, 20000] };

/** a body whose map comes from the generated Trek lists (one product set per Trek portal) */
const trekBody = (id: string, name: string, radiusKm: number, manual: TileLayer[] = []): PlanetMapConfig => {
  const list = trekList(id);
  const bases = list.filter((p) => p.group === 'base');
  // default map: a real global imagery mosaic (resolution first, then footprint)
  const score = (p: { layer: { maxZ: number }; bbox: [number, number, number, number] }) => (wide(p.bbox) ? 1e12 : 0) + p.layer.maxZ * 1e9 + (p.bbox[2] - p.bbox[0]) * (p.bbox[3] - p.bbox[1]) * 1e3;
  const first = bases.filter((p) => !/Slope|Hillshade|Shade/i.test(p.title)).sort((a, b) => score(b) - score(a))[0] ?? bases[0];
  const products = list.filter((p) => p !== first);
  const gdem = list.find((p) => p.group === 'dem' && wide(p.bbox));
  const range = DEM_RANGE[id];
  return {
    id,
    name,
    radiusKm,
    enabled: !!(first || manual.length),
    openAt: 1.03,
    layers: first ? [...manual, first.layer] : manual,
    detail3d: () => first?.layer ?? manual[0] ?? list[0]?.layer ?? MARS_COLOR,
    baseLevel: 4,
    ...(products.length ? { products } : {}),
    ...(gdem && range ? { dem: { layer: gdem.layer, minM: range[0], maxM: range[1] } } : {}),
  };
};

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
    autoLabel: 'autoMars',
    globalLabel: 'marsColor',
    products: MARS_TREK_PRODUCTS,
  },
  // the space view keeps its own close-up tiles for the Moon; its map takes over very close to the surface
  moon: { id: 'moon', name: 'Mond', radiusKm: 1737.4, enabled: true, openAt: 1.03, layers: [MOON_WAC, MOON_LOLA_CLRSHADE], detail3d: () => MOON_WAC, baseLevel: 4, autoLabel: 'autoMoon', products: MOON_TREK_PRODUCTS, dem: { layer: MOON_LOLA_DEM, minM: -9150, maxM: 10800 } },
  mercury: { id: 'mercury', name: 'Merkur', radiusKm: 2439.7, enabled: true, openAt: 1.1, layers: [MERCURY_BDR, MERCURY_COLOR, MERCURY_SHADE], detail3d: () => MERCURY_BDR, baseLevel: 4, ...(trekList('mercury').length ? { products: trekList('mercury') } : {}) },
  venus: trekBody('venus', 'Venus', 6051.8),
  // the inner Mars moon (map from Viking/MExLab mosaics, relief from the HRSC/MExLab height models)
  phobos: trekBody('phobos', 'Phobos', 11.267),
  // the Galilean moons (Galileo SSI/Voyager mosaics, regional SSI DEMs)
  io: trekBody('io', 'Io', 1821.6),
  europa: trekBody('europa', 'Europa', 1560.8),
  ganymede: trekBody('ganymede', 'Ganymede', 2634.1),
  callisto: trekBody('callisto', 'Callisto', 2410.3),
  // Saturn's moons and small bodies, mapped from NASA Trek (one global mosaic each)
  mimas: { id: 'mimas', name: 'Mimas', radiusKm: 198.2, enabled: true, openAt: 1.03, layers: [MIMAS_CASSINI], detail3d: () => MIMAS_CASSINI, baseLevel: 4 },
  enceladus: { id: 'enceladus', name: 'Enceladus', radiusKm: 252.1, enabled: true, openAt: 1.03, layers: [ENCELADUS_CASSINI], detail3d: () => ENCELADUS_CASSINI, baseLevel: 4, ...(trekList('enceladus').length ? { products: trekList('enceladus') } : {}), dem: { layer: ENCELADUS_DEM, minM: -1500, maxM: 1500 } },
  tethys: { id: 'tethys', name: 'Tethys', radiusKm: 531.1, enabled: true, openAt: 1.03, layers: [TETHYS_CASSINI], detail3d: () => TETHYS_CASSINI, baseLevel: 4 },
  dione: { id: 'dione', name: 'Dione', radiusKm: 561.4, enabled: true, openAt: 1.03, layers: [DIONE_CASSINI], detail3d: () => DIONE_CASSINI, baseLevel: 4 },
  rhea: { id: 'rhea', name: 'Rhea', radiusKm: 763.8, enabled: true, openAt: 1.03, layers: [RHEA_DLR], detail3d: () => RHEA_DLR, baseLevel: 4 },
  titan: {
    id: 'titan',
    name: 'Titan',
    radiusKm: 2574.7,
    enabled: true,
    openAt: 1.03,
    layers: [TITAN_CASSINI],
    detail3d: () => TITAN_CASSINI,
    baseLevel: 4,
    ...(trekList('titan').length ? { products: trekList('titan') } : {}),
    ...(trekList('titan').find((p) => p.group === 'dem' && wide(p.bbox))
      ? { dem: { layer: trekList('titan').find((p) => p.group === 'dem' && wide(p.bbox))!.layer, minM: DEM_RANGE.titan[0], maxM: DEM_RANGE.titan[1] } }
      : {}),
  },
  iapetus: { id: 'iapetus', name: 'Iapetus', radiusKm: 734.5, enabled: true, openAt: 1.03, layers: [IAPETUS_CASSINI], detail3d: () => IAPETUS_CASSINI, baseLevel: 4 },
  vesta: trekBody('vesta', 'Vesta', 262.7, [VESTA_GRAND]),
  ceres: trekBody('ceres', 'Ceres', 469.7, [CERES_DAWN]),
  // Ryugu appears in no 3D view (no body entry) – its map is reachable by URL and dropdown
  ryugu: trekBody('ryugu', 'Ryugu', 0.4483),
};

export const mapEnabled = (id: string) => !!PLANET_MAPS[id]?.enabled && PLANET_MAPS[id].layers.length > 0;
