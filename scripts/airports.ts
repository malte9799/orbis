// Pre-builds the ground layouts of large airports for the "Flughafen 3D" layer
// (public/data/airports/<ICAO>.json + index.json). The public Overpass servers need 30 s and
// more for a big airport and are often at capacity, so the app loads these files first and only
// asks Overpass for airports that are not listed here.
//
//   npx esbuild scripts/airports.ts --bundle --platform=node --format=esm --outfile=/tmp/airports.mjs
//   node /tmp/airports.mjs [--force] [ICAO …]
//
// Already built airports are skipped unless --force is given. Data: © OpenStreetMap contributors (ODbL).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseAirport, type AirportLayout, type OsmElement } from '../src/api/airport-parse';

const OUT = 'public/data/airports';
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const PAD = 0.006; // degrees around the aerodrome outline

/** ICAO codes of the airports to build (large hubs; extend the list and run the script again). */
const AIRPORTS = [
  'EDDF', 'EDDM', 'EDDB', 'EDDH', 'EDDL', 'EDDK', 'EDDS', 'EDDP', 'EDDN', 'EDDV', 'EDDW', 'EDDG',
  'LOWW', 'LSZH', 'LFPG', 'EGLL', 'EHAM', 'EBBR', 'LEMD', 'LEBL', 'LIRF', 'LIMC', 'EKCH', 'LTFM',
  'KJFK', 'KLAX', 'KORD', 'KATL', 'OMDB', 'VHHH', 'WSSS', 'RJTT',
];

interface Tags {
  [k: string]: string;
}
interface BoundsEl extends OsmElement {
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number };
  tags?: Tags;
}

async function overpass<T>(query: string): Promise<T> {
  let last: unknown;
  for (let round = 0; round < 4; round++) {
    for (const ep of ENDPOINTS) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 150000);
      try {
        const res = await fetch(ep, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', 'User-Agent': 'Orbis-airport-builder/1.0 (+https://github.com/malte9799/orbis)' },
          body: new URLSearchParams({ data: query }),
          signal: ctrl.signal,
        });
        if (res.ok) return (await res.json()) as T;
        last = new Error(`HTTP ${res.status} ${ep}`);
      } catch (e) {
        last = e;
      } finally {
        clearTimeout(timer);
      }
      await sleep(4000);
    }
    await sleep(15000 * (round + 1));
  }
  throw last;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const r5 = (n: number) => Math.round(n * 1e5) / 1e5;

type Geo = { coordinates: unknown };
function roundCoords(c: unknown): unknown {
  return Array.isArray(c) ? (typeof c[0] === 'number' ? (c as number[]).map(r5) : c.map(roundCoords)) : c;
}

/** compact feature: rounded coordinates, only the properties the layer reads */
function compact(layout: AirportLayout) {
  const strip = <F extends { geometry: Geo; properties: Record<string, unknown> | null; id?: string | number }>(f: F, keys: string[]) => {
    const props: Record<string, unknown> = {};
    for (const k of keys) {
      const v = f.properties?.[k];
      if (v !== '' && v != null && !(k === 'minh' && v === 0)) props[k] = v;
    }
    return { type: 'Feature', id: f.id, geometry: { ...f.geometry, coordinates: roundCoords(f.geometry.coordinates) }, properties: props };
  };
  return {
    polygons: layout.polygons.map((f) => strip(f, ['kind'])),
    lines: layout.lines.map((f) => strip(f, ['kind', 'ref', 'w'])),
    // gates and parking positions as features, the (many) lights as one flat [lon, lat, …] array
    points: layout.points.filter((f) => f.properties?.kind !== 'light').map((f) => strip(f, ['kind', 'ref'])),
    lights: layout.points.filter((f) => f.properties?.kind === 'light').flatMap((f) => (f.geometry.coordinates as number[]).map(r5)),
  };
}

async function build(icao: string) {
  const found = await overpass<{ elements: BoundsEl[] }>(`[out:json][timeout:60];nwr["icao"="${icao}"]["aeroway"="aerodrome"];out tags bb;`);
  const el = found.elements.find((e) => e.bounds);
  if (!el?.bounds) throw new Error(`${icao}: not found in OSM`);
  const { minlat, minlon, maxlat, maxlon } = el.bounds;
  const bb = [minlat - PAD, minlon - PAD, maxlat + PAD, maxlon + PAD];
  const bbox = bb.join(',');
  await sleep(3000);
  const core = await overpass<{ elements: OsmElement[] }>(`[out:json][timeout:120];
(
  way["aeroway"~"^(runway|taxiway|taxilane|apron|helipad)$"](${bbox});
  way["aeroway"~"^(gate|parking_position)$"](${bbox});
  node["aeroway"~"^(gate|parking_position|helipad)$"](${bbox});
);
out geom qt;`);
  await sleep(3000);
  const lights = await overpass<{ elements: OsmElement[] }>(`[out:json][timeout:120];node["aeroway"="navigationaid"](${bbox});out qt;`);
  const layout = parseAirport([...core.elements, ...lights.elements]);
  const seen = new Set<string>();
  const dedupe = <T extends { id?: string | number }>(l: T[]) => l.filter((f) => !seen.has(String(f.id)) && seen.add(String(f.id)));
  layout.polygons = dedupe(layout.polygons);
  layout.lines = dedupe(layout.lines);
  layout.points = dedupe(layout.points);
  const name = el.tags?.['name:de'] ?? el.tags?.name ?? icao;
  const file = { icao, name, bbox: [bb[1], bb[0], bb[3], bb[2]].map(r5), ...compact(layout) };
  writeFileSync(`${OUT}/${icao}.json`, JSON.stringify(file));
  return { icao, name, bbox: file.bbox, bytes: JSON.stringify(file).length, lines: layout.lines.length, polys: layout.polygons.length, points: layout.points.length };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const wanted = args.filter((a) => !a.startsWith('--'));
  const list = wanted.length ? wanted : AIRPORTS;
  const indexFile = `${OUT}/index.json`;
  const index: { icao: string; name: string; bbox: number[] }[] = existsSync(indexFile) ? JSON.parse(readFileSync(indexFile, 'utf8')).airports : [];
  for (const icao of list) {
    if (!force && existsSync(`${OUT}/${icao}.json`)) {
      console.log(`${icao}: exists, skipped`);
      continue;
    }
    try {
      const r = await build(icao);
      console.log(`${icao}: ${r.name} – ${r.lines} lines, ${r.polys} areas, ${r.points} points, ${(r.bytes / 1024).toFixed(0)} KB`);
      const i = index.findIndex((e) => e.icao === icao);
      const entry = { icao, name: r.name, bbox: r.bbox };
      if (i >= 0) index[i] = entry;
      else index.push(entry);
      index.sort((a, b) => a.icao.localeCompare(b.icao));
      writeFileSync(indexFile, JSON.stringify({ airports: index }));
    } catch (e) {
      console.warn(`${icao}: FAILED – ${e instanceof Error ? e.message : e}`);
    }
    await sleep(5000);
  }
}

main();
