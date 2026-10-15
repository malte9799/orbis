#!/usr/bin/env node
// Radar composites for the app: downloads raw radar rasters, reprojects them to Web Mercator and
// writes a tile pyramid (z/x/y, zoom 2–7) per region and time step, plus a manifest.json.
//
// Tiles are 512 px grayscale PNGs that hold the rain rate, not colours:
// byte = round(sqrt(mm/h) * 25), 0 = no rain / no data (255 ≈ 104 mm/h). Zoom 7 is the native
// resolution of the 1 km sources, beyond that the browser stretches the tiles. The browser colours
// the values (src/globe/hdradar.ts), so scale, click value and animation are the same everywhere.
//
// Sources (open data, no key):
//   de  DWD RV composite, 1 km, 5 min, analysis + 120 min nowcast   (CC BY 4.0)
//
// usage: node scripts/radar-composite.mjs <outDir> [prevDir]
//   prevDir = previous snapshot; its frames of the last two hours are carried over.

import { execFileSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import * as hdf5 from 'jsfive';

const [OUT, PREV] = process.argv.slice(2);
if (!OUT) {
  console.error('usage: radar-composite.mjs <outDir> [prevDir]');
  process.exit(1);
}
const KEEP_MIN = 120;
const TILE = 512; // pixels per tile edge (2x the 256 px tile grid: smooth when zoomed in)
const ZMIN = 2;
const ZMAX = 7;
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
    load: loadDwd,
  },
];

// ---- tiles --------------------------------------------------------------------------------
const tileLon = (x, z) => (x / 2 ** z) * 360 - 180;
const tileLat = (y, z) => {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (Math.atan(Math.sinh(n)) * 180) / Math.PI;
};
const lonTile = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z);
const latTile = (lat, z) => {
  const r = lat * rad;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};

/** source grid position (fractional col/row) of every pixel of a tile */
function tileGeometry(z, x, y, frame) {
  const { cell, x0, y0, proj } = frame;
  const gx = new Float32Array(TILE * TILE);
  const gy = new Float32Array(TILE * TILE);
  for (let py = 0; py < TILE; py++) {
    const lat = tileLat(y + (py + 0.5) / TILE, z);
    for (let px = 0; px < TILE; px++) {
      const lon = tileLon(x + (px + 0.5) / TILE, z);
      const [X, Y] = proj(lon, lat);
      // x_0/y_0 put the grid's north-west corner at the origin: x grows east, y runs down the rows
      gx[py * TILE + px] = (X + x0) / cell - 0.5;
      gy[py * TILE + px] = -(Y + y0) / cell - 0.5;
    }
  }
  return { gx, gy };
}

/** rain rate [mm/h] grid of a frame, nodata = 0 */
function rateGrid(frame) {
  const { nx, ny, gain, offset, nodata, factor, data } = frame;
  const out = new Float32Array(nx * ny);
  for (let i = 0; i < out.length; i++) {
    const v = data[i];
    out[i] = v === nodata ? 0 : Math.max(0, (v * gain + offset) * factor);
  }
  return out;
}

// Catmull-Rom weights: bicubic sampling keeps the echoes round instead of diamond shaped
const cr = (t) => [(-t * t * t + 2 * t * t - t) / 2, (3 * t * t * t - 5 * t * t + 2) / 2, (-3 * t * t * t + 4 * t * t + t) / 2, (t * t * t - t * t) / 2];

function renderTile(rates, nx, ny, geo) {
  const out = new Uint8Array(TILE * TILE);
  const { gx, gy } = geo;
  let any = false;
  for (let i = 0; i < out.length; i++) {
    const fx = gx[i];
    const fy = gy[i];
    if (fx < -1 || fy < -1 || fx > nx || fy > ny) continue;
    const c0 = Math.floor(fx);
    const r0 = Math.floor(fy);
    const wx = cr(fx - c0);
    const wy = cr(fy - r0);
    let v = 0;
    for (let j = 0; j < 4; j++) {
      const r = r0 - 1 + j;
      if (r < 0 || r >= ny) continue;
      let row = 0;
      for (let k = 0; k < 4; k++) {
        const c = c0 - 1 + k;
        if (c >= 0 && c < nx) row += rates[r * nx + c] * wx[k];
      }
      v += row * wy[j];
    }
    if (v >= 0.01) {
      out[i] = Math.min(255, Math.round(Math.sqrt(v) * 25));
      any = true;
    }
  }
  return { out, any };
}

// ---- main ---------------------------------------------------------------------------------
const stamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').slice(0, 13).replace('T', '') + 'Z';
const manifest = { updated: new Date().toISOString(), encoding: 'sqrt25', tileSize: TILE, regions: [] };
const now = Date.now();

for (const region of REGIONS) {
  const dir = join(OUT, region.id);
  mkdirSync(dir, { recursive: true });
  const [w, s, e, n] = region.bounds;
  const tmp = mkdtempSync(join(tmpdir(), `radar-${region.id}-`));
  const frames = [];
  try {
    const src = await region.load(tmp);
    const rates = src.map(rateGrid);
    const names = src.map((fr) => stamp(fr.time));
    src.forEach((fr, k) => {
      frames.push({ time: new Date(fr.time).toISOString(), lead: fr.lead, id: names[k] });
      mkdirSync(join(dir, names[k]), { recursive: true });
    });
    const empty = encodePng(TILE, TILE, new Uint8Array(TILE * TILE));
    let count = 0;
    for (let z = ZMIN; z <= ZMAX; z++) {
      const x0t = lonTile(w, z);
      const x1t = lonTile(e, z);
      const y0t = latTile(n, z);
      const y1t = latTile(s, z);
      for (let x = x0t; x <= x1t; x++) {
        for (let y = y0t; y <= y1t; y++) {
          const geo = tileGeometry(z, x, y, src[0]);
          src.forEach((fr, k) => {
            const { out, any } = renderTile(rates[k], fr.nx, fr.ny, geo);
            const d = join(dir, names[k], String(z), String(x));
            mkdirSync(d, { recursive: true });
            writeFileSync(join(d, `${y}.png`), any ? encodePng(TILE, TILE, out) : empty);
            count++;
          });
        }
      }
    }
    console.log(`${region.id}: ${count} tiles`);
  } catch (err) {
    console.warn(`${region.id}: ${err.stack ?? err.message}`);
  }

  // carry over earlier observation frames of the previous snapshot
  const fresh = new Set(frames.map((f) => f.time));
  const prevManifest = PREV && existsSync(join(PREV, 'manifest.json')) ? JSON.parse(readFileSync(join(PREV, 'manifest.json'), 'utf8')) : null;
  const prevRegion = prevManifest?.regions.find((r) => r.id === region.id);
  for (const f of prevRegion?.frames ?? []) {
    const t = Date.parse(f.time);
    if (f.lead !== 0 || fresh.has(f.time) || t < now - KEEP_MIN * 60000 || !f.id) continue;
    const from = join(PREV, region.id, f.id);
    if (!existsSync(from)) continue;
    cpSync(from, join(dir, f.id), { recursive: true });
    frames.push(f);
  }
  // keep the newest run per valid time (an analysis wins over a forecast)
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
    minzoom: ZMIN,
    maxzoom: ZMAX,
    frames: list,
  });
  console.log(`${region.id}: ${list.length} frames`);
}

writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest));
copyFileSync(join(dirname(fileURLToPath(import.meta.url)), 'radar-README.md'), join(OUT, 'README.md'));
