// Generic NASA Trek portal → tile products, for the bodies whose maps come entirely from Trek
// (Venus, Io, Europa, Callisto, Phobos, Titan, Enceladus, Mercury; Mars and Moon have their own
// scripts with hand-curated rules). Reads each portal's search index and the WMTS capabilities of
// every product and writes src/space/trek-products.ts. Run: node scripts/trek-products.mjs
// (the deploy workflow runs it, optional; on errors the committed list stays untouched).
//
// Portals without an EQ index (Callisto) or extra products of other portals are covered by "seeds":
// labels probed directly under /tiles/<Folder>/EQ/<label>/.

import { writeFileSync } from 'node:fs';

const get = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r;
};

const PORTALS = [
  { slug: 'venus', body: 'venus', folder: 'Venus', pages: 2, filter: /Global|Mosaic|Topograph|Slope|DEM|Emissivity|Reflectivity|FMAP|Magellan/i, seeds: ['Venus_Magellan_Topography_Global_4641m_gapfilled_v02', 'Venus_Magellan_Slope_Global_4641m_gapfilled_v02', 'Venus_Magellan_FresnelReflectivity_Global_4641m', 'Venus_Magellan_MicrowaveEmissivity_Global_4641m'] },
  { slug: 'europa', body: 'europa', folder: 'Europa', pages: 1, filter: /Global|Mosaic|DEM|DTM|Mosaic|Atlas/i, seeds: ['GLL_SSI_DEM_105mpp_Tyre', 'GLL_SSI_DEM_165mpp_Pwyll', 'GLL_SSI_DEM_237mpp_Manannan', 'GLL_SSI_DEM_642mpp_Castalia_Macula'] },
  { slug: 'io', body: 'io', folder: 'Io', pages: 1, filter: /Global|Mosaic|DEM|Atlas|Color/i, seeds: ['IoDEM', 'TvashtarPaterae_DEM_900m'] },
  { slug: 'phobos', body: 'phobos', folder: 'Phobos', pages: 1, filter: /Global|Mosaic|DEM|DTM|Mosaic|Atlas/i, seeds: ['DTM_MExLab_200_final', 'Phobos_ME_HRSC_DEM_Global_2ppd'] },
  { slug: 'titan', body: 'titan', folder: 'Titan', pages: 1, filter: /Global|HiSAR|32ppd|shape/i, known: ['Titan_global_32ppd_ColorRatio_v2'], seeds: ['TitanISS2018June.proj.scale', 'Titan_global_32ppd_2microns_v2', 'Titan_global_32ppd_5microns_v2', 'Titan_SAR_HiSAR_MosaicThru_T104_Jan2015_clon180_128ppd', 'Titan_ISS_P19658_Mosaic_Global_4km', 'shape_4PPD_geoid_corrected0'] },
  { slug: 'callisto', body: 'callisto', folder: 'Callisto', pages: 0, seeds: ['Callisto_NIMS_composite_30_local_30_global_USGS_back_600_dpi_clipt_QGIS'] },
  { slug: 'mercury', body: 'mercury', folder: 'Mercury', pages: 1, filter: /Global|DEM|Mosaic|Geolog/i, known: ['Mercury_MESSENGER_MDIS_Basemap_BDR_Mosaic_Global_166m', 'Mercury_MESSENGER_MDIS_Basemap_EnhancedColor_Mosaic_Global_665m'] },
  { slug: 'enceladus', body: 'enceladus', folder: 'Enceladus', pages: 1, filter: /Global|DEM|Mosaic|Hillshade|Geologic/i, known: ['Enceladus_Cassini_mosaic_global_110m', 'Cassini_ISS_DEM_375m_Global'] },
  { slug: 'ganymede', body: 'ganymede', folder: 'Ganymede', pages: 1, filter: /Global|Mosaic|DEM/i, seeds: [] },
  { slug: 'vesta', body: 'vesta', folder: 'Vesta', pages: 1, filter: /Global|Mosaic|DEM|DTM|Mosaic|Atlas|HAMO|LAMO|Color/i, known: ['Vesta_Dawn_GRaND_ClrIronCorrectedCounts_Global_2ppd'], seeds: ['VestaHAMOLAMOBlend.eq', 'Vesta_Dawn_FC_HAMO_Mosaic_Global_74ppd', 'Vesta_Dawn_HAMO_TrueClr_DLR_global_74ppd_IAU'] },
  { slug: 'ceres', body: 'ceres', folder: 'Ceres', pages: 1, filter: /Global|Mosaic|DEM|DTM|Mosaic|Atlas|HAMO|LAMO|Color|Shade/i, known: ['Ceres_Dawn_FC_HAMO_ClrShade_DLR_Global_60ppd_Oct2016'], seeds: ['Ceres_Dawn_FC_DLR_global_20ppd_Oct2015'] },
  // Bennu/Ryugu: Trek serves their shape DEMs only via ImageServer (no /tiles/ mirror, no photomosaics) → no map products
  { slug: 'bennu', body: 'bennu', folder: 'Bennu', pages: 0, seeds: ['Bennu_global_ShapeV28_5cm_DEM'] },
  { slug: 'ryugu', body: 'ryugu', folder: 'Ryugu', pages: 1, filter: /Global|Mosaic|DEM|DTM|Mosaic|Atlas/i, seeds: ['ryugu_global_dem_obj'] },
];

const BASE_CATS = new Set(['Imagery', 'Topography']);
const OVERLAY_CATS = new Set(['Geology', 'Landforms', 'Mineral', 'Mineralogy', 'Composition', 'Spectrometer', 'Exploration Zones', 'Terrain', 'Geochemistry']);
const isImage = (t) => /(NAC|HiRISE|HIRISE|CTX|Apollo|LROC|Chang.?e|CE-?2|Kaguya|Ortho|Mosaic)/i.test(t) && !/Shade|Slope|DEM|Elevation|DTM|Geologic/i.test(t);

const out = {};

for (const portal of PORTALS) {
  const found = [];
  try {
    // the search index (paginated; huge portals are read only in part – seeds cover the important products)
    const docs = [];
    for (let s = 0; s < portal.pages * 500; s += 500) {
      const d = await (await get(`https://trek.nasa.gov/${portal.slug}/TrekServices/ws/index/eq/searchItems?proj=eq&rows=500&start=${s}`)).json();
      docs.push(...d.response.docs);
      if (d.response.docs.length < 500) break;
    }
    const candidates = new Map();
    for (const label of portal.seeds ?? []) {
      const doc = docs.find((x) => x.productLabel === label);
      candidates.set(label, doc ? { title: doc.title ?? label, cat1: doc.productCat1 } : { title: label, cat1: undefined });
    }
    for (const x of docs) {
      if ((x.itemType !== 'product' && x.itemType !== 'dataset') || !x.productLabel) continue;
      if ((portal.known ?? []).includes(x.productLabel)) continue;
      if (portal.filter && !(portal.filter.test(`${x.productLabel} ${x.title ?? ''}`) || (x.productCat2 ?? '') === 'DEM')) continue;
      if (!candidates.has(x.productLabel)) candidates.set(x.productLabel, { title: x.title ?? x.productLabel, cat1: x.productCat1 });
    }
    // validate the WMTS pyramid of every candidate (the plain 2×1 equirectangular grid)
    let probed = 0;
    for (const [label, cand] of candidates) {
      if (probed++ > 60) break;
      const title = cand.title;
      const cat1 = cand.cat1;
      try {
        const t = await (await get(`https://trek.nasa.gov/tiles/${portal.folder}/EQ/${label}/1.0.0/WMTSCapabilities.xml`)).text();
        const bb = /<ows:WGS84BoundingBox[^>]*>\s*<ows:LowerCorner>([-\d.eE ]+)<\/ows:LowerCorner>\s*<ows:UpperCorner>([-\d.eE ]+)<\/ows:UpperCorner>/.exec(t);
        const widths = [...t.matchAll(/<MatrixWidth>([\d.]+)<\/MatrixWidth>/g)].map((m) => +m[1]);
        const heights = [...t.matchAll(/<MatrixHeight>([\d.]+)<\/MatrixHeight>/g)].map((m) => +m[1]);
        const tpl = /ResourceURL[^>]*template="([^"]+)"/.exec(t)?.[1];
        const set = /<TileMatrixSetLink>\s*<TileMatrixSet>([^<]+)</.exec(t)?.[1];
        const px = +(/<TileWidth>(\d+)</.exec(t)?.[1] ?? 256);
        if (!bb || !tpl || !set || widths[0] !== 2 || heights[0] !== 1) continue;
        const [w, s] = bb[1].trim().split(/\s+/).map(Number);
        const [e, n] = bb[2].trim().split(/\s+/).map(Number);
        const url0 = tpl.replace('{Style}', 'default').replace('{TileMatrixSet}', set).replace('{TileMatrix}', '{z}').replace('{TileRow}', '{r}').replace('{TileCol}', '{c}').replace(/([^:])\/\//g, '$1/');
        const cLon = (w + e) / 2;
        const cLat = (s + n) / 2;
        let maxZ = widths.length - 1;
        for (; maxZ > 0; maxZ--) {
          const span = 180 / 2 ** maxZ;
          const u = url0.replace('{z}', maxZ).replace('{r}', Math.floor((90 - cLat) / span)).replace('{c}', Math.floor((cLon + 180) / span));
          const ok = await fetch(u, { method: 'HEAD', signal: AbortSignal.timeout(20000) }).then((r) => r.ok).catch(() => false);
          if (ok) break;
        }
        const global = e - w > 300;
        const isDem = /DEM|DTM/i.test(`${label} ${title}`) && !/Shade|Slope|Color|Confidence|Precision|Count|Error|Mask/i.test(`${label} ${title}`);
        let group;
        if (isDem) group = 'dem';
        else if (BASE_CATS.has(cat1) || global) group = 'base';
        else if (isImage(`${label} ${title}`) && maxZ >= 10) group = 'mosaic';
        else if (OVERLAY_CATS.has(cat1)) group = 'overlay';
        else if (cat1 === 'Topography' || cat1 === 'Imagery') group = 'region';
        else continue;
        found.push({
          label,
          title,
          group,
          url: url0,
          px,
          bbox: [w, s, e, n].map((v) => Math.round(v * 1e3) / 1e3),
          maxZ,
          global,
        });
      } catch {
        /* layer not served */
      }
    }
  } catch (e) {
    console.log(`${portal.slug}: Index nicht erreichbar (${e.message})`);
  }

  // ---- curation ----------------------------------------------------------------
  const area = (m) => (m.bbox[2] - m.bbox[0]) * (m.bbox[3] - m.bbox[1]);
  const covers = (a, b) => a.bbox[0] <= b.bbox[0] + 0.01 && a.bbox[1] <= b.bbox[1] + 0.01 && a.bbox[2] >= b.bbox[2] - 0.01 && a.bbox[3] >= b.bbox[3] - 0.01;
  const keepers = [];
  const add = (m) => keepers.includes(m) || keepers.push(m);
  // base maps: the finest global ones first
  for (const m of found.filter((m) => m.group === 'base' && m.global).sort((x, y) => y.maxZ - x.maxZ || y.px - x.px).slice(0, 4)) add(m);
  // high-resolution regional mosaics over their footprint (finest last)
  const mosaics = found.filter((m) => m.group === 'mosaic' && !m.global).sort((x, y) => y.maxZ - x.maxZ || area(y) - area(x));
  for (const m of mosaics) {
    if (mosaics.some((k) => k !== m && k.maxZ >= m.maxZ && covers(k, m))) continue;
    add(m);
  }
  // regional maps (selectable when the map centre is inside), the finest 8
  for (const m of found.filter((m) => m.group === 'region' && m.maxZ >= 7).sort((x, y) => y.maxZ - x.maxZ).slice(0, 8)) add(m);
  // thematic overlays (global first)
  for (const m of found.filter((m) => m.group === 'overlay').sort((x, y) => Number(y.global) - Number(x.global) || y.maxZ - x.maxZ).slice(0, 6)) add(m);
  // height models: the one global DEM (for the 3D relief of the whole body) + the finest regional ones
  const gdem = found.filter((m) => m.group === 'dem' && m.global).sort((x, y) => y.maxZ - x.maxZ)[0];
  if (gdem) add(gdem);
  const dems = found.filter((m) => m.group === 'dem' && !m.global).sort((x, y) => y.maxZ - x.maxZ || area(y) - area(x));
  for (const m of dems) {
    if (dems.some((k) => k !== m && k.maxZ >= m.maxZ && covers(k, m))) continue;
    if (keepers.filter((k) => k.group === 'dem' && !k.global).length >= 12) break;
    add(m);
  }
  found.length = 0;
  found.push(...keepers);
  if (found.length) {
    const order = { base: 0, mosaic: 1, region: 2, overlay: 3, dem: 4 };
    found.sort((a, b) => order[a.group] - order[b.group] || (a.group === 'mosaic' ? a.maxZ - b.maxZ || area(b) - area(a) : a.title.localeCompare(b.title)));
    out[portal.body] = found;
  }
  console.log(portal.slug, '→', found.length, 'Produkte', Object.entries(found.reduce((a, m) => ({ ...a, [m.group]: (a[m.group] ?? 0) + 1 }), {})).map(([k, v]) => `${k}:${v}`).join(' '));
}

const strip = (u) => u.replace(/^https:\/\/trek\.nasa\.gov\//, '~/');
const body = Object.entries(out)
  .map(([body, list]) => {
    const rows = list.map((m) => `    [${JSON.stringify(m.label)}, ${JSON.stringify(m.title)}, '${m.group}', ${JSON.stringify(strip(m.url))}, ${m.px}, [${m.bbox.join(', ')}], ${m.maxZ}],`).join('\n');
    return `  ${body}: [\n${rows}\n  ],`;
  })
  .join('\n');
writeFileSync(
  new URL('../src/space/trek-products.ts', import.meta.url),
  `// Generated by scripts/trek-products.mjs from NASA Trek (${new Date().toISOString().slice(0, 10)}) – do not edit.
// [label, title, group, tile url ("~/" = https://trek.nasa.gov/), tile px, [west, south, east, north], finest level]
//   base: global maps · mosaic: regional image mosaics (composited in "auto")
//   region: other regional maps · overlay: thematic layers (geology …) · dem: height models (3D terrain)
// Curated by scripts/trek-products.mjs (finest global bases, mosaics not covered by a finer one, capped lists).

import type { TrekProduct } from './mars-products';

export const TREK_PRODUCTS: Record<string, TrekProduct[]> = {
${body}
};
`,
);
