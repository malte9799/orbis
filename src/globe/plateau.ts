// Project PLATEAU (MLIT Japan): textured 3D city models of ~250 cities, but one tileset per city or
// ward and no national tileset. The data catalog lists them without coordinates, so the area of a
// tileset is read from the root bounding region of its tileset.json (once, then kept in localStorage)
// and the tilesets around the map centre are picked from that.

const CATALOG = 'https://api.plateauview.mlit.go.jp/datacatalog/plateau-datasets';
const BBOX_KEY = 'orbis.plateau.bbox.v1';
/** only the prefectures whose capital is this close (km) to the map centre are looked up */
const REACH_KM = 250;
/** a tileset counts as "here" when the point is this close (degrees) to its area */
const MARGIN = 0.01;

export interface PlateauSet {
  url: string;
  name: string;
}

interface Entry extends PlateauSet {
  pref: number;
}

/** prefecture capitals by JIS code 1…47: [lon, lat] */
const PREF: Record<number, [number, number]> = {
  1: [141.35, 43.06], 2: [140.74, 40.82], 3: [141.15, 39.7], 4: [140.87, 38.27], 5: [140.1, 39.72], 6: [140.36, 38.24], 7: [140.47, 37.75], 8: [140.45, 36.34],
  9: [139.88, 36.57], 10: [139.06, 36.39], 11: [139.65, 35.86], 12: [140.12, 35.61], 13: [139.69, 35.69], 14: [139.64, 35.45], 15: [139.02, 37.9], 16: [137.21, 36.7],
  17: [136.63, 36.59], 18: [136.22, 36.07], 19: [138.57, 35.66], 20: [138.18, 36.65], 21: [136.72, 35.39], 22: [138.38, 34.98], 23: [136.91, 35.18], 24: [136.51, 34.73],
  25: [135.87, 35.0], 26: [135.76, 35.02], 27: [135.52, 34.69], 28: [135.18, 34.69], 29: [135.83, 34.69], 30: [135.17, 34.23], 31: [134.24, 35.5], 32: [133.05, 35.47],
  33: [133.93, 34.66], 34: [132.46, 34.4], 35: [131.47, 34.19], 36: [134.56, 34.07], 37: [134.04, 34.34], 38: [132.77, 33.84], 39: [133.53, 33.56], 40: [130.42, 33.61],
  41: [130.3, 33.25], 42: [129.87, 32.74], 43: [130.74, 32.79], 44: [131.61, 33.24], 45: [131.42, 31.91], 46: [130.56, 31.56], 47: [127.68, 26.21],
};

let catalog: Promise<Entry[]> | undefined;
const bbox = new Map<string, [number, number, number, number] | null>();
let loadedBoxes = false;

/** the map centre is somewhere in Japan (so the catalog is worth loading) */
export const inJapan = (lon: number, lat: number) => lon > 122 && lon < 154 && lat > 24 && lat < 46;

const km = (a: [number, number], lon: number, lat: number) => Math.hypot((a[0] - lon) * 111.32 * Math.cos((lat * Math.PI) / 180), (a[1] - lat) * 110.57);

function loadCatalog(): Promise<Entry[]> {
  catalog ??= fetch(CATALOG)
    .then((r) => r.json())
    .then((j: { datasets: Record<string, unknown>[] }) => {
      // textured buildings from LoD2 on; per city or ward the newest set of the lowest LoD (LoD2 covers a whole city)
      const best = new Map<string, Record<string, unknown>>();
      for (const d of j.datasets) {
        if (d.type_en !== 'bldg' || d.format !== '3D Tiles' || !d.texture || Number(d.lod) < 2) continue;
        const key = String(d.ward_code || d.city_code);
        const cur = best.get(key);
        if (!cur || Number(d.lod) < Number(cur.lod) || (Number(d.lod) === Number(cur.lod) && Number(d.year) > Number(cur.year))) best.set(key, d);
      }
      return [...best.values()].map((d) => ({ url: String(d.url), name: [d.city, d.ward].filter(Boolean).join(' '), pref: Number(d.pref_code) }));
    })
    .catch((e) => {
      catalog = undefined;
      throw e;
    });
  return catalog;
}

function loadBoxes() {
  if (loadedBoxes) return;
  loadedBoxes = true;
  try {
    for (const [u, b] of Object.entries(JSON.parse(localStorage.getItem(BBOX_KEY) ?? '{}'))) bbox.set(u, b as [number, number, number, number] | null);
  } catch {
    /* storage blocked or corrupt */
  }
}

function saveBoxes() {
  try {
    localStorage.setItem(BBOX_KEY, JSON.stringify(Object.fromEntries(bbox)));
  } catch {
    /* quota */
  }
}

/** [west, south, east, north] in degrees from the root bounding region of a tileset (null: has none, undefined: failed) */
async function areaOf(url: string): Promise<[number, number, number, number] | null | undefined> {
  try {
    const j = await (await fetch(url)).json();
    const r: number[] | undefined = j.root?.boundingVolume?.region;
    return r ? [(r[0] * 180) / Math.PI, (r[1] * 180) / Math.PI, (r[2] * 180) / Math.PI, (r[3] * 180) / Math.PI] : null;
  } catch {
    return undefined; // not cached: tried again next time
  }
}

/** The PLATEAU tilesets that cover (or touch) a position; resolves the missing areas of nearby prefectures on first use. */
export async function plateauAt(lon: number, lat: number): Promise<PlateauSet[]> {
  if (!inJapan(lon, lat)) return [];
  loadBoxes();
  const near = (await loadCatalog()).filter((e) => PREF[e.pref] && km(PREF[e.pref], lon, lat) < REACH_KM);
  const todo = near.filter((e) => !bbox.has(e.url));
  let next = 0;
  const worker = async () => {
    while (next < todo.length) {
      const e = todo[next++];
      const a = await areaOf(e.url);
      if (a !== undefined) bbox.set(e.url, a);
    }
  };
  if (todo.length) {
    await Promise.all(Array.from({ length: 8 }, worker));
    saveBoxes();
  }
  return near.filter((e) => {
    const b = bbox.get(e.url);
    return b && lon > b[0] - MARGIN && lon < b[2] + MARGIN && lat > b[1] - MARGIN && lat < b[3] + MARGIN;
  });
}
