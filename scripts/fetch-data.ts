// Downloads data sources that browsers cannot query directly (missing CORS headers) and
// writes them as static files for the `data` branch. Run by .github/workflows/data.yml:
//   node fetch-data.mjs <outDir> <previousDataDir>
// Live sources are refreshed on every run (every 15 min), slow-changing ones once a day;
// if a download fails, the previous file is kept.

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

// the app modules expect a browser – provide the bits they touch
const envKeys = { nps: process.env.NPS_API_KEY, windy: process.env.WINDY_KEY, victoria: process.env.VICTORIA_KEY, cta: process.env.CTA_KEY, trafiklab: process.env.TRAFIKLAB_KEY, ontario511: process.env.ONTARIO_511_API_KEY, alberta511: process.env.ALBERTA_511_API_KEY };
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => (k === 'wg.keys' ? JSON.stringify(envKeys) : null),
  setItem() {},
  removeItem() {},
};

const [OUT, PREV] = process.argv.slice(2);
if (!OUT) throw new Error('usage: fetch-data <outDir> [prevDir]');
const UA = { 'User-Agent': 'Orbis-data/1.0 (+https://github.com/malte9799/orbis)' };
const DAY = 23 * 3600 * 1000;

if (PREV && existsSync(PREV)) cpSync(PREV, OUT, { recursive: true, filter: (src) => !src.includes('/.git') });
mkdirSync(OUT, { recursive: true });

const metaPath = join(OUT, 'meta.json');
const meta: { updated?: string; tasks: Record<string, number> } = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : { tasks: {} };
meta.tasks ??= {};

function write(path: string, data: unknown) {
  const file = join(OUT, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, typeof data === 'string' ? data : JSON.stringify(data));
}

async function get(url: string, timeoutMs = 60000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: UA, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} – ${url}`);
    return res;
  } finally {
    clearTimeout(t);
  }
}
const json = async <T>(url: string, timeoutMs?: number) => (await get(url, timeoutMs)).json() as Promise<T>;
const text = async (url: string) => (await get(url)).text();

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

const FORCE = process.env.FORCE === '1' || process.env.FORCE === 'true';

async function task(name: string, everyMs: number, fn: () => Promise<void>) {
  if (!FORCE && everyMs && meta.tasks[name] && Date.now() - meta.tasks[name] < everyMs) return;
  const t0 = Date.now();
  try {
    await fn();
    meta.tasks[name] = Date.now();
    console.log(`✓ ${name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  } catch (e) {
    console.warn(`✗ ${name}: ${e instanceof Error ? e.message : e} – keeping previous data`);
  }
}

// ---------------------------------------------------------------------------
// live (every run)

await task('tsunami', 0, async () => {
  for (const f of ['PAAQ', 'PHEB']) write(`tsunami/${f}.xml`, await text(`https://www.tsunami.gov/events/xml/${f}Atom.xml`));
});

await task('safecast', 0, async () => {
  write('safecast.json', await json('https://tt.safecast.org/devices'));
});

await task('radiation', 0, async () => {
  const { fetchBfsRaw, fetchEurdepRaw } = await import('../src/api/earth');
  const [bfs, eurdep] = await Promise.allSettled([fetchBfsRaw(), fetchEurdepRaw()]);
  if (bfs.status === 'fulfilled') write('bfs-odl.json', bfs.value);
  else console.warn(`  BfS ODL: ${bfs.reason} – keeping previous data`);
  if (eurdep.status === 'fulfilled') write('eurdep.json', eurdep.value);
  else console.warn(`  EURDEP: ${eurdep.reason} – keeping previous data`);
  if (bfs.status === 'rejected' && eurdep.status === 'rejected') throw new Error('BfS and EURDEP failed');
});

await task('firms', 0, async () => {
  const key = process.env.FIRMS_MAP_KEY;
  if (!key) {
    console.log('  no FIRMS_MAP_KEY secret – skipping');
    return;
  }
  const { loadFirms } = await import('../src/api/events');
  const byId = new Map<string, unknown>();
  for (const sensor of ['VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT', 'VIIRS_SNPP_NRT', 'MODIS_NRT']) {
    try {
      // explicit world bounding box (west,south,east,north) – more reliable than the 'world' keyword
      const fc = await loadFirms(key, sensor, 1, '-180,-90,180,90');
      for (const f of fc.features) {
        const [lon, lat] = f.geometry.coordinates;
        f.geometry.coordinates = [Math.round(lon * 1e4) / 1e4, Math.round(lat * 1e4) / 1e4];
        byId.set(`${f.geometry.coordinates[0]},${f.geometry.coordinates[1]},${f.properties.time}`, f);
      }
      console.log(`  ${sensor}: ${fc.features.length}`);
    } catch (e) {
      console.warn(`  ${sensor}: ${e instanceof Error ? e.message : e}`);
    }
  }
  if (!byId.size) {
    // diagnose: show what FIRMS actually returned (status + first line)
    try {
      const res = await fetch(`https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/VIIRS_NOAA20_NRT/-180,-90,180,90/1`);
      const body = await res.text();
      console.warn(`  diagnose: HTTP ${res.status}, ${body.length} bytes, start: ${JSON.stringify(body.slice(0, 160))}`);
    } catch (e) {
      console.warn(`  diagnose failed: ${e instanceof Error ? e.message : e}`);
    }
    throw new Error('no FIRMS data');
  }
  write('firms/world.json', { type: 'FeatureCollection', features: [...byId.values()] });
});

// ---------------------------------------------------------------------------
// daily

// Submarine telecom cables from OpenStreetMap (ODbL). Replaces the former TeleGeography
// snapshot, whose database is not openly licensed – its old files are removed from the branch.
rmSync(join(OUT, 'cables'), { recursive: true, force: true });
delete meta.tasks.cables;

await task('osm-cables', DAY, async () => {
  const query = `[out:json][timeout:600];(
    way["telecom"="line"]["location"~"underwater|submarine"];
    way["communication"="line"]["location"~"underwater|submarine"];
    way["submarine"="yes"]["telecom"="line"];
    way["seamark:type"="cable_submarine"]["seamark:cable_submarine:category"~"^(fibre_optic|fiber_optic|optical|telephone|telegraph|telecommunication|communication)$"];
  );out tags geom;`;
  type OsmWay = { id: number; tags?: Record<string, string>; geometry?: { lat: number; lon: number }[] };
  let elements: OsmWay[] | null = null;
  const errors: string[] = [];
  for (const server of ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter']) {
    try {
      const res = await fetch(server, {
        method: 'POST',
        headers: { ...UA, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(660000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      ({ elements } = (await res.json()) as { elements: OsmWay[] });
      break;
    } catch (e) {
      errors.push(`${new URL(server).host}: ${e instanceof Error ? e.message : e}`);
    }
  }
  if (!elements) throw new Error(`Overpass – ${errors.join(', ')}`);
  const PALETTE = ['#9c6bff', '#4fc3f7', '#4db6ac', '#f06292', '#ffb74d', '#aed581', '#7986cb', '#ba68c8'];
  const r = (v: number) => Math.round(v * 1000) / 1000;
  const features = [];
  for (const el of elements) {
    const t = el.tags ?? {};
    if (/power/.test(`${t['seamark:cable_submarine:category'] ?? ''} ${t.power ?? ''}`) || !el.geometry || el.geometry.length < 2) continue;
    const coords: number[][] = [];
    for (const g of el.geometry) {
      const c = [r(g.lon), r(g.lat)];
      const last = coords[coords.length - 1];
      if (!last || last[0] !== c[0] || last[1] !== c[1]) coords.push(c);
    }
    if (coords.length < 2) continue;
    const name = t.name ?? t['seamark:cable_submarine:name'] ?? t['seamark:name'] ?? '';
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
      properties: {
        id: el.id,
        name,
        operator: t.operator ?? '',
        since: t.start_date ?? '',
        // one colour per cable name so the segments of a cable match
        color: PALETTE[[...(name || String(el.id))].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % PALETTE.length],
      },
    });
  }
  if (features.length < 100) throw new Error(`only ${features.length} cables – Overpass answer incomplete?`);
  write('osm-cables/cables.json', { type: 'FeatureCollection', features });
  write('osm-cables/LICENSE.txt', 'Data © OpenStreetMap contributors, available under the Open Database License (ODbL) 1.0: https://opendatacommons.org/licenses/odbl/1-0/\nhttps://www.openstreetmap.org/copyright\n');
});

await task('volcanoes', DAY, async () => {
  write(
    'volcanoes.json',
    await json('https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows?service=WFS&version=2.0.0&request=GetFeature&typeName=GVP-VOTW:Smithsonian_VOTW_Holocene_Volcanoes&outputFormat=application%2Fjson'),
  );
});

await task('radio', DAY, async () => {
  type St = { stationuuid: string; name: string; url_resolved: string; homepage?: string; favicon?: string; tags?: string; country?: string; state?: string; language?: string; codec?: string; bitrate?: number; hls?: number; geo_lat?: number | null; geo_long?: number | null; clickcount?: number; lastcheckok?: number };
  let list: St[] | null = null;
  for (const host of ['de1.api.radio-browser.info', 'de2.api.radio-browser.info', 'fi1.api.radio-browser.info']) {
    try {
      list = await json<St[]>(`https://${host}/json/stations/search?has_geo_info=true&hidebroken=true&order=clickcount&reverse=true&limit=100000`, 180000);
      break;
    } catch (e) {
      console.warn(`  radio mirror ${host}: ${e}`);
    }
  }
  if (!list) throw new Error('no Radio Browser mirror reachable');
  const slim = list
    .filter((s) => s.geo_lat != null && s.geo_long != null && s.lastcheckok !== 0 && s.url_resolved)
    .map((s) => ({
      stationuuid: s.stationuuid,
      name: s.name,
      url_resolved: s.url_resolved,
      homepage: s.homepage || undefined,
      favicon: s.favicon || undefined,
      tags: s.tags ? s.tags.split(',').slice(0, 4).join(',') : undefined,
      country: s.country || undefined,
      state: s.state || undefined,
      language: s.language || undefined,
      codec: s.codec || undefined,
      bitrate: s.bitrate || undefined,
      hls: s.hls || undefined,
      geo_lat: Math.round(s.geo_lat! * 1e4) / 1e4,
      geo_long: Math.round(s.geo_long! * 1e4) / 1e4,
      clickcount: s.clickcount || undefined,
    }));
  write('radio/top.json', slim.slice(0, 4000));
  const cells = new Map<string, typeof slim>();
  for (const s of slim) {
    const key = `${Math.floor(s.geo_lat / 10) * 10}_${Math.floor(s.geo_long / 10) * 10}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key)!.push(s);
  }
  for (const [key, l] of cells) write(`radio/cells/${key}.json`, l);
  console.log(`  ${slim.length} stations in ${cells.size} cells`);
});

await task('mars', 6 * 3600 * 1000, async () => {
  // @ts-expect-error plain JS module shared with the local generator
  const { buildMarsTraverse } = await import('./mars-traverse.mjs');
  const data = await buildMarsTraverse();
  write('mars/traverse.json', data);
  console.log(`  Perseverance ${data.m20.km} km, Curiosity ${data.msl.km} km, ${data.heli.flights.length} Ingenuity flights`);
});

await task('cams', DAY, async () => {
  const { CAM_FEEDS, SNAPSHOT_CAMS } = await import('../src/api/camfeeds');
  let ok = 0;
  for (const feed of CAM_FEEDS.filter((f) => SNAPSHOT_CAMS.has(f.id))) {
    try {
      const features = await feed.load();
      if (features.length) {
        write(`cams/${feed.id}.json`, features);
        ok++;
      }
      console.log(`  ${feed.id}: ${features.length}`);
    } catch (e) {
      console.warn(`  ${feed.id}: ${e instanceof Error ? e.message : e}`);
    }
  }
  if (!ok) throw new Error('no camera feed reachable');
});

// One merged position list from all camera snapshot files (plus the Finnish Digitraffic
// cameras, which have no snapshot file) for the closeable webcam heatmap: it shows the complete
// camera distribution worldwide at every zoom level. If individual feeds fail, their previous
// snapshot file remains (see PREV copy at the top) and is used here – the heatmap loses no data.
await task('cams-world', DAY, async () => {
  const { loadDigitrafficCams } = await import('../src/api/cams');
  const pts: [number, number][] = [];
  const push = (lon: number, lat: number) => {
    if (Number.isFinite(lon) && Number.isFinite(lat) && (lon || lat)) pts.push([Math.round(lon * 1e4) / 1e4, Math.round(lat * 1e4) / 1e4]);
  };
  try {
    for (const f of (await loadDigitrafficCams()).features) push(f.geometry.coordinates[0], f.geometry.coordinates[1]);
  } catch (e) {
    console.warn(`  Digitraffic: ${e instanceof Error ? e.message : e}`);
  }
  const dir = join(OUT, 'cams');
  for (const file of existsSync(dir) ? readdirSync(dir) : []) {
    if (!/\.json$/.test(file) || file === 'world.json') continue;
    try {
      const fc = JSON.parse(readFileSync(join(dir, file), 'utf8')) as { features?: { geometry?: { type: string; coordinates?: number[] } }[] };
      for (const f of fc.features ?? []) if (f.geometry?.type === 'Point') push(f.geometry.coordinates![0], f.geometry.coordinates![1]);
    } catch (e) {
      console.warn(`  ${file}: ${e instanceof Error ? e.message : e}`);
    }
  }
  if (pts.length < 500) throw new Error(`only ${pts.length} camera positions`);
  // exact duplicate positions (e.g. same place from two feeds) stay in – the heatmap counts them;
  // for the dots they are harmless
  write('cams/world.json', pts);
  console.log(`  ${pts.length} Kamerapositionen`);
});

// places with Mapillary 360° photos for the panorama game; the long crawl runs once a month
await task('street-panos', 29 * DAY, async () => {
  const token = process.env.MAPILLARY_TOKEN;
  if (!token) {
    console.log('  no MAPILLARY_TOKEN secret – skipping');
    return;
  }
  // @ts-expect-error plain JS module shared with the local generator
  const { buildStreetPanos, landTiles } = await import('./street-panos.mjs');
  // the Action runs from the repository root (this file is bundled to ../fetch-data.mjs)
  const countries = JSON.parse(readFileSync(join(process.cwd(), 'public/data/games/countries.json'), 'utf8'));
  const data = await buildStreetPanos({ token, tiles: landTiles(countries), log: (m: string) => console.log(`  ${m}`) });
  if (data.points.length < 1000) throw new Error(`only ${data.points.length} points – keeping previous data`);
  write('street/panos.json', data);
  console.log(`  ${data.points.length} points`);
});

meta.updated = new Date().toISOString();
write('meta.json', meta);
