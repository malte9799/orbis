// Surveillance camera density for the CCTV layer's overview heatmap.
// Streams a Geofabrik regional extract through `osmium tags-filter` (nothing big is stored),
// counts man_made=surveillance nodes per ~1 km cell and writes <out>/cctv-<region>.json as
// [[lon, lat, count], …]. Run by .github/workflows/cctv-heat.yml:
//   node scripts/cctv-heat.mjs <outDir> [region]
// Without a region the stalest one (older than MAX_AGE_DAYS, or missing) is refreshed – one per
// run, so a daily schedule staggers the regions and idles the rest of the month.
// Data © OpenStreetMap contributors (ODbL), extracts by Geofabrik.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
const CELL = 100; // cells per degree (0.01° ≈ 1 km)

const SKIP = /(^|,)(surveillance:type=ALPR|webcam=|contact:webcam=)/;

/** One OPL line of a node → [lon, lat] or null (not a node, no position, ALPR or a webcam with a link). */
export function parseOpl(line) {
  if (line.charCodeAt(0) !== 110 /* n */) return null;
  let x, y, tags = '';
  for (const f of line.split(' ')) {
    if (f[0] === 'x') x = parseFloat(f.slice(1));
    else if (f[0] === 'y') y = parseFloat(f.slice(1));
    else if (f[0] === 'T') tags = f.slice(1);
  }
  if (!Number.isFinite(x) || !Number.isFinite(y) || SKIP.test(tags)) return null;
  return [x, y];
}

async function heat(region) {
  const url = `https://download.geofabrik.de/${REGIONS[region]}-latest.osm.pbf`;
  const cmd = `curl -sSfL -A "Orbis-data/1.0 (+https://github.com/malte9799/orbis)" "${url}" | osmium tags-filter --input-format=pbf --output-format=opl --overwrite -o - - n/man_made=surveillance`;
  const proc = spawn('bash', ['-c', `set -o pipefail; ${cmd}`], { stdio: ['ignore', 'pipe', 'inherit'] });
  const cells = new Map();
  let n = 0;
  for await (const line of createInterface({ input: proc.stdout })) {
    const p = parseOpl(line);
    if (!p) continue;
    const key = `${Math.round(p[0] * CELL)},${Math.round(p[1] * CELL)}`;
    cells.set(key, (cells.get(key) ?? 0) + 1);
    n++;
  }
  const code = await new Promise((res) => proc.on('close', res));
  if (code !== 0) throw new Error(`${region}: download/filter failed (exit ${code})`);
  const out = [...cells].map(([k, c]) => {
    const [x, y] = k.split(',').map(Number);
    return [x / CELL, y / CELL, c];
  });
  console.log(`${region}: ${n} cameras in ${out.length} cells`);
  return { out, n };
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
    const age = (r) => (meta.regions[r] ? Date.now() - meta.regions[r].at : Infinity);
    region = Object.keys(REGIONS).filter((r) => age(r) > MAX_AGE_DAYS * 864e5).sort((a, b) => age(b) - age(a))[0];
    if (!region) return console.log('all regions are up to date');
  }
  if (!REGIONS[region]) throw new Error(`unknown region ${region}`);
  const { out, n } = await heat(region);
  if (n < 50) throw new Error(`${region}: only ${n} cameras – keeping previous data`);
  writeFileSync(join(outDir, `cctv-${region}.json`), JSON.stringify(out));
  meta.regions[region] = { at: Date.now(), cameras: n, cells: out.length };
  writeFileSync(metaPath, JSON.stringify(meta));
  writeFileSync(join(outDir, 'LICENSE.txt'), 'Data © OpenStreetMap contributors, available under the Open Database License (ODbL) 1.0: https://opendatacommons.org/licenses/odbl/1-0/\nhttps://www.openstreetmap.org/copyright\nDerived from Geofabrik extracts (https://download.geofabrik.de).\n');
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e.message); process.exit(1); });
