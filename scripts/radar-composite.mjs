#!/usr/bin/env node
// Radar composites for the app: downloads raw radar rasters, reprojects them to Web Mercator
// and writes one small grayscale PNG per region and time step, plus a manifest.json.
//
// The PNG holds the rain rate, not colours: byte = round(sqrt(mm/h) * 25), 0 = no rain / no data
// (255 ≈ 104 mm/h). The browser colours and smooths it (src/globe/radar.ts), so the colour scale,
// the click value and the animation are identical for every source.
//
// Sources (open data, no key):
//   de  DWD RV composite, 1 km, 5 min, analysis + 120 min nowcast   (CC BY 4.0)
//
// usage: node scripts/radar-composite.mjs <outDir> [prevDir]
//   prevDir = previous snapshot; its frames of the last two hours are carried over.

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import * as hdf5 from 'jsfive';

const [OUT, PREV] = process.argv.slice(2);
if (!OUT) {
  console.error('usage: radar-composite.mjs <outDir> [prevDir]');
  process.exit(1);
}
const KEEP_MIN = 120;
const UA = 'orbis-radar/1.0 (+https://github.com/malte9799/orbis)';

// ---- PNG (grayscale, 8 bit) ---------------------------------------------------------------
const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (b) => {
  let c = -1;
  for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
};
function encodePng(w, h, gray) {
  const raw = Buffer.alloc((w + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w + 1)] = 0;
    Buffer.from(gray.buffer, gray.byteOffset + y * w, w).copy(raw, y * (w + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // grayscale
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ---- projections --------------------------------------------------------------------------
const A = 6378137;
const F = 1 / 298.257223563;
const E = Math.sqrt(2 * F - F * F);
const rad = Math.PI / 180;

/** north polar stereographic (ellipsoidal, true scale at latTs), metres */
function polarStereo(lon0, latTs) {
  const tFn = (phi) => Math.tan(Math.PI / 4 - phi / 2) / Math.pow((1 - E * Math.sin(phi)) / (1 + E * Math.sin(phi)), E / 2);
  const phic = latTs * rad;
  const mc = Math.cos(phic) / Math.sqrt(1 - E * E * Math.sin(phic) ** 2);
  const tc = tFn(phic);
  return (lonDeg, latDeg) => {
    const rho = (A * mc * tFn(latDeg * rad)) / tc;
    const dl = (lonDeg - lon0) * rad;
    return [rho * Math.sin(dl), -rho * Math.cos(dl)];
  };
}
const mercY = (latDeg) => Math.log(Math.tan(Math.PI / 4 + (latDeg * rad) / 2));
const mercLat = (y) => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) / rad;

// ---- sources ------------------------------------------------------------------------------
async function download(url, file) {
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} – ${url}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

/** DWD RV: tar of 25 HDF5 files (analysis + 5 … 120 min), u4 gain 0.001 = mm per 5 min */
async function loadDwd(tmp) {
  const tar = join(tmp, 'rv.tar');
  await download('https://opendata.dwd.de/weather/radar/composite/rv/composite_rv_LATEST.tar', tar);
  execFileSync('tar', ['xf', tar, '-C', tmp]);
  const files = readdirSync(tmp).filter((f) => f.endsWith('-hd5')).sort();
  const proj = polarStereo(10, 60);
  const frames = [];
  for (const name of files) {
    const buf = readFileSync(join(tmp, name));
    const f = new hdf5.File(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    const where = f.get('where').attrs;
    const what = f.get('dataset1/data1/what').attrs;
    const top = f.get('what').attrs;
    const proj4 = String(where.projdef);
    const x0 = Number(/\+x_0=([\d.]+)/.exec(proj4)?.[1]);
    const y0 = Number(/\+y_0=([\d.]+)/.exec(proj4)?.[1]);
    const lead = Number(/_(\d{3})-hd5$/.exec(name)?.[1]);
    const s = (v) => String(v).replace(/\0+$/, '');
    const base = Date.UTC(+s(top.date).slice(0, 4), +s(top.date).slice(4, 6) - 1, +s(top.date).slice(6, 8), +s(top.time).slice(0, 2), +s(top.time).slice(2, 4));
    frames.push({
      time: base + lead * 60000,
      lead,
      nx: where.xsize,
      ny: where.ysize,
      cell: where.xscale,
      x0,
      y0,
      gain: what.gain,
      offset: what.offset,
      nodata: what.nodata,
      factor: 12, // 5 min accumulation -> mm/h
      data: f.get('dataset1/data1/data').value,
      proj,
    });
  }
  return frames;
}

const REGIONS = [
  {
    id: 'de',
    name: 'Deutschland & Umgebung',
    attribution: 'Radar: © Deutscher Wetterdienst (DWD), CC BY 4.0',
    bounds: [1.2, 45.6, 19.0, 56.0], // west, south, east, north
    width: 1200,
    load: loadDwd,
  },
];

// ---- reprojection -------------------------------------------------------------------------
function render(frame, bounds, width, height) {
  const [w, s, e, n] = bounds;
  const yN = mercY(n);
  const yS = mercY(s);
  const out = new Uint8Array(width * height);
  const { nx, ny, cell, x0, y0, gain, offset, nodata, factor, data, proj } = frame;
  const rate = (col, row) => {
    if (col < 0 || row < 0 || col >= nx || row >= ny) return 0;
    const v = data[row * nx + col];
    if (v === nodata) return 0;
    return Math.max(0, (v * gain + offset) * factor);
  };
  for (let py = 0; py < height; py++) {
    const lat = mercLat(yN - ((py + 0.5) / height) * (yN - yS));
    for (let px = 0; px < width; px++) {
      const lon = w + ((px + 0.5) / width) * (e - w);
      const [x, y] = proj(lon, lat);
      // x_0/y_0 put the grid's north-west corner at the origin: x grows east, y runs down the rows
      const gx = (x + x0) / cell - 0.5;
      const gy = -(y + y0) / cell - 0.5;
      const c0 = Math.floor(gx);
      const r0 = Math.floor(gy);
      const fx = gx - c0;
      const fy = gy - r0;
      const v =
        rate(c0, r0) * (1 - fx) * (1 - fy) + rate(c0 + 1, r0) * fx * (1 - fy) + rate(c0, r0 + 1) * (1 - fx) * fy + rate(c0 + 1, r0 + 1) * fx * fy;
      out[py * width + px] = v < 0.02 ? 0 : Math.min(255, Math.round(Math.sqrt(v) * 25));
    }
  }
  return out;
}

// ---- main ---------------------------------------------------------------------------------
const stamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').slice(0, 13).replace('T', '') + 'Z';
const manifest = { updated: new Date().toISOString(), encoding: 'sqrt25', regions: [] };
const now = Date.now();

for (const region of REGIONS) {
  const dir = join(OUT, region.id);
  mkdirSync(dir, { recursive: true });
  const [w, s, e, n] = region.bounds;
  const height = Math.round(((mercY(n) - mercY(s)) / ((e - w) * rad)) * region.width);
  const tmp = mkdtempSync(join(tmpdir(), `radar-${region.id}-`));
  const frames = [];
  try {
    for (const fr of await region.load(tmp)) {
      const file = `${stamp(fr.time)}.png`;
      writeFileSync(join(dir, file), encodePng(region.width, height, render(fr, region.bounds, region.width, height)));
      frames.push({ time: new Date(fr.time).toISOString(), lead: fr.lead, file });
    }
  } catch (err) {
    console.warn(`${region.id}: ${err.message}`);
  }

  // carry over earlier observation frames of the previous snapshot
  const fresh = new Set(frames.map((f) => f.time));
  const prevManifest = PREV && existsSync(join(PREV, 'manifest.json')) ? JSON.parse(readFileSync(join(PREV, 'manifest.json'), 'utf8')) : null;
  const prevRegion = prevManifest?.regions.find((r) => r.id === region.id);
  for (const f of prevRegion?.frames ?? []) {
    const t = Date.parse(f.time);
    if (f.lead !== 0 || fresh.has(f.time) || t < now - KEEP_MIN * 60000) continue;
    const src = join(PREV, region.id, f.file);
    if (!existsSync(src)) continue;
    copyFileSync(src, join(dir, f.file));
    frames.push(f);
  }
  // a frame is the analysis (lead 0) of its run or a forecast; keep the newest run per valid time
  const byTime = new Map();
  for (const f of frames.sort((a, b) => a.time.localeCompare(b.time) || a.lead - b.lead)) {
    if (!byTime.has(f.time) || f.lead === 0) byTime.set(f.time, f);
  }
  const list = [...byTime.values()].sort((a, b) => a.time.localeCompare(b.time));
  if (!list.length) continue;
  manifest.regions.push({
    id: region.id,
    name: region.name,
    attribution: region.attribution,
    bounds: region.bounds,
    width: region.width,
    height,
    frames: list,
  });
  console.log(`${region.id}: ${list.length} frames, ${region.width}x${height}`);
}

writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest));
