import { addProtocol, LngLat, type Map as MlMap } from 'maplibre-gl';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import { TD_LAPSE_RATIO, type ModelSampler, type ModelVar } from '../api/model';
import { fmt, rampColor, TEMP_STOPS } from '../util';
import { windUnit, windNum, tempUnit, tempNum, pressureUnit, pressureNum, rainUnit, rainNum, snowUnit, snowVal } from '../units';

// ---------------------------------------------------------------------------
// Forecast fields rendered as raster tiles through a custom protocol: the grid is
// bilinearly interpolated per pixel at every zoom, MapLibre handles 2D/3D projection.

export type FieldId =
  | 'wind'
  | 'gusts'
  | 'temp'
  | 'feels'
  | 'humidity'
  | 'dewpoint'
  | 'precip'
  | 'cloud'
  | 'pressure'
  | 'snow'
  | 'cape'
  | 'precipmix'
  | 'snowfall';

type Rgba = [number, number, number, number];

export interface FieldDef {
  label: string;
  unit: string;
  variable: ModelVar;
  color(v: number): Rgba;
  legend: { stops: [number, string][]; ticks: number[]; gradient?: string };
  format(v: number): string;
  /** show wind particles automatically */
  particles?: boolean;
  /**
   * Cosmetic sub-grid structure for patchy fields: `warp` shifts the sample position by
   * fractal noise (fraction of the grid spacing), `texture` modulates the value. Only the
   * rendered image uses this – readouts stay on the plain interpolated value.
   */
  organic?: { warp: number; texture?: number; additive?: boolean };
  /** precipitation coloured as rain or snow depending on the 2 m temperature */
  phase?: 'mix' | 'snow-only';
  /** the ICON values are corrected per pixel with the terrain height (see renderTerrainTile) */
  terrain?: boolean;
  /** share of the temperature correction that applies to this field (default 1) */
  terrainScale?: number;
}

/** Below this 2 m temperature [°C] precipitation is drawn as snow. */
export const SNOW_BELOW = 1;

const WIND_STOPS: [number, string][] = [
  [0, '#3d2e8c'],
  [8, '#3462c9'],
  [18, '#2a9fc4'],
  [30, '#35b984'],
  [45, '#a9d34a'],
  [60, '#f2c23d'],
  [80, '#ec7a32'],
  [100, '#d83b3b'],
  [130, '#a3225c'],
  [170, '#e7b8e8'],
];
const HUMIDITY_STOPS: [number, string][] = [
  [0, '#8c4a1c'],
  [25, '#c98a3d'],
  [45, '#e8d6a0'],
  [65, '#8fd0c6'],
  [80, '#3d9ad1'],
  [100, '#1d4fa6'],
];
const PRECIP_STOPS: [number, string][] = [
  [0.1, '#9fd8ff'],
  [0.5, '#4fb0ff'],
  [1.5, '#2f6fe0'],
  [3, '#2bd46f'],
  [6, '#ffe14d'],
  [10, '#ff8c1a'],
  [20, '#e8384f'],
  [40, '#b03ad6'],
];
export const SNOWFALL_STOPS: [number, string][] = [
  [0.1, '#eef3ff'],
  [0.5, '#cfdcff'],
  [1.5, '#a9a2ff'],
  [3, '#c46bff'],
  [6, '#ff6bd6'],
];
export { PRECIP_STOPS };
const PRESSURE_STOPS: [number, string][] = [
  [960, '#5b2bd6'],
  [985, '#2f7fd8'],
  [1000, '#4fc3e8'],
  [1013, '#e6ebf2'],
  [1022, '#f6c945'],
  [1035, '#e0462f'],
  [1050, '#9e1a3a'],
];
const SNOW_STOPS: [number, string][] = [
  [0.01, '#d7ecff'],
  [0.1, '#9ccbff'],
  [0.3, '#5f8dff'],
  [0.7, '#7c5cff'],
  [1.5, '#c45cff'],
  [3, '#ffd1ff'],
];
const CAPE_STOPS: [number, string][] = [
  [100, '#4a6d8c'],
  [300, '#59c48a'],
  [700, '#e3e05a'],
  [1200, '#f2a23c'],
  [2000, '#e8573a'],
  [3000, '#b8264f'],
  [4500, '#e7b8e8'],
];

/**
 * Colour ramp. Below `min` the colour fades out smoothly (over min…3·min) and transparent
 * pixels keep the first stop's RGB, so GPU interpolation produces no dark fringes.
 */
const ramp = (stops: [number, string][], alpha = 190, min = -Infinity) => {
  const first = rampColor(stops, stops[0][0]);
  return (v: number): Rgba => {
    if (Number.isNaN(v)) return [first[0], first[1], first[2], 0];
    const [r, g, b] = rampColor(stops, v);
    if (!Number.isFinite(min)) return [r, g, b, alpha];
    const f = Math.max(0, Math.min(1, (v - min) / (2 * min)));
    return [r, g, b, alpha * f * f * (3 - 2 * f)];
  };
};
const num = (d = 0) => (v: number) => fmt.num(v, d);

export const FIELDS: Record<FieldId, FieldDef> = {
  wind: {
    label: 'Wind',
    get unit() { return windUnit(); },
    variable: 'wind_speed_10m',
    color: ramp(WIND_STOPS),
    legend: { stops: WIND_STOPS, ticks: [0, 30, 60, 100, 130] },
    format: windNum,
    particles: true,
  },
  gusts: {
    label: 'Windböen',
    get unit() { return windUnit(); },
    variable: 'wind_gusts_10m',
    color: ramp(WIND_STOPS),
    legend: { stops: WIND_STOPS, ticks: [0, 30, 60, 100, 130] },
    format: windNum,
    particles: true,
  },
  temp: {
    label: 'Temperatur',
    get unit() { return tempUnit(); },
    variable: 'temperature_2m',
    terrain: true,
    color: ramp(TEMP_STOPS, 185),
    legend: { stops: TEMP_STOPS, ticks: [-30, -15, 0, 15, 30, 40] },
    format: tempNum,
  },
  feels: {
    label: 'Gefühlte Temperatur',
    get unit() { return tempUnit(); },
    variable: 'apparent_temperature',
    color: ramp(TEMP_STOPS, 185),
    legend: { stops: TEMP_STOPS, ticks: [-30, -15, 0, 15, 30, 40] },
    format: tempNum,
  },
  humidity: {
    label: 'Luftfeuchtigkeit',
    unit: '%',
    variable: 'relative_humidity_2m',
    organic: { warp: 0.3 },
    color: ramp(HUMIDITY_STOPS, 175),
    legend: { stops: HUMIDITY_STOPS, ticks: [0, 25, 50, 75, 100] },
    format: num(),
  },
  dewpoint: {
    label: 'Taupunkt',
    get unit() { return tempUnit(); },
    variable: 'dew_point_2m',
    terrain: true,
    terrainScale: TD_LAPSE_RATIO,
    color: ramp(TEMP_STOPS, 185),
    legend: { stops: TEMP_STOPS, ticks: [-30, -15, 0, 15, 30, 40] },
    format: tempNum,
  },
  precip: {
    label: 'Niederschlag',
    get unit() { return rainUnit(); },
    variable: 'precipitation',
    organic: { warp: 0.5, texture: 0.6 },
    color: ramp(PRECIP_STOPS, 210, 0.08),
    legend: { stops: PRECIP_STOPS, ticks: [0.1, 3, 10, 20, 40] },
    format: rainNum,
  },
  cloud: {
    label: 'Bewölkung',
    unit: '%',
    variable: 'cloud_cover',
    organic: { warp: 0.5, texture: 28, additive: true },
    color: (v) => [255, 255, 255, Number.isNaN(v) ? 0 : Math.max(0, Math.min(1, (v - 8) / 92)) ** 1.25 * 225],
    legend: { stops: [[0, '#000'], [100, '#fff']], ticks: [0, 25, 50, 75, 100], gradient: 'linear-gradient(90deg, rgba(255,255,255,0), #fff)' },
    format: num(),
  },
  pressure: {
    label: 'Luftdruck',
    get unit() { return pressureUnit(); },
    variable: 'pressure_msl',
    color: ramp(PRESSURE_STOPS, 150),
    legend: { stops: PRESSURE_STOPS, ticks: [970, 990, 1013, 1030, 1045] },
    format: pressureNum,
  },
  snow: {
    label: 'Schneehöhe',
    get unit() { return snowUnit(); },
    variable: 'snow_depth',
    organic: { warp: 0.3, texture: 0.3 },
    color: ramp(SNOW_STOPS, 210, 0.01),
    legend: { stops: SNOW_STOPS, ticks: [0.01, 0.5, 1, 2, 3] },
    format: (v) => fmt.num(snowVal(v * 100), snowUnit() === 'in' ? 1 : 0),
  },
  precipmix: {
    label: 'Niederschlag',
    get unit() { return rainUnit(); },
    variable: 'precipitation',
    organic: { warp: 0.5, texture: 0.6 },
    phase: 'mix',
    color: ramp(PRECIP_STOPS, 215, 0.08),
    legend: { stops: PRECIP_STOPS, ticks: [0.1, 3, 10, 20, 40] },
    format: rainNum,
  },
  snowfall: {
    label: 'Schneefall',
    get unit() { return rainUnit(); },
    variable: 'precipitation',
    organic: { warp: 0.5, texture: 0.6 },
    phase: 'snow-only',
    color: ramp(SNOWFALL_STOPS, 225, 0.08),
    legend: { stops: SNOWFALL_STOPS, ticks: [0.1, 1.5, 3, 6] },
    format: rainNum,
  },
  cape: {
    label: 'Gewitterenergie (CAPE)',
    unit: 'J/kg',
    variable: 'cape',
    organic: { warp: 0.4, texture: 0.35 },
    color: ramp(CAPE_STOPS, 190, 100),
    legend: { stops: CAPE_STOPS, ticks: [100, 1000, 2000, 3000, 4500] },
    format: num(),
  },
};

// The protocol reads the active sampler; the tile URL carries a version so MapLibre
// re-requests tiles whenever field, time step or detail grid change.
// Several maps can render fields at once; each registers its sampler under a key that
// appears in the tile URL (wxfield://<field>/<key>~<version>/…, key defaults to 'map').
const samplers = new Map<string, ModelSampler>();
let protocolRegistered = false;

export function setActiveSampler(s: ModelSampler | null, key = 'map') {
  if (s) samplers.set(key, s);
  else samplers.delete(key);
}

const snowColor = ramp(SNOWFALL_STOPS, 225, 0.08);

function tile2lon(x: number, z: number) {
  return (x / 2 ** z) * 360 - 180;
}
function tile2lat(y: number, z: number) {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
}

// Deterministic 3D value noise on the unit sphere – seamless across tiles, the antimeridian
// and the poles.
function hash3(x: number, y: number, z: number) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) & 0xffff) / 32767.5 - 1;
}
function vnoise(x: number, y: number, z: number) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = x - xi, fy = y - yi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  return l(
    l(l(hash3(xi, yi, zi), hash3(xi + 1, yi, zi), u), l(hash3(xi, yi + 1, zi), hash3(xi + 1, yi + 1, zi), u), v),
    l(l(hash3(xi, yi, zi + 1), hash3(xi + 1, yi, zi + 1), u), l(hash3(xi, yi + 1, zi + 1), hash3(xi + 1, yi + 1, zi + 1), u), v),
    w,
  );
}
/** fractal noise, roughly -1…1; `f` = base frequency in cycles per radian */
function fbm(lat: number, lon: number, f: number, octaves: number, seed: number) {
  const la = (lat * Math.PI) / 180, lo = (lon * Math.PI) / 180;
  const c = Math.cos(la);
  let x = c * Math.cos(lo) * f + seed, y = c * Math.sin(lo) * f, z = Math.sin(la) * f;
  let sum = 0, amp = 0.55;
  for (let o = 0; o < octaves; o++) {
    sum += amp * vnoise(x, y, z);
    x *= 2.03; y *= 2.03; z *= 2.03;
    amp *= 0.5;
  }
  return sum * 1.6;
}

function organicSample(def: FieldDef, s: ModelSampler, lat: number, lon: number): number {
  const o = def.organic!;
  const cell = s.cellDeg(lat, lon);
  // noise wavelength follows the grid spacing: ~1.5 cells for the base octave
  const f = 180 / Math.PI / (cell * 1.5);
  const a = o.warp * cell;
  const wy = fbm(lat, lon, f, 5, 11.3) * a;
  const wx = (fbm(lat, lon, f, 5, 47.9) * a) / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  let v = s.sample(def.variable, Math.max(-89.9, Math.min(89.9, lat + wy)), lon + wx);
  if (o.texture && !Number.isNaN(v)) {
    const n = fbm(lat, lon, f * 3, 4, 91.7);
    v = o.additive ? Math.max(0, Math.min(100, v + n * o.texture * Math.min(1, v / 25))) : Math.max(0, v * (1 + n * o.texture));
  }
  return v;
}

/**
 * Tile with the terrain correction: the model temperature is sampled on a coarse lattice (as before) and
 * interpolated bilinearly, the terrain heights (about 5 km) are applied per pixel, so valleys and ridges
 * show up much finer than the 13 km model. Lattice nodes lie on the tile edge, so neighbouring tiles agree.
 */
async function renderTerrainTile(def: FieldDef, s: ModelSampler, z: number, x: number, y: number): Promise<ImageBitmap> {
  const scale = def.terrainScale ?? 1;
  const N = z <= 3 ? 512 : 256;
  const Nc = z <= 2 ? 64 : 128;
  const nodes = new Float32Array((Nc + 1) * (Nc + 1));
  for (let j = 0; j <= Nc; j++) {
    const lat = tile2lat(y + j / Nc, z);
    for (let i = 0; i <= Nc; i++) nodes[j * (Nc + 1) + i] = s.sample(def.variable, lat, tile2lon(x + i / Nc, z), false);
  }
  const canvas = new OffscreenCanvas(N, N);
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(N, N);
  const lons = new Float64Array(N);
  for (let px = 0; px < N; px++) lons[px] = tile2lon(x + (px + 0.5) / N, z);
  for (let py = 0; py < N; py++) {
    const lat = tile2lat(y + (py + 0.5) / N, z);
    const fj = ((py + 0.5) / N) * Nc;
    const j = Math.min(Nc - 1, Math.floor(fj));
    const wy = fj - j;
    for (let px = 0; px < N; px++) {
      const fi = ((px + 0.5) / N) * Nc;
      const i = Math.min(Nc - 1, Math.floor(fi));
      const wx = fi - i;
      const o = j * (Nc + 1) + i;
      const base = (nodes[o] * (1 - wx) + nodes[o + 1] * wx) * (1 - wy) + (nodes[o + Nc + 1] * (1 - wx) + nodes[o + Nc + 2] * wx) * wy;
      const [r, g, b, a] = def.color(base + s.terrainDelta(lat, lons[px]) * scale);
      const k = (py * N + px) * 4;
      img.data[k] = r;
      img.data[k + 1] = g;
      img.data[k + 2] = b;
      img.data[k + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  return createImageBitmap(canvas);
}

export function registerFieldProtocol() {
  if (protocolRegistered) return;
  protocolRegistered = true;
  // URL format: wxfield://<field>/<version>/<z>/<x>/<y>
  addProtocol('wxfield', async (params) => {
    const m = /^wxfield:\/\/(\w+)\/(?:(\w+)~)?[\w.-]+\/(\d+)\/(\d+)\/(\d+)/.exec(params.url);
    const def = m ? FIELDS[m[1] as FieldId] : undefined;
    const sampler = m ? samplers.get(m[2] ?? 'map') : undefined;
    if (!m || !def || !sampler) throw new Error('field not ready');
    const z = +m[3];
    const x = +m[4];
    const y = +m[5];
    // ICON values carry their own structure: the noise that fakes detail on the coarse Open-Meteo grid is skipped
    const wxData = sampler.wxActive(def.variable);
    if (def.terrain && sampler.hasTerrain(def.variable)) return { data: await renderTerrainTile(def, sampler, z, x, y) };
    // The fields are smooth, so render a small image and let the GPU interpolate it up
    // ('raster-resampling: linear'): 64 px per tile when zoomed out, 128 px when zoomed in.
    const N = z <= 4 ? 64 : 128;
    const canvas = new OffscreenCanvas(N, N);
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(N, N);
    for (let py = 0; py < N; py++) {
      const lat = tile2lat(y + (py + 0.5) / N, z);
      for (let px = 0; px < N; px++) {
        const lon = tile2lon(x + (px + 0.5) / N, z);
        const v = def.organic && !wxData ? organicSample(def, sampler, lat, lon) : sampler.sample(def.variable, lat, lon);
        let [r, g, b, a] = def.color(v);
        if (def.phase) {
          const snow = sampler.sample('temperature_2m', lat, lon) < SNOW_BELOW;
          if (snow) [r, g, b, a] = snowColor(v);
          else if (def.phase === 'snow-only') a = 0;
        }
        const o = (py * N + px) * 4;
        img.data[o] = r;
        img.data[o + 1] = g;
        img.data[o + 2] = b;
        img.data[o + 3] = a;
      }
    }
    ctx.putImageData(img, 0, 0);
    return { data: await createImageBitmap(canvas) };
  });
}

// ---------------------------------------------------------------------------
// Isobars (marching squares on a 2° lattice) plus H/T markers for highs and lows.

export function isobars(s: ModelSampler, interval = 4): FeatureCollection<LineString | Point> {
  const STEP = 2;
  const lats: number[] = [];
  const lons: number[] = [];
  for (let lat = 80; lat >= -80; lat -= STEP) lats.push(lat);
  for (let lon = -180; lon <= 180; lon += STEP) lons.push(lon);
  const ny = lats.length;
  const nx = lons.length;
  const P = new Float32Array(nx * ny);
  let min = Infinity;
  let max = -Infinity;
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const v = s.sample('pressure_msl', lats[j], lons[i]);
      P[j * nx + i] = v;
      if (v < min) min = v;
      if (v > max) max = v;
    }

  const features: Feature<LineString | Point>[] = [];
  // Edge ids: horizontal edge h(j,i) between (j,i)-(j,i+1), vertical v(j,i) between (j,i)-(j+1,i)
  const edgePoint = (id: number, L: number): [number, number] => {
    const horizontal = id % 2 === 0;
    const k = id >> 1;
    const j = Math.floor(k / nx);
    const i = k % nx;
    const a = P[j * nx + i];
    const b = horizontal ? P[j * nx + i + 1] : P[(j + 1) * nx + i];
    const f = (L - a) / (b - a || 1e-6);
    return horizontal ? [lons[i] + f * STEP, lats[j]] : [lons[i], lats[j] - f * STEP];
  };
  const H = (j: number, i: number) => ((j * nx + i) << 1) | 0;
  const V = (j: number, i: number) => ((j * nx + i) << 1) | 1;

  for (let L = Math.ceil(min / interval) * interval; L <= max; L += interval) {
    const segs: [number, number][] = [];
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = P[j * nx + i];
        const b = P[j * nx + i + 1];
        const c = P[(j + 1) * nx + i + 1];
        const d = P[(j + 1) * nx + i];
        const idx = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (d > L ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        const top = H(j, i);
        const bottom = H(j + 1, i);
        const left = V(j, i);
        const right = V(j, i + 1);
        switch (idx) {
          case 1: case 14: segs.push([left, bottom]); break;
          case 2: case 13: segs.push([bottom, right]); break;
          case 3: case 12: segs.push([left, right]); break;
          case 4: case 11: segs.push([top, right]); break;
          case 6: case 9: segs.push([top, bottom]); break;
          case 7: case 8: segs.push([left, top]); break;
          case 5: segs.push([left, top], [bottom, right]); break;
          case 10: segs.push([top, right], [left, bottom]); break;
        }
      }
    }
    // Join segments into polylines via shared edge ids
    const byEdge = new Map<number, number[]>();
    segs.forEach(([e1, e2], k) => {
      for (const e of [e1, e2]) {
        const list = byEdge.get(e);
        if (list) list.push(k);
        else byEdge.set(e, [k]);
      }
    });
    const used = new Uint8Array(segs.length);
    for (let k = 0; k < segs.length; k++) {
      if (used[k]) continue;
      used[k] = 1;
      const chain = [segs[k][0], segs[k][1]];
      for (const forward of [true, false]) {
        for (;;) {
          const end = forward ? chain[chain.length - 1] : chain[0];
          const nextSeg = (byEdge.get(end) ?? []).find((n) => !used[n]);
          if (nextSeg === undefined) break;
          used[nextSeg] = 1;
          const [e1, e2] = segs[nextSeg];
          const other = e1 === end ? e2 : e1;
          if (forward) chain.push(other);
          else chain.unshift(other);
        }
      }
      if (chain.length < 4) continue;
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: chain.map((e) => edgePoint(e, L)) },
        properties: { p: L, major: L % 20 === 0 },
      });
    }
  }

  // Highs and lows on a coarser 6° lattice
  const C = 3;
  for (let j = C; j < ny - C; j += 1) {
    for (let i = 0; i < nx - 1; i += 1) {
      const v = P[j * nx + i];
      if (Number.isNaN(v)) continue;
      let isMax = v > 1012;
      let isMin = v < 1008;
      for (let dj = -C; dj <= C && (isMax || isMin); dj++)
        for (let di = -C; di <= C; di++) {
          if (!dj && !di) continue;
          const ii = (i + di + (nx - 1)) % (nx - 1);
          const w = P[(j + dj) * nx + ii];
          if (w >= v) isMax = false;
          if (w <= v) isMin = false;
        }
      if (isMax || isMin) {
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lons[i], lats[j]] },
          properties: { label: isMax ? 'H' : 'T', p: Math.round(v), kind: isMax ? 'high' : 'low' },
        });
      }
    }
  }
  return { type: 'FeatureCollection', features };
}

// ---------------------------------------------------------------------------
// Animated wind particles drawn on a 2D canvas above the map (screen space, so trails
// stay crisp at any zoom). Occluded particles on the far side of the globe are skipped.

interface Particle {
  lon: number;
  lat: number;
  age: number;
  x: number;
  y: number;
  visible: boolean;
}

/** Far side of the globe: MapLibre's own horizon test when available, else a great-circle estimate. */
export function occlusionTest(map: MlMap): (ll: LngLat) => boolean {
  const t = (map as unknown as { _camera?: { transform?: { isLocationOccluded?: (l: LngLat) => boolean } } })._camera
    ?.transform;
  if (t?.isLocationOccluded) return (ll) => t.isLocationOccluded!(ll);
  if (map.getProjection?.()?.type !== 'globe') return () => false;
  const c = map.getCenter();
  const rad = Math.PI / 180;
  const sinC = Math.sin(c.lat * rad);
  const cosC = Math.cos(c.lat * rad);
  // fallback: great-circle angle from the view centre > ~85°
  return (ll) => sinC * Math.sin(ll.lat * rad) + cosC * Math.cos(ll.lat * rad) * Math.cos((ll.lng - c.lng) * rad) < 0.09;
}

export class WindParticles {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private raf = 0;
  private running = false;
  private moving = false;
  private lastFrame = 0;
  private readonly onMoveStart = () => {
    this.moving = true;
    this.clear();
  };
  private readonly onMoveEnd = () => {
    this.moving = false;
    this.reseedAll();
  };
  private readonly onResize = () => this.resize();

  constructor(
    private map: MlMap,
    private getSampler: () => ModelSampler | null,
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'wind-canvas';
    map.getContainer().appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.canvas.hidden = false;
    this.resize();
    this.map.on('movestart', this.onMoveStart);
    this.map.on('moveend', this.onMoveEnd);
    this.map.on('resize', this.onResize);
    this.reseedAll();
    const loop = (t: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      if (t - this.lastFrame < 30) return; // ~30 fps is plenty
      this.lastFrame = t;
      if (!this.moving) this.step();
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.map.off('movestart', this.onMoveStart);
    this.map.off('moveend', this.onMoveEnd);
    this.map.off('resize', this.onResize);
    this.clear();
    this.canvas.hidden = true;
  }

  private resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const { clientWidth: w, clientHeight: h } = this.map.getContainer();
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round(Math.min(4000, Math.max(800, (w * h) / 450)));
    this.particles = Array.from({ length: count }, () => ({ lon: 0, lat: 0, age: 0, x: 0, y: 0, visible: false }));
    this.reseedAll();
  }

  private clear() {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  private reseedAll() {
    this.clear();
    for (const p of this.particles) this.seed(p, true);
  }

  private seed(p: Particle, randomAge = false) {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    for (let tries = 0; tries < 6; tries++) {
      const sx = Math.random() * w;
      const sy = Math.random() * h;
      const ll = this.map.unproject([sx, sy]);
      if (!Number.isFinite(ll.lat) || Math.abs(ll.lat) > 84) continue;
      const pt = this.map.project(ll);
      if (Math.abs(pt.x - sx) > 2 || Math.abs(pt.y - sy) > 2) continue; // off-globe
      p.lon = ll.lng;
      p.lat = ll.lat;
      p.x = pt.x;
      p.y = pt.y;
      p.visible = true;
      p.age = randomAge ? Math.floor(Math.random() * 80) : 0;
      return;
    }
    p.visible = false;
    p.age = 70 + Math.floor(Math.random() * 10);
  }

  private step() {
    const g = this.getSampler();
    if (!g) return;
    const ctx = this.ctx;
    // Fade previous trails
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';

    const zoom = this.map.getZoom();
    const degPerMs = (0.11 * 360) / (512 * 2 ** zoom); // degrees per frame per (m/s)
    const occluded = occlusionTest(this.map);
    const buckets: Path2D[] = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
    const ll = new LngLat(0, 0);

    for (const p of this.particles) {
      if (++p.age > 90 || !p.visible) {
        this.seed(p);
        continue;
      }
      const u = g.sample('u', p.lat, p.lon);
      const v = g.sample('v', p.lat, p.lon);
      const speed = Math.hypot(u, v);
      if (Number.isNaN(speed)) {
        p.visible = false;
        continue;
      }
      const cosLat = Math.max(0.15, Math.cos((p.lat * Math.PI) / 180));
      p.lon += (u * degPerMs) / cosLat;
      p.lat += v * degPerMs;
      if (Math.abs(p.lat) > 84) {
        p.visible = false;
        continue;
      }
      ll.lng = p.lon;
      ll.lat = p.lat;
      if (occluded(ll)) {
        p.visible = false;
        continue;
      }
      const pt = this.map.project(ll);
      if (Math.abs(pt.x - p.x) < 40 && Math.abs(pt.y - p.y) < 40) {
        const b = speed < 4 ? 0 : speed < 9 ? 1 : speed < 15 ? 2 : 3;
        buckets[b].moveTo(p.x, p.y);
        buckets[b].lineTo(pt.x, pt.y);
      }
      p.x = pt.x;
      p.y = pt.y;
    }
    const colors = ['rgba(255,255,255,0.35)', 'rgba(255,255,255,0.6)', 'rgba(255,240,200,0.85)', 'rgba(255,190,120,0.95)'];
    buckets.forEach((path, i) => {
      ctx.strokeStyle = colors[i];
      ctx.stroke(path);
    });
  }
}

// ---------------------------------------------------------------------------
// Day/night terminator

const NIGHT_SIZE = 1024;
const NIGHT_Z = 2;
let nightTiles: Promise<ImageData> | null = null;

/** Black Marble at z2 stitched into one mercator image (loaded once). */
function loadNightTiles(urlFor: (z: number, x: number, y: number) => string): Promise<ImageData> {
  nightTiles ??= (async () => {
    const n = 1 << NIGHT_Z;
    const tile = NIGHT_SIZE / n;
    const cv = document.createElement('canvas');
    cv.width = cv.height = NIGHT_SIZE;
    const ctx = cv.getContext('2d', { willReadFrequently: true })!;
    await Promise.all(
      Array.from({ length: n * n }, (_, i) => {
        const x = i % n;
        const y = Math.floor(i / n);
        return new Promise<void>((res) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            ctx.drawImage(img, x * tile, y * tile, tile, tile);
            res();
          };
          img.onerror = () => res();
          img.src = urlFor(NIGHT_Z, x, y);
        });
      }),
    );
    return ctx.getImageData(0, 0, NIGHT_SIZE, NIGHT_SIZE);
  })();
  return nightTiles;
}

/**
 * Night side of the earth: the Black Marble image whose alpha follows the sun's elevation, so the
 * night map shows only in the dark half and fades out smoothly across the terminator.
 * Returns a PNG data URL for an image source covering NIGHT_COORDS.
 */
export async function nightImage(urlFor: (z: number, x: number, y: number) => string, date = new Date()): Promise<string> {
  const src = await loadNightTiles(urlFor);
  const rad = Math.PI / 180;
  const dayOfYear = (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86400000;
  // Approximate solar declination & equation of time
  const g = (360 / 365.25) * (dayOfYear + date.getUTCHours() / 24) * rad;
  const decl =
    (0.396372 - 22.91327 * Math.cos(g) + 4.02543 * Math.sin(g) - 0.387205 * Math.cos(2 * g) + 0.051967 * Math.sin(2 * g) - 0.154527 * Math.cos(3 * g) + 0.084798 * Math.sin(3 * g)) *
    rad;
  const eqTime = 0.004297 + 0.107029 * Math.cos(g) - 1.837877 * Math.sin(g) - 0.837378 * Math.cos(2 * g) - 2.340475 * Math.sin(2 * g); // minutes
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const subLon = -((utcMinutes + eqTime - 720) / 4); // where the sun is overhead

  const sinD = Math.sin(decl);
  const cosD = Math.cos(decl);
  const out = new ImageData(new Uint8ClampedArray(src.data), NIGHT_SIZE, NIGHT_SIZE);
  const d = out.data;
  const cosHa = new Float32Array(NIGHT_SIZE);
  for (let x = 0; x < NIGHT_SIZE; x++) cosHa[x] = Math.cos(((x + 0.5) / NIGHT_SIZE) * 360 * rad - Math.PI - subLon * rad);
  for (let y = 0; y < NIGHT_SIZE; y++) {
    const lat = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 0.5)) / NIGHT_SIZE)));
    const a = Math.sin(lat) * sinD;
    const b = Math.cos(lat) * cosD;
    for (let x = 0; x < NIGHT_SIZE; x++) {
      const elev = a + b * cosHa[x]; // sin(sun elevation)
      // Day (>= +0.05) → 0, deep twilight (<= -0.25, about -14°) → 1.
      const t = Math.min(1, Math.max(0, (0.05 - elev) / 0.3));
      d[(y * NIGHT_SIZE + x) * 4 + 3] = Math.round(src.data[(y * NIGHT_SIZE + x) * 4 + 3] * t * t * (3 - 2 * t));
    }
  }
  const cv = document.createElement('canvas');
  cv.width = cv.height = NIGHT_SIZE;
  cv.getContext('2d')!.putImageData(out, 0, 0);
  return cv.toDataURL('image/png');
}
