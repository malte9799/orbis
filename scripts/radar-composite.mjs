#!/usr/bin/env node
// Radar nowcast for the app: downloads the DWD RV composite (1 km, 5 min, analysis + 120 min
// nowcast), reprojects it to Web Mercator and writes a tile pyramid (z/x/y, zoom 2–7) per time
// step, plus a manifest.json.
//
// Tiles are 512 px grayscale PNGs that hold the rain rate, not colours:
// byte = round(sqrt(mm/h) * 25), 0 = no rain, 255 = no measurement (outside the radars' range).
// Rain stops at 249 (≈ 99 mm/h): some browsers shift gray values by one while decoding, so the
// client treats everything from 250 up as "no measurement". Zoom 7 is the native resolution of
// the 1 km source, beyond that the browser stretches the tiles. The browser colours the values
// (src/globe/hdradar.ts), so scale, click value and animation match the re-coloured RainViewer tiles.
//
// Source: Deutscher Wetterdienst, https://opendata.dwd.de/weather/radar/composite/rv/ (CC BY 4.0)
//
// usage: node scripts/radar-composite.mjs <outDir>

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import h5wasm from 'h5wasm/node';
import proj4 from 'proj4';

const [OUT] = process.argv.slice(2);
if (!OUT) {
  console.error('usage: radar-composite.mjs <outDir>');
  process.exit(1);
}
const TILE = 512; // pixels per tile edge (2x the 256 px tile grid: smooth when zoomed in)
const ZMIN = 2;
const ZMAX = 7;
const NODATA = 255;
const UA = 'orbis-radar/1.0 (+https://github.com/malte9799/orbis)';
const REGION = {
  id: 'de',
  name: 'Deutschland & Umgebung',
  attribution: 'Radar: © Deutscher Wetterdienst (DWD), CC BY 4.0',
  bounds: [1.2, 45.6, 19.0, 56.0], // west, south, east, north
};

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

// ---- helpers --------------------------------------------------------------------------------
const rad = Math.PI / 180;
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
const stamp = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').slice(0, 13).replace('T', '') + 'Z';

/** read an ODIM HDF5 composite: attributes of `where`/`what` and the chosen data layer */
function readOdim(file, layer) {
  const f = new h5wasm.File(file, 'r');
  try {
    const attrs = (path) => Object.fromEntries(Object.entries(f.get(path).attrs).map(([k, v]) => [k, typeof v.value === 'bigint' ? Number(v.value) : (v.value ?? v)]));
    const where = attrs('where');
    const top = attrs('what');
    const what = attrs(`${layer}/what`);
    const date = String(top.date);
    const time = String(top.time);
    const ms = Date.UTC(+date.slice(0, 4), +date.slice(4, 6) - 1, +date.slice(6, 8), +time.slice(0, 2), +time.slice(2, 4));
    return { where, what, data: Float64Array.from(f.get(`${layer}/data`).value), ms };
  } finally {
    f.close();
  }
}

/** lon/lat -> fractional (col, row) of an ODIM grid, via its proj definition and upper-left corner */
function odimToGrid(where) {
  const fwd = proj4(String(where.projdef).replace(/\0+$/, ''));
  const [ulx, uly] = fwd.forward([where.UL_lon, where.UL_lat]);
  return (lon, lat) => {
    const [x, y] = fwd.forward([lon, lat]);
    return [(x - ulx) / where.xscale - 0.5, (uly - y) / where.yscale - 0.5];
  };
}

/** build a source from a decoded ODIM layer; `toRate(value)` returns mm/h */
function makeSource(o, toRate, lead) {
  const { where, what, data } = o;
  const nx = where.xsize;
  const ny = where.ysize;
  const rate = new Float32Array(nx * ny);
  const valid = new Uint8Array(nx * ny);
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (v === what.nodata || Number.isNaN(v)) continue;
    valid[i] = 1;
    if (v === what.undetect) continue;
    rate[i] = toRate(v * what.gain + what.offset);
  }
  const lons = [where.LL_lon, where.LR_lon, where.UL_lon, where.UR_lon];
  const lats = [where.LL_lat, where.LR_lat, where.UL_lat, where.UR_lat];
  return {
    time: o.ms + lead * 60000,
    lead,
    nx,
    ny,
    rate,
    valid,
    toGrid: odimToGrid(where),
    bounds: [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)],
  };
}

/** DWD RV: tar of 25 HDF5 files (analysis + 5 … 120 min); the data are mm per 5 min */
async function loadDwd(tmp) {
  const tar = join(tmp, 'rv.tar');
  const res = await fetch('https://opendata.dwd.de/weather/radar/composite/rv/composite_rv_LATEST.tar', { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} – DWD RV`);
  writeFileSync(tar, Buffer.from(await res.arrayBuffer()));
  execFileSync('tar', ['xf', tar, '-C', tmp]);
  const files = readdirSync(tmp).filter((f) => f.endsWith('-hd5')).sort();
  return files.map((name) => {
    const lead = Number(/_(\d{3})-hd5$/.exec(name)?.[1]);
    // every file carries the analysis time in `what`: valid time = analysis + lead
    return makeSource(readOdim(join(tmp, name), 'dataset1/data1'), (mm5) => Math.max(0, mm5 * 12), lead);
  });
}

// ---- tiles --------------------------------------------------------------------------------
const LATTICE = 8; // projection is evaluated every 8 pixels and interpolated in between

/** source grid position (fractional col/row) of every pixel of a tile */
function tileGeometry(z, x, y, toGrid) {
  const N = TILE / LATTICE;
  const lc = new Float32Array((N + 1) * (N + 1));
  const lr = new Float32Array((N + 1) * (N + 1));
  for (let j = 0; j <= N; j++) {
    const lat = tileLat(y + (j * LATTICE + 0.5) / TILE, z);
    for (let i = 0; i <= N; i++) {
      const lon = tileLon(x + (i * LATTICE + 0.5) / TILE, z);
      const [c, r] = toGrid(lon, lat);
      lc[j * (N + 1) + i] = c;
      lr[j * (N + 1) + i] = r;
    }
  }
  const gx = new Float32Array(TILE * TILE);
  const gy = new Float32Array(TILE * TILE);
  for (let py = 0; py < TILE; py++) {
    const j = Math.min(N - 1, Math.floor(py / LATTICE));
    const fy = py / LATTICE - j;
    for (let px = 0; px < TILE; px++) {
      const i = Math.min(N - 1, Math.floor(px / LATTICE));
      const fx = px / LATTICE - i;
      const a = j * (N + 1) + i;
      const b = a + 1;
      const c = a + N + 1;
      const d = c + 1;
      gx[py * TILE + px] = lc[a] * (1 - fx) * (1 - fy) + lc[b] * fx * (1 - fy) + lc[c] * (1 - fx) * fy + lc[d] * fx * fy;
      gy[py * TILE + px] = lr[a] * (1 - fx) * (1 - fy) + lr[b] * fx * (1 - fy) + lr[c] * (1 - fx) * fy + lr[d] * fx * fy;
    }
  }
  return { gx, gy };
}

// Catmull-Rom weights: bicubic sampling keeps the echoes round instead of diamond shaped
const cr = (t) => [(-t * t * t + 2 * t * t - t) / 2, (3 * t * t * t - 5 * t * t + 2) / 2, (-3 * t * t * t + 4 * t * t + t) / 2, (t * t * t - t * t) / 2];

/** one tile of one time step; pixels without a measurement stay NODATA */
function renderTile(src, geo) {
  const out = new Uint8Array(TILE * TILE).fill(NODATA);
  const { nx, ny, rate, valid } = src;
  const { gx, gy } = geo;
  for (let i = 0; i < out.length; i++) {
    const fx = gx[i];
    const fy = gy[i];
    const nc = Math.round(fx);
    const nr = Math.round(fy);
    if (nc < 0 || nr < 0 || nc >= nx || nr >= ny || !valid[nr * nx + nc]) continue;
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
        if (c >= 0 && c < nx) row += rate[r * nx + c] * wx[k];
      }
      v += row * wy[j];
    }
    out[i] = v >= 0.003 ? Math.min(249, Math.max(1, Math.round(Math.sqrt(v) * 25))) : 0;
  }
  return out;
}

// ---- main ---------------------------------------------------------------------------------
await h5wasm.ready;
const [w, s, e, n] = REGION.bounds;
const dir = join(OUT, REGION.id);
mkdirSync(dir, { recursive: true });

const steps = await loadDwd(mkdtempSync(join(tmpdir(), 'radar-')));
if (!steps.length) throw new Error('no DWD data');
const ids = steps.map((fr) => stamp(fr.time));
for (const id of ids) mkdirSync(join(dir, id), { recursive: true });

let count = 0;
for (let z = ZMIN; z <= ZMAX; z++) {
  for (let x = lonTile(w, z); x <= lonTile(e, z); x++) {
    for (let y = latTile(n, z); y <= latTile(s, z); y++) {
      const geo = tileGeometry(z, x, y, steps[0].toGrid); // same grid for every time step
      steps.forEach((fr, k) => {
        const d = join(dir, ids[k], String(z), String(x));
        mkdirSync(d, { recursive: true });
        writeFileSync(join(d, `${y}.png`), encodePng(TILE, TILE, renderTile(fr, geo)));
        count++;
      });
    }
  }
}

writeFileSync(
  join(OUT, 'manifest.json'),
  JSON.stringify({
    updated: new Date().toISOString(),
    encoding: 'sqrt25',
    nodata: NODATA,
    tileSize: TILE,
    regions: [
      {
        id: REGION.id,
        name: REGION.name,
        attribution: REGION.attribution,
        bounds: REGION.bounds,
        minzoom: ZMIN,
        maxzoom: ZMAX,
        frames: steps.map((fr, k) => ({ time: new Date(fr.time).toISOString(), lead: fr.lead, id: ids[k] })),
      },
    ],
  }),
);
console.log(`${REGION.id}: ${steps.length} steps, ${count} tiles`);
