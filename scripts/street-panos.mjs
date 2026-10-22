// Builds the list of places with Mapillary 360° photos for the panorama game (street/panos.json on the `data` branch).
// Mapillary's z6 vector tile has one line per capture sequence with an `is_pano` flag; per tile a random
// sample of the 360° sequences is kept. The game searches the real photo around such a point at play time,
// so the list only needs rough coordinates. Shared by scripts/fetch-data.ts (Action) and local runs; no Node-only APIs here.
//   local run: MAPILLARY_TOKEN=… node scripts/street-panos-cli.mjs <out.json>

import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';

const Z = 6;
const TILE_API = 'https://tiles.mapillary.com/maps/vtp/mly1_public/2';

/** z6 tiles that touch a country polygon (countries.json of the games), so oceans are skipped */
export function landTiles(countries) {
  const n = 2 ** Z;
  const tx = (lng) => Math.min(n - 1, Math.max(0, Math.floor(((lng + 180) / 360) * n)));
  const ty = (lat) => {
    const r = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
    return Math.min(n - 1, Math.max(0, Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n)));
  };
  const seen = new Set();
  for (const f of countries.features) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [];
    for (const p of polys) {
      let [x0, y0, x1, y1] = [180, 90, -180, -90];
      for (const [x, y] of p[0]) [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x), Math.max(y1, y)];
      for (let x = tx(x0); x <= tx(x1); x++) for (let y = ty(y1); y <= ty(y0); y++) seen.add(`${x}/${y}`);
    }
  }
  return [...seen].map((s) => s.split('/').map(Number));
}

async function fetchTile(token, x, y, tries = 3) {
  for (let i = 0; i < tries; i++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 90000);
    try {
      const res = await fetch(`${TILE_API}/${Z}/${x}/${y}?access_token=${encodeURIComponent(token)}`, { signal: ctrl.signal });
      if (res.status === 204 || res.status === 404) return null;
      if (res.status === 401 || res.status === 403) throw Object.assign(new Error('Mapillary lehnt den Token ab'), { fatal: true });
      if (res.ok) return new Uint8Array(await res.arrayBuffer());
    } catch (e) {
      if (e.fatal) throw e;
    } finally {
      clearTimeout(t);
    }
    await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  throw new Error(`tile ${Z}/${x}/${y} not reachable`);
}

/** [lng, lat] of random 360° sequences in one tile (never on foot: the game is about streets) */
export async function tilePanos(token, x, y, perTile) {
  const buf = await fetchTile(token, x, y);
  const layer = buf && new VectorTile(new PbfReader(buf)).layers.sequence;
  if (!layer) return [];
  const idx = [];
  for (let i = 0; i < layer.length; i++) {
    const p = layer.feature(i).properties;
    if (p.is_pano && !p.foot) idx.push(i);
  }
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, perTile).map((i) => {
    const g = layer.feature(i).toGeoJSON(x, y, Z).geometry; // a line cut at the tile edge is a MultiLineString
    const line = g.type === 'MultiLineString' ? g.coordinates.flat() : g.coordinates;
    const [lng, lat] = line[Math.floor(line.length / 2)];
    return [Math.round(lng * 1000) / 1000, Math.round(lat * 1000) / 1000];
  });
}

/** options: token, tiles [[x, y]…], perTile (default 40), concurrency (8), budgetMs (15 min) */
export async function buildStreetPanos({ token, tiles, perTile = 40, concurrency = 8, budgetMs = 15 * 60 * 1000, log = () => {} }) {
  const t0 = Date.now();
  const points = [];
  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (next < tiles.length) {
        if (Date.now() - t0 > budgetMs) throw new Error('time budget exceeded');
        const [x, y] = tiles[next++];
        points.push(...(await tilePanos(token, x, y, perTile)));
        if (++done % 100 === 0) log(`${done}/${tiles.length} tiles, ${points.length} points`);
      }
    }),
  );
  return { updated: new Date().toISOString(), points };
}
