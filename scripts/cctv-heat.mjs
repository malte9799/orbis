// Surveillance cameras for the CCTV layer: a density heatmap for the overview and the single
// cameras in 0.5° tiles for the zoomed-in view (no live Overpass queries needed).
// Streams a Geofabrik regional extract through `osmium tags-filter -R` (stdin needs -R; nothing big is stored),
// reads the man_made=surveillance nodes and writes
//   <out>/cctv-<region>.json            heatmap: [[lon, lat, count], …] per ~1 km cell
//   <out>/cctv-<region>/<ix>_<iy>.json  cameras of one 0.5° tile (see `record` for the layout)
//   <out>/cctv-<region>-tiles.json      list of the tiles that exist
// The same pass also collects speed and red-light cameras (highway=speed_camera nodes plus
// type=enforcement relations) for the Blitzer layer, in the same tile layout:
//   <out>/blitzer-<region>/<ix>_<iy>.json  (see `speedRecord`) and <out>/blitzer-<region>-tiles.json
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
const FORMAT = 3;

/** OPL escapes unsafe characters as %hex% */
const unescapeOpl = (v) => v.replace(/%([0-9a-f]+)%/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));

/** One OPL line of a node → { id, x, y, tags } or null (not a node, no position, ALPR or a webcam with a link). */
export function parseOpl(line) {
  if (line.charCodeAt(0) !== 110 /* n */) return null;
  let id, x, y, raw = '';
  for (const f of line.split(' ')) {
    if (f[0] === 'n' && id === undefined) id = f.slice(1);
    else if (f[0] === 'x') x = parseFloat(f.slice(1));
    else if (f[0] === 'y') y = parseFloat(f.slice(1));
    else if (f[0] === 'T') raw = f.slice(1);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const tags = {};
  for (const kv of raw.split(',')) {
    const i = kv.indexOf('=');
    if (i > 0) tags[unescapeOpl(kv.slice(0, i))] = unescapeOpl(kv.slice(i + 1));
  }
  if (tags['surveillance:type'] === 'ALPR' || tags.webcam || tags['contact:webcam']) return null;
  return { id, x, y, tags };
}

/** One OPL line of an enforcement relation → { tags, members: [{ ref, role }] } or null. Only node members are kept. */
export function parseEnforcement(line) {
  if (line.charCodeAt(0) !== 114 /* r */) return null;
  let raw = '', mem = '';
  for (const f of line.split(' ')) {
    if (f[0] === 'T') raw = f.slice(1);
    else if (f[0] === 'M') mem = f.slice(1);
  }
  const tags = {};
  for (const kv of raw.split(',')) {
    const i = kv.indexOf('=');
    if (i > 0) tags[unescapeOpl(kv.slice(0, i))] = unescapeOpl(kv.slice(i + 1));
  }
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

async function heat(region) {
  const url = `https://download.geofabrik.de/${REGIONS[region]}-latest.osm.pbf`;
  const cmd = `curl -sSfL -A "Orbis-data/1.0 (+https://github.com/malte9799/orbis)" "${url}" | osmium tags-filter -R --input-format=pbf --output-format=opl --overwrite -o - - n/man_made=surveillance n/highway=speed_camera r/type=enforcement`;
  const proc = spawn('bash', ['-c', `set -o pipefail; ${cmd}`], { stdio: ['ignore', 'pipe', 'inherit'] });
  console.log(`${region}: streaming ${url}`);
  const t0 = Date.now();
  const cells = new Map();
  const tiles = new Map();
  /** speed cameras by node id; enforcement relations (they come after all nodes) refine their kind */
  const speed = new Map();
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
    const p = parseOpl(line);
    if (!p) continue;
    if (p.tags.highway === 'speed_camera') {
      speed.set(p.id, { x: p.x, y: p.y, rec: speedRecord(p) });
      continue;
    }
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
  return { out, n, tiles, speedN: speed.size, speedTiles };
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
  const { out, n, tiles, speedN, speedTiles } = await heat(region);
  if (n < 50) throw new Error(`${region}: only ${n} cameras – keeping previous data`);
  writeFileSync(join(outDir, `cctv-${region}.json`), JSON.stringify(out));
  // replace the region's tiles as a whole, so tiles without cameras any more disappear
  const dir = join(outDir, `cctv-${region}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const [tile, cams] of tiles) writeFileSync(join(dir, `${tile}.json`), JSON.stringify(cams));
  writeFileSync(join(outDir, `cctv-${region}-tiles.json`), JSON.stringify([...tiles.keys()]));
  console.log(`${region}: wrote ${tiles.size} tile files`);
  const sdir = join(outDir, `blitzer-${region}`);
  rmSync(sdir, { recursive: true, force: true });
  mkdirSync(sdir, { recursive: true });
  for (const [tile, cams] of speedTiles) writeFileSync(join(sdir, `${tile}.json`), JSON.stringify(cams));
  writeFileSync(join(outDir, `blitzer-${region}-tiles.json`), JSON.stringify([...speedTiles.keys()]));
  meta.regions[region] = { at: Date.now(), cameras: n, cells: out.length, tiles: tiles.size, speedcams: speedN, format: FORMAT };
  writeFileSync(metaPath, JSON.stringify(meta));
  writeFileSync(join(outDir, 'LICENSE.txt'), 'Data © OpenStreetMap contributors, available under the Open Database License (ODbL) 1.0: https://opendatacommons.org/licenses/odbl/1-0/\nhttps://www.openstreetmap.org/copyright\nDerived from Geofabrik extracts (https://download.geofabrik.de).\n');
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e.message); process.exit(1); });
