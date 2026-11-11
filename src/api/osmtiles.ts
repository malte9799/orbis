import { OSM_BASE } from './data';

// Point data from the monthly OpenStreetMap extracts (collectors/osm-tiles.mjs of the data repo), so no live
// Overpass query is needed. Only nodes are in there – ways and areas with the same tags are not (the callers keep
// asking Overpass for those, or for everything while the snapshot is unavailable).
//
// One `<set>.pmtiles` per data set (vector tiles, layer = set, properties = the record fields below) under OSM_BASE
// (VITE_OSM_BASE, default orbis-osm), read with HTTP range requests; the tiles are turned back into the old record
// arrays here.

export type TileSet = 'cctv' | 'blitzer' | 'alpr' | 'webcam' | 'wind' | 'resource';
type Box = { west: number; south: number; east: number; north: number };

const BASE = OSM_BASE;

/** record fields after [lon, lat] per set (= feature properties in the pmtiles; same list as FIELDS in the collector) */
export const FIELDS: Record<TileSet, [name: string, dflt: string | number][]> = {
  cctv: [['dir', -1], ['surveillance', ''], ['ctype', ''], ['mount', ''], ['guard', 0], ['operator', ''], ['id', 0]],
  blitzer: [['dir', -1], ['kind', ''], ['speed', ''], ['operator', ''], ['ref', ''], ['id', 0]],
  alpr: [['dir', -1], ['brand', ''], ['flock', 0], ['mount', ''], ['operator', ''], ['zone', ''], ['since', ''], ['ref', ''], ['id', 0]],
  webcam: [['dir', -1], ['name', ''], ['operator', ''], ['panning', 0], ['link', ''], ['id', 0]],
  wind: [['name', ''], ['operator', ''], ['manufacturer', ''], ['model', ''], ['output', ''], ['id', 0]],
  resource: [['name', ''], ['kind', ''], ['words', ''], ['resource', ''], ['operator', ''], ['id', 0]],
};

/** feature properties of a pmtiles point → the record array [lon, lat, …fields] the callers know (missing = default) */
export function recordFromProps<R extends unknown[]>(set: TileSet, lon: number, lat: number, props: Record<string, unknown> | null | undefined): R {
  return [lon, lat, ...FIELDS[set].map(([k, d]) => props?.[k] ?? d)] as R;
}

/** highest zoom (≤ maxZoom) at which the box needs at most `maxTiles` tiles, with the tile ranges */
export function tileRange(b: Box, maxTiles = 36, maxZoom = 14): { z: number; x0: number; x1: number; y0: number; y1: number } {
  const lat = (v: number) => Math.max(-85.0511, Math.min(85.0511, v));
  const tx = (lon: number, z: number) => Math.min((1 << z) - 1, Math.max(0, Math.floor(((lon + 180) / 360) * (1 << z))));
  const ty = (la: number, z: number) => {
    const r = (lat(la) * Math.PI) / 180;
    return Math.min((1 << z) - 1, Math.max(0, Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * (1 << z))));
  };
  for (let z = maxZoom; z >= 0; z--) {
    const [x0, x1, y0, y1] = [tx(b.west, z), tx(b.east, z), ty(b.north, z), ty(b.south, z)];
    if (z === 0 || (x1 - x0 + 1) * (y1 - y0 + 1) <= maxTiles) return { z, x0, x1, y0, y1 };
  }
  return { z: 0, x0: 0, x1: 0, y0: 0, y1: 0 };
}

const pmFiles = new Map<TileSet, Promise<import('pmtiles').PMTiles>>();
const pmTiles = new Map<string, Promise<unknown[][]>>();

function pmFile(set: TileSet) {
  let p = pmFiles.get(set);
  if (!p) {
    p = import('pmtiles').then(async ({ PMTiles }) => {
      const f = new PMTiles(`${BASE}${set}.pmtiles`);
      await f.getHeader(); // reachable at all?
      return f;
    });
    p.catch(() => pmFiles.delete(set)); // try again next time
    pmFiles.set(set, p);
  }
  return p;
}

async function pmTile(set: TileSet, z: number, x: number, y: number): Promise<unknown[][]> {
  const file = await pmFile(set);
  const res = await file.getZxy(z, x, y);
  if (!res) return []; // no points in this tile
  const [{ VectorTile }, { PbfReader }] = await Promise.all([import('@mapbox/vector-tile'), import('pbf')]);
  const layer = new VectorTile(new PbfReader(res.data)).layers[set];
  const out: unknown[][] = [];
  for (let i = 0; layer && i < layer.length; i++) {
    const f = layer.feature(i).toGeoJSON(x, y, z);
    if (f.geometry.type !== 'Point') continue;
    const [lon, lat] = f.geometry.coordinates;
    out.push(recordFromProps(set, Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5, f.properties));
  }
  return out;
}

async function loadPmtiles<R extends unknown[]>(set: TileSet, b: Box): Promise<{ recs: R[]; complete: boolean } | null> {
  try {
    await pmFile(set);
  } catch {
    return null;
  }
  const { z, x0, x1, y0, y1 } = tileRange(b);
  const jobs: Promise<unknown[][]>[] = [];
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      const key = `${set}/${z}/${x}/${y}`;
      let p = pmTiles.get(key);
      if (!p) {
        p = pmTile(set, z, x, y).catch((e) => {
          pmTiles.delete(key);
          throw e;
        });
        pmTiles.set(key, p);
      }
      jobs.push(p);
    }
  }
  const loaded = await Promise.allSettled(jobs);
  // a node on a tile edge could be in both tiles: the OSM node id (last field) tells
  const seen = new Set<unknown>();
  const recs = loaded
    .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .filter((r) => inBox(r, b) && !seen.has(r[r.length - 1]) && seen.add(r[r.length - 1])) as R[];
  return { recs, complete: loaded.every((r) => r.status === 'fulfilled') };
}

const inBox = (r: unknown[], b: Box) => (r[0] as number) >= b.west && (r[0] as number) <= b.east && (r[1] as number) >= b.south && (r[1] as number) <= b.north;

/**
 * Records of a data set inside the bounds. `complete` is false when a tile failed; null when the
 * PMTiles file is not reachable at all.
 */
export async function loadOsmTiles<R extends unknown[]>(set: TileSet, b: Box): Promise<{ recs: R[]; complete: boolean } | null> {
  return loadPmtiles<R>(set, b);
}

/** the snapshot's answer if it can be trusted, otherwise null (→ ask Overpass) */
export async function snapshotOrNull<R extends unknown[]>(set: TileSet, b: Box): Promise<R[] | null> {
  const snap = await loadOsmTiles<R>(set, b).catch(() => null);
  return snap && (snap.complete || snap.recs.length) ? snap.recs : null;
}
