// NASA Moon Trek tile products (LROC NAC site mosaics, Kaguya, LOLA, Clementine, geology, minerals …).
// Reads Trek's own search index and the WMTS capabilities of every product and writes
// src/space/moon-products.ts. Run: node scripts/moon-products.mjs   (the deploy workflow runs it, optional)
// Without network access / on any error the committed list stays untouched.

import { writeFileSync } from 'node:fs';

const SEARCH = 'https://trek.nasa.gov/moon/TrekServices/ws/index/eq/searchItems?proj=eq&rows=500&start=';
const get = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r;
};

const docs = [];
for (let s = 0; s < 4000; s += 500) {
  const d = await (await get(SEARCH + s)).json();
  docs.push(...d.response.docs);
  if (d.response.docs.length < 500) break;
}
const products = docs.filter((x) => (x.itemType === 'product' || x.itemType === 'dataset') && x.productLabel);
console.log(products.length, 'products in the index');

const KNOWN = new Set(['LRO_WAC_Mosaic_Global_303ppd_v02', 'LRO_LOLA_ClrShade_Global_128ppd_v04', 'LRO_LOLA_Shade_Global_128ppd_v04']);

const BASE_CATS = new Set(['Imagery', 'Topography']);
const OVERLAY_CATS = new Set(['Geology', 'Landforms', 'Mineral', 'Mineralogy', 'Composition', 'Spectrometer', 'Exploration Zones', 'Terrain', 'Geochemistry']);
// image mosaics that are sharper than the global 5 m CTX: composited over it in the "auto" map
// regional high-resolution image mosaics (LROC NAC, Apollo/Kaguya close-ups), composited over the global mosaic in "auto"
const isMosaic = (t) => /NAC|Apollo|Landing|Site/i.test(t) && /Mosaic|Ortho/i.test(t) && !/Hill+shade|Shade|Slope|Roughness|Elevation|DEM/i.test(t);

const out = [];
let i = 0;
await Promise.all(
  Array.from({ length: 12 }, async () => {
    while (i < products.length) {
      const x = products[i++];
      const title = x.title ?? '';
      const cat1 = x.productCat1;
      if (KNOWN.has(x.productLabel)) continue; // already a layer in planets.ts
      if (/DEM/.test(title) || x.productCat2 === 'DEM' || x.productCat2 === 'Traverse Path') continue;
      try {
        const t = await (await get(`https://trek.nasa.gov/tiles/Moon/EQ/${x.productLabel}/1.0.0/WMTSCapabilities.xml`)).text();
        const bb = /<ows:WGS84BoundingBox[^>]*>\s*<ows:LowerCorner>([-\d.eE ]+)<\/ows:LowerCorner>\s*<ows:UpperCorner>([-\d.eE ]+)<\/ows:UpperCorner>/.exec(t);
        const widths = [...t.matchAll(/<MatrixWidth>([\d.]+)<\/MatrixWidth>/g)].map((m) => +m[1]);
        const heights = [...t.matchAll(/<MatrixHeight>([\d.]+)<\/MatrixHeight>/g)].map((m) => +m[1]);
        const tpl = /ResourceURL[^>]*template="([^"]+)"/.exec(t)?.[1];
        const set = /<TileMatrixSetLink>\s*<TileMatrixSet>([^<]+)</.exec(t)?.[1];
        const px = +(/<TileWidth>(\d+)</.exec(t)?.[1] ?? 256);
        if (!bb || !tpl || !set || widths[0] !== 2 || heights[0] !== 1) continue; // not the plain 2×1 equirectangular pyramid
        const [w, s] = bb[1].trim().split(/\s+/).map(Number);
        const [e, n] = bb[2].trim().split(/\s+/).map(Number);
        // the declared pyramid is deeper than the data in places: find the finest level that really has tiles
        const url0 = tpl
          .replace('{Style}', 'default')
          .replace('{TileMatrixSet}', set)
          .replace('{TileMatrix}', '{z}')
          .replace('{TileRow}', '{r}')
          .replace('{TileCol}', '{c}')
          .replace(/([^:])\/\//g, '$1/');
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
        let group;
        if (BASE_CATS.has(cat1)) group = global ? 'base' : isMosaic(title) && maxZ >= 13 ? 'mosaic' : 'region';
        else if (isMosaic(title) && maxZ >= 13) group = 'mosaic';
        else if (OVERLAY_CATS.has(cat1)) group = 'overlay';
        else continue;
        if (group === 'mosaic' && global) continue;
        const url = tpl
          .replace('{Style}', 'default')
          .replace('{TileMatrixSet}', set)
          .replace('{TileMatrix}', '{z}')
          .replace('{TileRow}', '{r}')
          .replace('{TileCol}', '{c}')
          .replace(/([^:])\/\//g, '$1/');
        out.push({
          label: x.productLabel,
          title,
          group,
          url,
          px,
          bbox: [w, s, e, n].map((v) => Math.round(v * 1e3) / 1e3),
          maxZ,
        });
      } catch {
        /* layer not served */
      }
    }
  }),
);

// Curation: drop duplicates, slopes / roughness / DEM products and very coarse maps. Every product is listed
// in the log so the filter can be adjusted after a look at the catalogue.
const KEEP = (m) => {
  const t = m.title;
  if (/Slope|Roughness|Rock Abundance|Temperature|Illumination|Uncertain|Error|Mask|Count/i.test(t)) return false;
  if (m.group === 'mosaic') return true;
  if (m.group === 'base') return /LOLA|Kaguya|SELENE|Clementine|WAC|Hillshade|Color/i.test(t);
  if (m.group === 'region') return /LROC|NAC|Kaguya|Apollo|Color|Ortho/i.test(t);
  return true;
};
for (const m of out) console.log(KEEP(m) ? 'keep' : 'drop', m.group, m.maxZ, m.label, '|', m.title);
for (let k = out.length - 1; k >= 0; k--) if (!KEEP(out[k])) out.splice(k, 1);

const order = { base: 0, mosaic: 1, region: 2, overlay: 3 };
out.sort((a, b) => order[a.group] - order[b.group] || (a.group === 'mosaic' ? a.maxZ - b.maxZ || (b.bbox[2] - b.bbox[0]) * (b.bbox[3] - b.bbox[1]) - (a.bbox[2] - a.bbox[0]) * (a.bbox[3] - a.bbox[1]) : a.title.localeCompare(b.title)));
const strip = (u) => u.replace(/^https:\/\/trek\.nasa\.gov\//, '~/');
const body = out.map((m) => `  [${JSON.stringify(m.label)}, ${JSON.stringify(m.title)}, '${m.group}', ${JSON.stringify(strip(m.url))}, ${m.px}, [${m.bbox.join(', ')}], ${m.maxZ}],`).join('\n');
writeFileSync(
  new URL('../src/space/moon-products.ts', import.meta.url),
  `// Generated by scripts/moon-products.mjs from NASA Moon Trek (${new Date().toISOString().slice(0, 10)}) – do not edit.
// [label, title, group, tile url ("~/" = https://trek.nasa.gov/), tile px, [west, south, east, north], finest level]
//   base: global maps · mosaic: regional LROC NAC mosaics (composited in "auto")
//   region: other regional maps · overlay: thematic layers (geology, minerals …)
// Curated by scripts/moon-products.mjs (KEEP).

import type { TrekProduct } from './mars-products';

export const MOON_PRODUCTS: TrekProduct[] = [
${body}
];
`,
);
const counts = {};
for (const m of out) counts[m.group] = (counts[m.group] ?? 0) + 1;
console.log(out.length, counts);
