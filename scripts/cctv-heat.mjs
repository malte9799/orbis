// Surveillance cameras for the CCTV layer: a density heatmap for the overview and the single
// cameras in 0.5° tiles for the zoomed-in view (no live Overpass queries needed).
// Streams a Geofabrik regional extract through `osmium tags-filter -R` (stdin needs -R; nothing big is stored),
// reads the man_made=surveillance nodes and writes
//   <out>/cctv-<region>.json            heatmap: [[lon, lat, count], …] per ~1 km cell
//   <out>/cctv-<region>/<ix>_<iy>.json  cameras of one 0.5° tile (see `record` for the layout)
//   <out>/cctv-<region>-tiles.json      list of the tiles that exist
// The same pass also collects further point data that used to be queried live from Overpass, in the
// same tile layout (<out>/<set>-<region>/<ix>_<iy>.json plus <out>/<set>-<region>-tiles.json):
//   blitzer   speed and red-light cameras (highway=speed_camera nodes, kind refined by type=enforcement relations)
//   alpr      licence plate readers (surveillance:type=ALPR)
//   webcam    OpenStreetMap webcams with a link
//   wind      single wind turbines (power=generator, generator:source=wind)
//   resource  mine shafts, adits, wells, quarry/mine/oil/gas/refinery points
// Only nodes are available when streaming (-R): ways and areas with these tags are not included.
// Run by .github/workflows/cctv-heat.yml:
//   node scripts/cctv-heat.mjs <outDir> [region]
// Without a region the stalest one (older than MAX_AGE_DAYS, or missing) is refreshed – one per
// run, so a daily schedule staggers the regions and idles the rest of the month.
// Data © OpenStreetMap contributors (ODbL), extracts by Geofabrik.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

export const REGIONS = {
  europe: 'europe',
  russia: 'russia',
  asia: 'asia',
  'north-america': 'north-america',
  'central-america': 'central-america',
  'south-america': 'south-america',
  africa: 'africa',
  oceania: 'australia-oceania',
};
const MAX_AGE_DAYS = 30;
const CELL = 100; // heatmap cells per degree (0.01° ≈ 1 km)
const TILE = 2; // camera tiles per degree (0.5°)
/** bump when the file layout changes: older regions count as stale and are rebuilt */
const FORMAT = 4;
/** point data sets besides the CCTV cameras – the client reads them in src/api/osmtiles.ts */
export const SETS = ['blitzer', 'alpr', 'webcam', 'wind', 'resource'];

/** OPL escapes unsafe characters as %hex% */
const unescapeOpl = (v) => v.replace(/%([0-9a-f]+)%/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));

function parseTags(raw) {
  const tags = {};
  for (const kv of raw.split(',')) {
    const i = kv.indexOf('=');
    if (i > 0) tags[unescapeOpl(kv.slice(0, i))] = unescapeOpl(kv.slice(i + 1));
  }
  return tags;
}

/** One OPL line of a node → { id, x, y, tags } or null (not a node, no position). */
export function parseNode(line) {
  if (line.charCodeAt(0) !== 110 /* n */) return null;
  let id, x, y, raw = '';
  for (const f of line.split(' ')) {
    if (f[0] === 'n' && id === undefined) id = f.slice(1);
    else if (f[0] === 'x') x = parseFloat(f.slice(1));
    else if (f[0] === 'y') y = parseFloat(f.slice(1));
    else if (f[0] === 'T') raw = f.slice(1);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { id, x, y, tags: parseTags(raw) };
}

/** Like parseNode, but only for CCTV cameras: man_made=surveillance without ALPR and webcams with a link. */
export function parseOpl(line) {
  const p = parseNode(line);
  if (!p) return null;
  const t = p.tags;
  if (t.man_made !== 'surveillance' || t['surveillance:type'] === 'ALPR' || t.webcam || t['contact:webcam']) return null;
  return p;
}

/** One OPL line of an enforcement relation → { tags, members: [{ ref, role }] } or null. Only node members are kept. */
export function parseEnforcement(line) {
  if (line.charCodeAt(0) !== 114 /* r */) return null;
  let raw = '', mem = '';
  for (const f of line.split(' ')) {
    if (f[0] === 'T') raw = f.slice(1);
    else if (f[0] === 'M') mem = f.slice(1);
  }
  const tags = parseTags(raw);
  if (tags.type !== 'enforcement') return null;
  const members = [];
  for (const m of mem.split(',')) {
    const at = m.indexOf('@');
    if (m[0] === 'n' && at > 1) members.push({ ref: m.slice(1, at), role: unescapeOpl(m.slice(at + 1)) });
  }
  return { tags, members };
}

const r5 = (v) => Math.round(v * 1e5) / 1e5;

/** Blitzer tile record: [lon, lat, direction°|-1, kind 'cam'|'section'|'signals', maxspeed, operator, ref, OSM node id] */
export function speedRecord({ id, x, y, tags }) {
  const dir = parseFloat((tags.direction ?? tags['camera:direction'] ?? '').split(';')[0]);
  const kind = tags.enforcement === 'traffic_signals' ? 'signals' : 'cam';
  return [r5(x), r5(y), Number.isFinite(dir) ? Math.round(dir) : -1, kind, tags.maxspeed ?? '', tags.operator ?? '', tags.ref ?? '', Number(id)];
}

/** Tile record: [lon, lat, direction°|-1, surveillance, camera:type, camera:mount, guard 0|1, operator, OSM node id] */
export function record({ id, x, y, tags }) {
  const dir = parseFloat((tags['camera:direction'] ?? tags.direction ?? '').split(';')[0]);
  return [r5(x), r5(y), Number.isFinite(dir) ? Math.round(dir) : -1, tags.surveillance ?? '', tags['camera:type'] ?? '', tags['camera:mount'] ?? '', tags['surveillance:type'] === 'guard' ? 1 : 0, tags.operator ?? '', Number(id)];
}

const dirOf = (t) => {
  const d = parseFloat((t['camera:direction'] ?? t.direction ?? '').split(';')[0]);
  return Number.isFinite(d) ? Math.round(d) : -1;
};

/** ALPR record: [lon, lat, direction°|-1, brand, flock 0|1, mount, operator, zone, since, ref, OSM node id] */
export function alprRecord({ id, x, y, tags: t }) {
  const brand = t.manufacturer ?? t.brand ?? t['manufacturer:wikidata'] ?? '';
  const flock = /flock/i.test(brand) || t['manufacturer:wikidata'] === 'Q108485435' ? 1 : 0;
  return [r5(x), r5(y), dirOf(t), brand, flock, t['camera:mount'] ?? '', t.operator ?? '', t['surveillance:zone'] ?? '', t.start_date ?? '', t.ref ?? '', Number(id)];
}

/** the link of an OSM webcam, or '' (the layer shows webcams that have one) */
const webcamLink = (t) => {
  if (!(t.webcam || t['contact:webcam'] || t.surveillance === 'webcam')) return '';
  const link = t.webcam ?? t['contact:webcam'] ?? t.url ?? t.website ?? t['contact:website'];
  return link && /^https?:\/\//.test(link) ? link : '';
};

/** webcam record: [lon, lat, direction°|-1, name, operator, panning 0|1, link, OSM node id] */
export function webcamRecord({ id, x, y, tags: t }, link) {
  return [r5(x), r5(y), dirOf(t), t.name ?? t.description ?? '', t.operator ?? '', t['camera:type'] === 'panning' ? 1 : 0, link, Number(id)];
}

/** wind turbine record: [lon, lat, name, operator, manufacturer, model, output, OSM node id] */
export function windRecord({ id, x, y, tags: t }) {
  return [r5(x), r5(y), t.name ?? '', t.operator ?? '', t.manufacturer ?? '', t['generator:model'] ?? t.model ?? '', t['generator:output:electricity'] ?? '', Number(id)];
}

/** resource record: [lon, lat, name, kind label, resource words, resource tag, operator, OSM node id] – kind/words as the layer expects them */
export function resourceRecord({ id, x, y, tags: t }) {
  const kind =
    t.man_made === 'petroleum_well' || t.man_made === 'pumpjack' ? 'Bohrloch' : t.landuse === 'quarry' ? 'Steinbruch/Tagebau' : t.man_made === 'mineshaft' ? 'Schacht' : t.man_made === 'adit' ? 'Stollen' : t.industrial === 'refinery' ? 'Raffinerie' : 'Bergwerk';
  const words = [t.resource, t['resource:type'], t.product, t.substance, t.industrial === 'oil' ? 'oil' : '', t.industrial === 'gas' ? 'gas' : '', t.man_made === 'petroleum_well' ? 'oil' : ''].filter(Boolean).join(' ');
  return [r5(x), r5(y), t.name ?? '', kind, words, t.resource ?? '', t.operator ?? '', Number(id)];
}

const RESOURCE_MAN_MADE = ['petroleum_well', 'pumpjack', 'mineshaft', 'adit'];
const RESOURCE_INDUSTRIAL = ['mine', 'oil', 'gas', 'refinery'];

/** which point data sets a node belongs to, with its records */
function classify(p) {
  const t = p.tags;
  const out = [];
  if (t['surveillance:type'] === 'ALPR') out.push(['alpr', alprRecord(p)]);
  const link = webcamLink(t);
  if (link) out.push(['webcam', webcamRecord(p, link)]);
  if (t.power === 'generator' && t['generator:source'] === 'wind') out.push(['wind', windRecord(p)]);
  if (RESOURCE_MAN_MADE.includes(t.man_made) || RESOURCE_INDUSTRIAL.includes(t.industrial) || t.landuse === 'quarry') out.push(['resource', resourceRecord(p)]);
  return out;
}

async function heat(region) {
  const url = `https://download.geofabrik.de/${REGIONS[region]}-latest.osm.pbf`;
  const cmd = `curl -sSfL -A "Orbis-data/1.0 (+https://github.com/malte9799/orbis)" "${url}" | osmium tags-filter -R --input-format=pbf --output-format=opl --overwrite -o - - n/man_made=surveillance n/highway=speed_camera n/surveillance:type=ALPR n/webcam n/contact:webcam n/generator:source=wind n/man_made=${RESOURCE_MAN_MADE.join(',')} n/industrial=${RESOURCE_INDUSTRIAL.join(',')} n/landuse=quarry r/type=enforcement`;
  const proc = spawn('bash', ['-c', `set -o pipefail; ${cmd}`], { stdio: ['ignore', 'pipe', 'inherit'] });
  console.log(`${region}: streaming ${url}`);
  const t0 = Date.now();
  const cells = new Map();
  const tiles = new Map();
  /** speed cameras by node id; enforcement relations (they come after all nodes) refine their kind */
  const speed = new Map();
  /** the other point data sets: set → tile → records */
  const sets = Object.fromEntries(['alpr', 'webcam', 'wind', 'resource'].map((k) => [k, new Map()]));
  let n = 0;
  for await (const line of createInterface({ input: proc.stdout })) {
    const rel = line.charCodeAt(0) === 114 ? parseEnforcement(line) : null;
    if (rel) {
      // positions of relations are not available when streaming (-R), so use their device nodes:
      // red-light relation → its devices are red-light cameras; several devices of a speed relation → monitored stretch
      const devices = rel.members.map((m) => speed.get(m.ref)).filter(Boolean);
      if (rel.tags.enforcement === 'traffic_signals') for (const d of devices) d.rec[3] = 'signals';
      else if (rel.tags.enforcement === 'maxspeed' && devices.length > 1) for (const d of devices) if (d.rec[3] === 'cam') d.rec[3] = 'section';
      continue;
    }
    const node = parseNode(line);
    if (!node) continue;
    if (node.tags.highway === 'speed_camera') {
      speed.set(node.id, { x: node.x, y: node.y, rec: speedRecord(node) });
      continue;
    }
    for (const [set, rec] of classify(node)) {
      const tile = `${Math.floor(node.x * TILE)}_${Math.floor(node.y * TILE)}`;
      if (!sets[set].has(tile)) sets[set].set(tile, []);
      sets[set].get(tile).push(rec);
    }
    const p = parseOpl(line);
    if (!p) continue;
    const key = `${Math.round(p.x * CELL)},${Math.round(p.y * CELL)}`;
    cells.set(key, (cells.get(key) ?? 0) + 1);
    const tile = `${Math.floor(p.x * TILE)}_${Math.floor(p.y * TILE)}`;
    if (!tiles.has(tile)) tiles.set(tile, []);
    tiles.get(tile).push(record(p));
    if (++n % 50000 === 0) console.log(`${region}: ${n} cameras so far (${Math.round((Date.now() - t0) / 1000)} s)`);
  }
  const code = await new Promise((res) => proc.on('close', res));
  if (code !== 0) throw new Error(`${region}: download/filter failed (exit ${code})`);
  const out = [...cells].map(([k, c]) => {
    const [x, y] = k.split(',').map(Number);
    return [x / CELL, y / CELL, c];
  });
  console.log(`${region}: ${n} cameras in ${out.length} cells and ${tiles.size} tiles (${Math.round((Date.now() - t0) / 1000)} s)`);
  const speedTiles = new Map();
  for (const { x, y, rec } of speed.values()) {
    const tile = `${Math.floor(x * TILE)}_${Math.floor(y * TILE)}`;
    if (!speedTiles.has(tile)) speedTiles.set(tile, []);
    speedTiles.get(tile).push(rec);
  }
  console.log(`${region}: ${speed.size} speed/red-light cameras in ${speedTiles.size} tiles`);
  const counts = { blitzer: speed.size };
  for (const [k, m] of Object.entries(sets)) {
    counts[k] = [...m.values()].reduce((a, l) => a + l.length, 0);
    console.log(`${region}: ${counts[k]} ${k} points in ${m.size} tiles`);
  }
  return { out, n, tiles, sets: { blitzer: speedTiles, ...sets }, counts };
}

async function main() {
  const [outDir, only] = process.argv.slice(2);
  if (!outDir) throw new Error('usage: cctv-heat <outDir> [region]');
  mkdirSync(outDir, { recursive: true });
  const metaPath = join(outDir, 'meta.json');
  const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : { regions: {} };
  meta.regions ??= {};
  let region = only;
  if (!region) {
    const age = (r) => (meta.regions[r]?.format === FORMAT ? Date.now() - meta.regions[r].at : Infinity);
    region = Object.keys(REGIONS).filter((r) => age(r) > MAX_AGE_DAYS * 864e5).sort((a, b) => age(b) - age(a))[0];
    if (!region) return console.log('all regions are up to date');
  }
  console.log(`refreshing ${region}`);
  if (!REGIONS[region]) throw new Error(`unknown region ${region}`);
  const { out, n, tiles, sets, counts } = await heat(region);
  if (n < 50) throw new Error(`${region}: only ${n} cameras – keeping previous data`);
  writeFileSync(join(outDir, `cctv-${region}.json`), JSON.stringify(out));
  // replace the region's tiles as a whole, so tiles without cameras any more disappear
  const dir = join(outDir, `cctv-${region}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const [tile, cams] of tiles) writeFileSync(join(dir, `${tile}.json`), JSON.stringify(cams));
  writeFileSync(join(outDir, `cctv-${region}-tiles.json`), JSON.stringify([...tiles.keys()]));
  console.log(`${region}: wrote ${tiles.size} tile files`);
  for (const set of SETS) {
    const sdir = join(outDir, `${set}-${region}`);
    rmSync(sdir, { recursive: true, force: true });
    mkdirSync(sdir, { recursive: true });
    for (const [tile, recs] of sets[set]) writeFileSync(join(sdir, `${tile}.json`), JSON.stringify(recs));
    writeFileSync(join(outDir, `${set}-${region}-tiles.json`), JSON.stringify([...sets[set].keys()]));
  }
  meta.regions[region] = { at: Date.now(), cameras: n, cells: out.length, tiles: tiles.size, points: counts, format: FORMAT };
  writeFileSync(metaPath, JSON.stringify(meta));
  writeFileSync(join(outDir, 'LICENSE.txt'), 'Data © OpenStreetMap contributors, available under the Open Database License (ODbL) 1.0: https://opendatacommons.org/licenses/odbl/1-0/\nhttps://www.openstreetmap.org/copyright\nDerived from Geofabrik extracts (https://download.geofabrik.de).\n');
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e.message); process.exit(1); });
