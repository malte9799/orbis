import { DATA_BASE } from './data';
import { fetchJson } from '../util';

// Point data from the monthly OpenStreetMap extracts (scripts/cctv-heat.mjs, branch `data-osm`):
// one set of 0.5° tiles per data set and region, so no live Overpass query is needed.
// Only nodes are in there – ways and areas with the same tags are not (the callers keep asking
// Overpass for those, or for everything while the snapshot is unavailable).
// Record layouts: see the `…Record` functions in the script.

export type TileSet = 'blitzer' | 'alpr' | 'webcam' | 'wind' | 'resource';
type Box = { west: number; south: number; east: number; north: number };

const BASE = DATA_BASE.replace(/\/data\/$/, '/data-osm/');
const REGIONS = ['europe', 'russia', 'asia', 'north-america', 'central-america', 'south-america', 'africa', 'oceania'];
const TILE = 2; // tiles per degree

const indexes = new Map<TileSet, Promise<Map<string, Set<string>>>>();
const tiles = new Map<string, Promise<unknown[][]>>();

function loadIndex(set: TileSet) {
  let p = indexes.get(set);
  if (!p) {
    p = Promise.allSettled(REGIONS.map((r) => fetchJson<string[]>(`${BASE}${set}-${r}-tiles.json`, undefined, 30000))).then((res) => {
      const index = new Map<string, Set<string>>();
      res.forEach((r, i) => {
        if (r.status === 'fulfilled') index.set(REGIONS[i], new Set(r.value));
      });
      if (!index.size) indexes.delete(set); // try again next time
      return index;
    });
    indexes.set(set, p);
  }
  return p;
}

/**
 * Records of a data set inside the bounds. `complete` is false when a region's index is missing
 * (not built yet / unreachable) or a tile failed; null when the snapshot is not reachable at all.
 */
export async function loadOsmTiles<R extends unknown[]>(set: TileSet, b: Box): Promise<{ recs: R[]; complete: boolean } | null> {
  const index = await loadIndex(set);
  if (!index.size) return null;
  const jobs: Promise<unknown[][]>[] = [];
  for (let x = Math.floor(b.west * TILE); x <= Math.floor(b.east * TILE); x++) {
    for (let y = Math.floor(b.south * TILE); y <= Math.floor(b.north * TILE); y++) {
      for (const [region, have] of index) {
        if (!have.has(`${x}_${y}`)) continue;
        const key = `${set}-${region}/${x}_${y}`;
        let p = tiles.get(key);
        if (!p) {
          p = fetchJson<unknown[][]>(`${BASE}${key}.json`, undefined, 30000).catch((e) => {
            tiles.delete(key);
            throw e;
          });
          tiles.set(key, p);
        }
        jobs.push(p);
      }
    }
  }
  const loaded = await Promise.allSettled(jobs);
  const recs = loaded
    .flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
    .filter((r) => (r[0] as number) >= b.west && (r[0] as number) <= b.east && (r[1] as number) >= b.south && (r[1] as number) <= b.north) as R[];
  return { recs, complete: index.size === REGIONS.length && loaded.every((r) => r.status === 'fulfilled') };
}

/** the snapshot's answer if it can be trusted, otherwise null (→ ask Overpass) */
export async function snapshotOrNull<R extends unknown[]>(set: TileSet, b: Box): Promise<R[] | null> {
  const snap = await loadOsmTiles<R>(set, b).catch(() => null);
  return snap && (snap.complete || snap.recs.length) ? snap.recs : null;
}
