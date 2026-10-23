// Pre-builds airport layouts for the "Flughafen 3D" layer.
//
// Outputs:
//   public/data/airports/<ICAO>.json
//   public/data/airports/index.json
//
// Usage:
//   npx esbuild scripts/airports.ts --bundle --platform=node --format=esm --outfile=/tmp/airports.mjs
//   node /tmp/airports.mjs                  # all airports from the list
//   node /tmp/airports.mjs EDDF EDDM        # selected airports
//   node /tmp/airports.mjs --force EDDF     # regenerate existing files
//
// - Existing JSON files are never regenerated unless --force is given.
// - index.json is kept in sync with all <ICAO>.json files in the output folder.
//
// Requires Node >= 18 (global fetch).
// Data: © OpenStreetMap contributors (ODbL).

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  LIGHT_COLOURS,
  LIGHT_TYPES,
  parseAirport,
  type AirportLayout,
  type OsmElement,
} from '../src/api/airport-parse';

const OUT = 'public/data/airports';
const INDEX_FILE = `${OUT}/index.json`;

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const PAD = 0.006;
const REQUEST_TIMEOUT = 120_000; // client side; a host that is silent for longer is treated as down
const MAX_ATTEMPTS = 6; // per query, spread over all hosts
const HOST_GAP_MS = 1_000; // minimum gap between two request starts on one host
const DEFAULT_WORKERS = 2; // overpass-api.de allows ~2 slots per IP
const OUTLINE_CHUNK = 60; // ICAO codes per outline query
const INDEX_FLUSH_EVERY = 10;

/** Outlines found in earlier runs (saves the slow global search). */
const OUTLINE_CACHE = join(tmpdir(), 'orbis-airport-outlines.json');

const USER_AGENT =
  'Orbis-airport-builder/2.1 (OpenStreetMap data prebuild; https://github.com/malte9799/orbis)';

const ICAO_RE = /^[A-Z0-9]{4}$/;

/**
 * Existing airports plus additional major international airports.
 * Duplicates are removed at startup. Codes that do not exist in OSM simply
 * fail with a warning and do not stop the run.
 */
const AIRPORTS: string[] = [
  ...new Set<string>([
    // Germany
    'EDDF', 'EDDM', 'EDDB', 'EDDH', 'EDDL', 'EDDK', 'EDDS', 'EDDP',
    'EDDN', 'EDDV', 'EDDW', 'EDDG',
    'EDDE', 'EDFH', 'EDFM', 'EDGS', 'EDHI', 'EDHK', 'EDHL', 'EDJA',
    'EDLE', 'EDLP', 'EDLV', 'EDLW', 'EDMA', 'EDMO', 'EDNY', 'EDOP',
    'EDQD', 'EDQM', 'EDRK', 'EDRY', 'EDSB', 'EDTD', 'EDTF', 'EDVE',
    'EDVK', 'EDVM', 'EDWI', 'EDWR', 'EDWY', 'EDAZ', 'EDBH', 'EDBN',
    'EDCD', 'EDCG', 'EDCP', 'EDLA', 'EDLI', 'EDOV', 'EDPA',
    'EDQC', 'EDQH', 'EDRT', 'EDTM', 'EDTY',

    // Austria and Switzerland
    'LOWW', 'LOWG', 'LOWL', 'LOWS', 'LOWI', 'LOWK',
    'LSZH', 'LSGG', 'LFSB', 'LSGC',

    // France
    'LFPG', 'LFPO', 'LFBO', 'LFML', 'LFMN', 'LFLL', 'LFBD',
    'LFRS', 'LFRN', 'LFRB', 'LFST', 'LFRK', 'LFRQ',

    // United Kingdom and Ireland
    'EGLL', 'EGKK', 'EGGW', 'EGSS', 'EGCC', 'EGPF', 'EGPH',
    'EGBB', 'EGNX', 'EGNT', 'EGAA', 'EGAC', 'EGFF', 'EGPD',
    'EGTE', 'EIDW', 'EICK', 'EINN',

    // Benelux
    'EHAM', 'EHEH', 'EHRD', 'EBBR', 'EBLG', 'EBCI', 'ELLX',

    // Spain and Portugal
    'LEMD', 'LEBL', 'LEPA', 'LEAL', 'LEVC', 'LEBB', 'LEZL',
    'LPPT', 'LPPR', 'LPFR',

    // Italy
    'LIRF', 'LIMC', 'LIME', 'LIPZ', 'LIRN', 'LIMF', 'LIPX',
    'LICC', 'LICJ', 'LIBD', 'LIRQ',

    // Scandinavia
    'EKCH', 'EKBI', 'EKYT',
    'ENGM', 'ENBR', 'ENVA', 'ENZV', 'ENTC',
    'ESSA', 'ESGG', 'ESMS',
    'EFHK', 'EFRO', 'EFTP',
    'BIKF',

    // Central and Eastern Europe
    'LKPR', 'LKTB', 'LZIB', 'LZKZ',
    'EPWA', 'EPKK', 'EPGD', 'EPWR',
    'LHBP', 'LHDC', 'LDZA', 'LDDU', 'LDSP',
    'LYBE', 'LYPG', 'LRCL', 'LROP',
    'LBWN', 'LBSF', 'LGAV', 'LGTS', 'LGIR',
    'LTAC', 'LTAI', 'LTBJ',

    // Turkey and Middle East
    'LTFM', 'LTBA',
    'OMDB', 'OMAA', 'OMDW', 'OMSJ',
    'OTHH', 'OTBD', 'OERK', 'OEJN', 'OEDF',
    'OOMS', 'OKBK', 'OLBA', 'LLBG',

    // Africa
    'FAOR', 'FACT', 'FALE',
    'HAAB', 'HKJK', 'DNMM', 'DNAA',
    'GMMN', 'GMME', 'DTTA', 'DAAG',
    'HECA', 'HESH', 'GOOY', 'DIAP',
    'FIMP', 'FMEE',

    // United States
    'KJFK', 'KLAX', 'KORD', 'KATL',
    'KBOS', 'KIAD', 'KDCA', 'KPHL', 'KBWI',
    'KMIA', 'KFLL', 'KMCO', 'KTPA', 'KCLT',
    'KDTW', 'KMSP', 'KDEN', 'KPHX', 'KSAN',
    'KSEA', 'KSFO', 'KSJC', 'KPDX', 'KSLC',
    'KSTL', 'KMCI', 'KIND', 'KCVG', 'KCLE',
    'KPIT', 'KBNA', 'KAUS', 'KSAT', 'KHOU',
    'KIAH', 'KDAL', 'KDFW', 'KMSY', 'KJAX',
    'KANC', 'PHNL', 'KBUF', 'KRIC', 'KOMA',
    'KABQ',

    // Canada
    'CYVR', 'CYYZ', 'CYUL', 'CYYC', 'CYOW',
    'CYEG', 'CYWG', 'CYHZ', 'CYQB',

    // Mexico
    'MMMX', 'MMUN', 'MMGL', 'MMMY', 'MMTJ',

    // Japan
    'RJTT', 'RJAA', 'RJBB', 'RJCC', 'RJFF',
    'RJOO', 'RJGG', 'RJSS', 'ROAH',

    // China and Hong Kong
    'VHHH', 'ZBAA', 'ZSPD', 'ZGGG', 'ZGSZ',
    'ZUUU', 'ZUCK', 'ZSHC', 'ZSNJ', 'ZLXY',

    // Korea and Taiwan
    'RKSI', 'RKSS', 'RKPK', 'RCTP', 'RCSS',

    // Southeast Asia
    'WSSS', 'WMKK', 'WMKP', 'WIII', 'WADD',
    'VTBS', 'VTBD', 'VTSP', 'VVNB', 'VVTS',
    'RPLL', 'RPVM', 'VDPP', 'VLVT',

    // South Asia
    'VIDP', 'VABB', 'VOBL', 'VOMM', 'VOHS',
    'VECC', 'VEBS', 'VOGO', 'OPIS', 'OPLA',

    // Australia and New Zealand
    'YSSY', 'YMML', 'YBBN', 'YPPH', 'YBCG',
    'YPAD', 'YSCB', 'YMEN', 'YBCS',
    'NZAA', 'NZWN', 'NZCH', 'NZQN',

    // South America
    'SBGR', 'SBGL', 'SBBR', 'SBCF', 'SBKP',
    'SBRJ', 'SBPA', 'SBSV', 'SBRF', 'SBFZ',
    'SAEZ', 'SABE', 'SACO', 'SAME',
    'SCEL', 'SCFA', 'SKBO', 'SKRG', 'SKCL',
    'SPJC', 'SPZO', 'SEQM', 'SEGU',
    'SVMI', 'SGAS', 'SUMU', 'SLVR',

    // Central America and Caribbean
    'MPTO', 'MROC', 'MGGT', 'MHLM', 'MKJP',
    'TNCM', 'TJSJ', 'MYNN', 'MDSD', 'MDPC',
    'MUHA', 'MWCR',
  ]),
];

// ---------------------------------------------------------------- types

interface Tags {
  [key: string]: string;
}

interface BoundsEl extends OsmElement {
  bounds?: {
    minlat: number;
    minlon: number;
    maxlat: number;
    maxlon: number;
  };
  tags?: Tags;
}

interface IndexEntry {
  icao: string;
  name: string;
  bbox: number[];
}

interface Geo {
  type?: string;
  coordinates: unknown;
}

interface FeatureLike {
  type: string;
  id?: string | number;
  geometry: Geo;
  properties: Record<string, unknown> | null;
}

interface CompactFeature {
  type: 'Feature';
  id?: string | number;
  geometry: Geo;
  properties: Record<string, unknown>;
}

/** Content of <ICAO>.json. `lights` is a flat list: lon, lat, typeIdx, colourIdx, ... */
interface CompactAirport {
  icao: string;
  name: string;
  v: number;
  bbox: number[]; // [west, south, east, north]
  polygons: CompactFeature[];
  lines: CompactFeature[];
  points: CompactFeature[];
  lights: number[];
}

interface Options {
  force: boolean;
  workers: number;
}

class FatalError extends Error {}

// -------------------------------------------------------------- helpers

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const r5 = (n: number) => Math.round(n * 1e5) / 1e5;

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Write via temp file + rename so an interrupted run never leaves a half-written file. */
function writeAtomic(path: string, data: string) {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, data);
  renameSync(tmp, path);
}

function roundCoords(c: unknown): unknown {
  if (!Array.isArray(c)) return c;

  return typeof c[0] === 'number'
    ? (c as number[]).map(r5)
    : c.map(roundCoords);
}

function compact(
  icao: string,
  name: string,
  bbox: number[],
  layout: AirportLayout,
): CompactAirport {
  const strip = <F extends FeatureLike>(
    f: F,
    keys: string[],
  ): CompactFeature => {
    const props: Record<string, unknown> = {};

    for (const k of keys) {
      const v = f.properties?.[k];

      if (v !== '' && v != null) props[k] = v;
    }

    return {
      type: 'Feature',
      id: f.id,
      geometry: {
        ...f.geometry,
        coordinates: roundCoords(f.geometry.coordinates),
      },
      properties: props,
    };
  };

  const lightTypes = LIGHT_TYPES as readonly string[];
  const lightColours = LIGHT_COLOURS as readonly string[];

  return {
    icao,
    name,
    v: 2,
    bbox,
    polygons: layout.polygons.map((f) => strip(f, ['kind'])),
    lines: layout.lines.map((f) => strip(f, ['kind', 'ref', 'w'])),
    points: layout.points
      .filter((f) => f.properties?.kind !== 'light')
      .map((f) => strip(f, ['kind', 'ref'])),
    lights: layout.points
      .filter((f) => f.properties?.kind === 'light')
      .flatMap((f) => [
        ...(f.geometry.coordinates as number[]).map(r5),
        lightTypes.indexOf(String(f.properties?.lt)),
        lightColours.indexOf(String(f.properties?.col)),
      ]),
  };
}

// ------------------------------------------------------------- Overpass

/** Indented debug line, e.g. "    · [14:02:11] w0 EDDM data: try 1/6 on overpass-api.de" */
const debug = (msg: string) =>
  console.log(`    · [${new Date().toLocaleTimeString('de-DE')}] ${msg}`);

interface Host {
  url: string;
  name: string;
  /** no request before this time (rate limit / error backoff, shared by all workers) */
  blockedUntil: number;
  /** earliest start of the next request (keeps HOST_GAP_MS between starts) */
  nextStart: number;
  active: number;
  fails: number;
}

const HOSTS: Host[] = ENDPOINTS.map((url) => ({
  url,
  name: new URL(url).host,
  blockedUntil: 0,
  nextStart: 0,
  active: 0,
  fails: 0,
}));

/**
 * Every worker keeps to its own host, so two workers normally never hit the same server. When the
 * own host is paused for a longer time (rate limit, timeouts, down) the worker borrows the other
 * host (at most 2 requests at once) until the own one is back; it is probed again after its pause.
 */
function pickHost(worker: number): Host {
  const own = HOSTS[worker % HOSTS.length];

  if (own.blockedUntil - Date.now() < 20_000) return own;

  const others = HOSTS.filter(
    (h) => h !== own && h.active < 2 && h.blockedUntil - Date.now() < own.blockedUntil - Date.now(),
  );

  return others.sort((x, y) => x.active - y.active || x.blockedUntil - y.blockedUntil)[0] ?? own;
}

async function overpass<T>(query: string, label: string, worker: number): Promise<T> {
  const tag = `w${worker} ${label}`;
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const host = pickHost(worker);

    const startAt = Math.max(Date.now(), host.blockedUntil, host.nextStart);
    host.nextStart = startAt + HOST_GAP_MS;

    if (startAt - Date.now() > 1500) {
      debug(`${tag}: waiting ${((startAt - Date.now()) / 1000).toFixed(1)} s for ${host.name}`);
    }

    await sleep(startAt - Date.now());

    const controller = new AbortController();
    const started = Date.now();
    const took = () => `${((Date.now() - started) / 1000).toFixed(1)} s`;
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    let penalty = 0;
    let reason = '';

    host.active++;
    debug(`${tag}: try ${attempt}/${MAX_ATTEMPTS} on ${host.name}`);

    try {
      const response = await fetch(host.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          'User-Agent': USER_AGENT,
        },
        body: new URLSearchParams({ data: query }),
        signal: controller.signal,
      });

      if (response.ok) {
        const json = (await response.json()) as T & { remark?: string };

        // Overpass answers HTTP 200 even when the query failed or was cut
        // short; the result would then be silently incomplete.
        if (json.remark && /runtime error|timed out|out of memory/i.test(json.remark)) {
          throw new Error(`Overpass: ${json.remark}`);
        }

        host.fails = 0;
        debug(`${tag}: OK from ${host.name} in ${took()}`);

        return json;
      }

      host.fails++;
      reason = `HTTP ${response.status} from ${host.name} after ${took()}`;

      if (response.status === 429 || response.status === 504) {
        const retryAfter = Number(response.headers.get('retry-after'));

        penalty =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(retryAfter * 1000, 120_000)
            : Math.min(5000 * host.fails, 60_000);
      } else if (response.status >= 500) {
        penalty = Math.min(2000 * host.fails, 30_000);
      } else {
        // Other 4xx (e.g. 400 = broken query): retrying will not help.
        throw new FatalError(reason);
      }

      lastError = new Error(reason);
    } catch (error) {
      if (error instanceof FatalError) {
        debug(`${tag}: fatal, giving up (${error.message})`);
        throw error;
      }

      if (!reason) {
        host.fails++;
        // silent / unreachable host: pause it for longer each time, the other host takes over
        penalty = Math.min(30_000 * host.fails, 300_000);

        reason =
          error instanceof Error && error.name === 'AbortError'
            ? `TIMEOUT after ${took()} on ${host.name}`
            : `${errMsg(error)} on ${host.name} after ${took()}`;

        lastError = new Error(reason);
      }
    } finally {
      host.active--;
      clearTimeout(timer);
    }

    host.blockedUntil = Math.max(host.blockedUntil, Date.now() + penalty);
    debug(`${tag}: ${reason}; ${host.name} paused ${(penalty / 1000).toFixed(0)} s${attempt < MAX_ATTEMPTS ? ', retrying' : ''}`);
  }

  throw lastError instanceof Error ? lastError : new Error('Overpass request failed');
}

// -------------------------------------------------------------- outlines

interface Outline {
  name: string;
  bounds: { minlat: number; minlon: number; maxlat: number; maxlon: number };
}

const boundsArea = (b: Outline['bounds']) => (b.maxlat - b.minlat) * (b.maxlon - b.minlon);

function readOutlineCache(): Record<string, Outline> {
  try {
    return JSON.parse(readFileSync(OUTLINE_CACHE, 'utf8')) as Record<string, Outline>;
  } catch {
    return {};
  }
}

/**
 * Outlines (name + bounds) of many airports with a few batched queries instead of one global
 * search per airport (which took 20 s and more each). Found outlines are cached in the temp dir.
 */
async function loadOutlines(icaos: string[], workers: number): Promise<Map<string, Outline>> {
  const cache = readOutlineCache();
  const out = new Map<string, Outline>();
  const missing: string[] = [];

  for (const icao of icaos) {
    if (cache[icao]) out.set(icao, cache[icao]);
    else missing.push(icao);
  }

  if (out.size) console.log(`Outlines: ${out.size} from cache, ${missing.length} to fetch`);

  const chunks: string[][] = [];

  for (let i = 0; i < missing.length; i += OUTLINE_CHUNK) chunks.push(missing.slice(i, i + OUTLINE_CHUNK));

  await runPool(chunks, workers, async (chunk, worker, n) => {
    const query = `[out:json][timeout:180];nwr["aeroway"="aerodrome"]["icao"~"^(${chunk.join('|')})$"];out tags bb;`;
    const label = `outlines ${n + 1}/${chunks.length}`;

    try {
      const res = await overpass<{ elements: BoundsEl[] }>(query, label, worker);

      for (const e of res.elements) {
        const icao = e.tags?.icao;

        if (!icao || !e.bounds) continue;

        // Several objects can carry the same ICAO code; take the largest one.
        const known = out.get(icao);

        if (known && boundsArea(known.bounds) >= boundsArea(e.bounds)) continue;

        out.set(icao, { name: e.tags?.['name:de'] ?? e.tags?.name ?? icao, bounds: e.bounds });
      }

      console.log(`Outlines: batch ${n + 1}/${chunks.length} done (${chunk.length} codes)`);
    } catch (error) {
      console.warn(`Outlines: batch ${n + 1}/${chunks.length} FAILED – ${errMsg(error)}`);
    }
  });

  try {
    const merged = { ...cache };

    for (const [icao, o] of out) merged[icao] = o;

    writeFileSync(OUTLINE_CACHE, JSON.stringify(merged));
  } catch {
    // cache is only an optimisation
  }

  return out;
}

// ---------------------------------------------------------------- fetch

async function fetchAirport(icao: string, outline: Outline, worker: number): Promise<CompactAirport> {
  const { minlat, minlon, maxlat, maxlon } = outline.bounds;

  const bb = [minlat - PAD, minlon - PAD, maxlat + PAD, maxlon + PAD];
  const bbox = bb.join(',');

  const core = `way["aeroway"~"^(runway|taxiway|taxilane|apron|helipad|gate|parking_position)$"](${bbox});
  node["aeroway"~"^(gate|parking_position|helipad)$"](${bbox});`;
  const lights = `node["aeroway"="navigationaid"](${bbox});`;

  let elements: OsmElement[];

  try {
    // one request for everything
    const res = await overpass<{ elements: OsmElement[] }>(
      `[out:json][timeout:180];\n(\n  ${core}\n  ${lights}\n);\nout geom qt;`,
      `${icao} data`,
      worker,
    );

    elements = res.elements;
  } catch (error) {
    if (error instanceof FatalError) throw error;

    // very big airports: two smaller requests
    debug(`w${worker} ${icao}: combined query failed (${errMsg(error)}), splitting`);

    const a = await overpass<{ elements: OsmElement[] }>(`[out:json][timeout:180];\n(\n  ${core}\n);\nout geom qt;`, `${icao} layout`, worker);
    const b = await overpass<{ elements: OsmElement[] }>(`[out:json][timeout:180];\n(\n  ${lights}\n);\nout geom qt;`, `${icao} lights`, worker);

    elements = [...a.elements, ...b.elements];
  }

  const layout = parseAirport(elements);

  // Deduplicate per collection (a node and a way may share the same numeric
  // id) and never drop features that have no id at all.
  const dedupe = <T extends { id?: string | number }>(items: T[]) => {
    const seen = new Set<string>();

    return items.filter((item) => {
      if (item.id == null) return true;

      const id = String(item.id);

      if (seen.has(id)) return false;

      seen.add(id);
      return true;
    });
  };

  layout.polygons = dedupe(layout.polygons);
  layout.lines = dedupe(layout.lines);
  layout.points = dedupe(layout.points);

  // [west, south, east, north]
  const outputBbox = [bb[1], bb[0], bb[3], bb[2]].map(r5);

  return compact(icao, outline.name, outputBbox, layout);
}

// ----------------------------------------------------------------- pool

/** Runs fn for all items with `workers` parallel workers; worker i prefers host i. */
async function runPool<T>(
  items: T[],
  workers: number,
  fn: (item: T, worker: number, index: number) => Promise<void>,
): Promise<void> {
  let next = 0;

  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(workers, items.length)) }, async (_, worker) => {
      while (next < items.length) {
        const i = next++;

        await fn(items[i], worker, i);
      }
    }),
  );
}

// ---------------------------------------------------------------- index

function toEntry(d: CompactAirport): IndexEntry {
  return { icao: d.icao, name: d.name, bbox: d.bbox };
}

/**
 * Loads index.json, drops entries whose JSON file is gone, and adds entries
 * for any <ICAO>.json in the output folder that the index does not know yet
 * (also airports that are not in the AIRPORTS list).
 */
function loadIndex(): Map<string, IndexEntry> {
  const map = new Map<string, IndexEntry>();

  if (existsSync(INDEX_FILE)) {
    try {
      const parsed = JSON.parse(readFileSync(INDEX_FILE, 'utf8'));

      for (const e of Array.isArray(parsed.airports) ? parsed.airports : []) {
        if (e?.icao && Array.isArray(e.bbox) && existsSync(`${OUT}/${e.icao}.json`)) {
          map.set(e.icao, e);
        }
      }
    } catch {
      console.warn('index.json could not be parsed; rebuilding the index.');
    }
  }

  for (const file of readdirSync(OUT)) {
    const m = /^([A-Z0-9]{4})\.json$/.exec(file);

    if (!m || map.has(m[1])) continue;

    try {
      const data = JSON.parse(readFileSync(`${OUT}/${file}`, 'utf8'));

      if (
        typeof data.icao === 'string' &&
        typeof data.name === 'string' &&
        Array.isArray(data.bbox)
      ) {
        map.set(data.icao, toEntry(data));
      }
    } catch {
      console.warn(`${m[1]}: existing JSON is invalid; index entry skipped.`);
    }
  }

  return map;
}

function flushIndex(map: Map<string, IndexEntry>) {
  const airports = [...map.values()].sort((a, b) =>
    a.icao.localeCompare(b.icao),
  );

  writeAtomic(INDEX_FILE, JSON.stringify({ airports }));
}

// ---------------------------------------------------------------- build

function printHelp() {
  console.log(
    `Usage: node airports.mjs [--force] [--workers N] [ICAO ...]

  --force        regenerate existing files
  --workers N    parallel requests (default ${DEFAULT_WORKERS}, max 4)
  ICAO           one or more 4-letter ICAO codes (default: built-in list)`,
  );
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  const wIdx = args.indexOf('--workers');
  const workerArg = wIdx >= 0 ? Number(args[wIdx + 1]) : DEFAULT_WORKERS;

  if (wIdx >= 0) args.splice(wIdx, 2);

  const unknown = args.filter((a) => a.startsWith('-') && a !== '--force');

  if (unknown.length || !Number.isInteger(workerArg) || workerArg < 1) {
    console.error(`Unknown option(s): ${unknown.join(', ') || '--workers needs a number'}`);
    printHelp();
    process.exitCode = 2;
    return;
  }

  const opts: Options = {
    force: args.includes('--force'),
    workers: Math.min(workerArg, 4),
  };

  const wanted = args.filter((a) => !a.startsWith('-')).map((a) => a.toUpperCase());
  const invalid = wanted.filter((a) => !ICAO_RE.test(a));

  if (invalid.length) {
    console.error(`Invalid ICAO code(s): ${invalid.join(', ')}`);
    process.exitCode = 2;
    return;
  }

  const list = [...new Set(wanted.length ? wanted : AIRPORTS)];

  mkdirSync(OUT, { recursive: true });

  const index = loadIndex();
  flushIndex(index);

  // Keep what has been indexed so far if the run is interrupted.
  process.on('SIGINT', () => {
    flushIndex(index);
    console.log('\nInterrupted – index saved.');
    process.exit(130);
  });

  const todo = list.filter((icao) => opts.force || !existsSync(`${OUT}/${icao}.json`));
  const skipped = list.length - todo.length;

  console.log(`${list.length} airports requested, ${skipped} already built, ${todo.length} to do, ${opts.workers} workers`);

  const outlines = await loadOutlines(todo, opts.workers);

  let done = 0;
  let built = 0;
  const failedCodes: string[] = [];
  const startedAll = Date.now();

  await runPool(todo, opts.workers, async (icao, worker) => {
    const started = Date.now();
    let line: string;

    try {
      const outline = outlines.get(icao);

      if (!outline) throw new Error('aerodrome with bounds not found in OSM');

      const data = await fetchAirport(icao, outline, worker);
      const jsonPath = `${OUT}/${icao}.json`;

      writeAtomic(jsonPath, JSON.stringify(data));
      index.set(icao, toEntry(data));
      built++;

      if (built % INDEX_FLUSH_EVERY === 0) flushIndex(index);

      line =
        `✓ ${icao}: ${data.name} – ` +
        `${data.lines.length} lines, ${data.polygons.length} areas, ${data.points.length} points, ` +
        `${data.lights.length / 4} lights, ` +
        `${(readFileSync(jsonPath).length / 1024).toFixed(0)} KB, ` +
        `${((Date.now() - started) / 1000).toFixed(1)} s`;
    } catch (error) {
      failedCodes.push(icao);
      line = `✗ ${icao}: FAILED – ${errMsg(error)}`;
    }

    done++;

    const elapsed = (Date.now() - startedAll) / 1000;
    const eta = (elapsed / done) * (todo.length - done);

    console.log(`[${done}/${todo.length}] ${line}  (w${worker}, ETA ${Math.ceil(eta / 60)} min)`);
  });

  flushIndex(index);

  console.log('\nAirport build complete.');
  console.log(`Built:     ${built}`);
  console.log(`Skipped:   ${skipped}`);
  console.log(`Failed:    ${failedCodes.length}${failedCodes.length ? ` (${failedCodes.join(', ')})` : ''}`);
  console.log(`Requested: ${list.length}`);
  console.log(`Index:     ${index.size} airports`);
  console.log(`Time:      ${((Date.now() - startedAll) / 60000).toFixed(1)} min`);

  if (failedCodes.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
