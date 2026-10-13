import { omFetch, OpenMeteoLimitError, omPriority } from './omlimit';

// Gridded forecast data for the map layers, built from Open-Meteo multi-location requests.
// A coarse global grid is always loaded; when zoomed in, a finer grid for the viewport is
// fetched and blended in seamlessly.

/** Fetched variables – kept at 10 so each location costs exactly one API call. */
export const MODEL_VARS = [
  'temperature_2m',
  'relative_humidity_2m',
  'precipitation',
  'cloud_cover',
  'pressure_msl',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'snow_depth',
  'cape',
] as const;
/** Derived in the browser: wind vector, dew point and apparent temperature. */
export type ModelVar = (typeof MODEL_VARS)[number] | 'u' | 'v' | 'dew_point_2m' | 'apparent_temperature';
const DERIVED = ['u', 'v', 'dew_point_2m', 'apparent_temperature'] as const;

export interface ModelGrid {
  /** latitude of the first (northernmost) row */
  lat0: number;
  /** longitude of the first (westernmost) column */
  lon0: number;
  /** grid spacing in degrees (longitude / latitude) */
  dx: number;
  dy: number;
  nx: number;
  ny: number;
  /** global grids wrap around in longitude */
  wrap: boolean;
  /** epoch ms of each time step */
  times: number[];
  /** layout: [(t * ny + y) * nx + x] */
  data: Record<ModelVar, Float32Array>;
}

export { OpenMeteoLimitError as ModelLimitError };

const FORECAST_DAYS = 5;

type HourlyRow = { hourly: Record<string, (number | null)[]> & { time: string[] } };

async function fetchPoints(points: [number, number][]): Promise<HourlyRow[]> {
  const BATCH = 100;
  const out: HourlyRow[] = [];
  for (let i = 0; i < points.length; i += BATCH) {
    const chunk = points.slice(i, i + BATCH);
    const q = new URLSearchParams({
      latitude: chunk.map((p) => p[0].toFixed(2)).join(','),
      longitude: chunk.map((p) => p[1].toFixed(2)).join(','),
      hourly: MODEL_VARS.join(','),
      forecast_days: String(FORECAST_DAYS),
      wind_speed_unit: 'kmh',
      timezone: 'GMT',
    });
    const json = await omFetch<HourlyRow | HourlyRow[]>(`https://api.open-meteo.com/v1/forecast?${q}`, chunk.length);
    out.push(...(Array.isArray(json) ? json : [json]));
  }
  return out;
}

/** Magnus formula */
function dewPoint(t: number, rh: number) {
  const g = Math.log(Math.max(rh, 1) / 100) + (17.62 * t) / (243.12 + t);
  return (243.12 * g) / (17.62 - g);
}

/** Apparent temperature (Steadman / Australian BoM), wind in m/s */
function apparent(t: number, rh: number, ws: number) {
  const e = (rh / 100) * 6.105 * Math.exp((17.27 * t) / (237.7 + t));
  return t + 0.33 * e - 0.7 * ws - 4.0;
}

function derive(data: Record<ModelVar, Float32Array>) {
  const len = data.temperature_2m.length;
  for (const k of DERIVED) data[k] = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const t = data.temperature_2m[i];
    const rh = data.relative_humidity_2m[i];
    const spd = data.wind_speed_10m[i] / 3.6;
    const dir = (data.wind_direction_10m[i] * Math.PI) / 180;
    // direction is where the wind comes FROM
    data.u[i] = -spd * Math.sin(dir);
    data.v[i] = -spd * Math.cos(dir);
    data.dew_point_2m[i] = dewPoint(t, rh);
    data.apparent_temperature[i] = apparent(t, rh, spd);
  }
}

async function fetchGrid(lat0: number, lon0: number, dx: number, dy: number, nx: number, ny: number, wrap: boolean): Promise<ModelGrid> {
  const points: [number, number][] = [];
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) points.push([lat0 - y * dy, lon0 + x * dx]);
  const rows = await fetchPoints(points);
  // hourly data, thinned to 3-hourly steps (plenty for the map, a third of the memory)
  const allTimes = rows[0].hourly.time.map((t) => Date.parse(`${t}Z`));
  const keep = allTimes.map((_, i) => i).filter((i) => i % 3 === 0);
  const times = keep.map((i) => allTimes[i]);
  const nt = times.length;
  const n = nx * ny;
  const data = {} as Record<ModelVar, Float32Array>;
  for (const v of MODEL_VARS) data[v] = new Float32Array(nt * n);
  rows.forEach((row, p) => {
    const h = row.hourly;
    for (const v of MODEL_VARS) {
      const src = h[v] ?? [];
      const dst = data[v];
      keep.forEach((src_i, t) => {
        const val = src[src_i];
        dst[t * n + p] = val == null ? NaN : val;
      });
    }
  });
  derive(data);
  return { lat0, lon0, dx, dy, nx, ny, wrap, times, data };
}

// ---------------------------------------------------------------------------
// Global grid (15° × 10°, 408 points = 408 API calls) – cached in memory and localStorage for 1 h.

const CACHE_KEY = 'wg.model.v3';
const CACHE_MS = 60 * 60 * 1000;
let globalGrid: ModelGrid | null = null;
let globalAt = 0;
let globalPromise: Promise<ModelGrid> | null = null;

export function getGlobalModel(): Promise<ModelGrid> {
  if (globalGrid && Date.now() - globalAt < CACHE_MS) return Promise.resolve(globalGrid);
  const cached = readCache();
  if (cached) {
    globalGrid = cached.grid;
    globalAt = cached.at;
    return Promise.resolve(cached.grid);
  }
  globalPromise ??= omPriority(() => fetchGrid(80, -180, 15, 10, 24, 17, true))
    .then((g) => {
      globalGrid = g;
      globalAt = Date.now();
      writeCache(g);
      return g;
    })
    .finally(() => {
      globalPromise = null;
    });
  return globalPromise;
}

function toB64(a: Float32Array) {
  const bytes = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromB64(s: string) {
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Float32Array(bytes.buffer);
}

function writeCache(g: ModelGrid) {
  try {
    localStorage.removeItem('wg.cache.grid'); // older caches
    localStorage.removeItem('wg.model.v2');
    const data: Record<string, string> = {};
    for (const [k, v] of Object.entries(g.data)) if (!(DERIVED as readonly string[]).includes(k)) data[k] = toB64(v);
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), g: { ...g, data } }));
  } catch {
    /* quota exceeded – memory cache only */
  }
}

function readCache(): { at: number; grid: ModelGrid } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { at, g } = JSON.parse(raw) as { at: number; g: Omit<ModelGrid, 'data'> & { data: Record<string, string> } };
    if (Date.now() - at > CACHE_MS) return null;
    const data = {} as Record<ModelVar, Float32Array>;
    for (const [k, v] of Object.entries(g.data)) data[k as ModelVar] = fromB64(v);
    derive(data);
    return { at, grid: { ...g, data } };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Detail grid for the current viewport.

// coarser than 2.5° would barely improve on the global grid but still cost ~100 calls
const NICE_STEPS = [0.25, 0.5, 1, 2, 2.5];
const MAX_DETAIL_POINTS = 100;
const detailCache = new Map<string, Promise<ModelGrid>>();

export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

/** Returns null when the global grid is already fine enough for this view. */
export function detailRequest(b: Bounds): { key: string; lat0: number; lon0: number; step: number; nx: number; ny: number } | null {
  const padX = (b.east - b.west) * 0.25;
  const padY = (b.north - b.south) * 0.25;
  let west = b.west - padX;
  let east = b.east + padX;
  const south = Math.max(-80, b.south - padY);
  const north = Math.min(80, b.north + padY);
  if (east - west > 200 || north <= south) return null;
  west = Math.max(-180, west);
  east = Math.min(180, east);
  const area = (east - west) * (north - south);
  const raw = Math.sqrt(area / MAX_DETAIL_POINTS);
  const step = NICE_STEPS.find((s) => s >= raw);
  if (!step) return null;
  const lon0 = Math.floor(west / step) * step;
  const lat0 = Math.ceil(north / step) * step;
  const nx = Math.round((Math.ceil(east / step) * step - lon0) / step) + 1;
  const ny = Math.round((lat0 - Math.floor(south / step) * step) / step) + 1;
  if (nx < 3 || ny < 3) return null;
  return { key: `${step}:${lon0}:${lat0}:${nx}:${ny}`, lat0, lon0, step, nx, ny };
}

export function getDetailModel(req: NonNullable<ReturnType<typeof detailRequest>>): Promise<ModelGrid> {
  let p = detailCache.get(req.key);
  if (!p) {
    p = fetchGrid(req.lat0, req.lon0, req.step, req.step, req.nx, req.ny, false);
    p.catch(() => detailCache.delete(req.key));
    detailCache.set(req.key, p);
    if (detailCache.size > 8) detailCache.delete(detailCache.keys().next().value!);
  }
  return p;
}

// ---------------------------------------------------------------------------
// Sampling

function bilinear(g: ModelGrid, arr: Float32Array, t: number, lat: number, lon: number): number {
  let x = (lon - g.lon0) / g.dx;
  let y = (g.lat0 - lat) / g.dy;
  if (g.wrap) {
    x = ((x % g.nx) + g.nx) % g.nx;
    y = Math.max(0, Math.min(g.ny - 1, y));
  }
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = g.wrap ? (x0 + 1) % g.nx : Math.min(g.nx - 1, x0 + 1);
  const y1 = Math.min(g.ny - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;
  const o = t * g.nx * g.ny;
  const a = arr[o + y0 * g.nx + x0];
  const b = arr[o + y0 * g.nx + x1];
  const c = arr[o + y1 * g.nx + x0];
  const d = arr[o + y1 * g.nx + x1];
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}

/** Uniform cubic B-spline weights: C2-smooth, no overshoot – no diamond/box artefacts on coarse grids. */
function bspline(t: number, w: Float64Array) {
  const t2 = t * t;
  const t3 = t2 * t;
  const u = 1 - t;
  w[0] = (u * u * u) / 6;
  w[1] = (3 * t3 - 6 * t2 + 4) / 6;
  w[2] = (-3 * t3 + 3 * t2 + 3 * t + 1) / 6;
  w[3] = t3 / 6;
}
const WX = new Float64Array(4);
const WY = new Float64Array(4);

function bicubic(g: ModelGrid, arr: Float32Array, t: number, lat: number, lon: number): number {
  let x = (lon - g.lon0) / g.dx;
  const y = Math.max(0, Math.min(g.ny - 1, (g.lat0 - lat) / g.dy));
  if (g.wrap) x = ((x % g.nx) + g.nx) % g.nx;
  else x = Math.max(0, Math.min(g.nx - 1, x));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  bspline(x - x0, WX);
  bspline(y - y0, WY);
  const o = t * g.nx * g.ny;
  let sum = 0;
  for (let j = 0; j < 4; j++) {
    const yy = Math.max(0, Math.min(g.ny - 1, y0 + j - 1));
    let row = 0;
    for (let i = 0; i < 4; i++) {
      let xx = x0 + i - 1;
      xx = g.wrap ? (xx + g.nx) % g.nx : Math.max(0, Math.min(g.nx - 1, xx));
      row += WX[i] * arr[o + yy * g.nx + xx];
    }
    sum += WY[j] * row;
  }
  return sum;
}

/**
 * Skewed fields (lots of zeros, rare large values) are interpolated in a compressed space,
 * otherwise a single large grid value dominates its whole cell and edges hug the grid lines.
 */
const TRANSFORMS: Partial<Record<ModelVar, [(x: number) => number, (y: number) => number]>> = {
  precipitation: [(x) => Math.log1p(Math.max(0, x) * 10), (y) => Math.max(0, Math.expm1(y) / 10)],
  snow_depth: [(x) => Math.log1p(Math.max(0, x) * 100), (y) => Math.max(0, Math.expm1(y) / 100)],
  cape: [(x) => Math.sqrt(Math.max(0, x)), (y) => Math.max(0, y) ** 2],
};
const transformed = new WeakMap<Float32Array, Float32Array>();
function fieldArray(g: ModelGrid, v: ModelVar): Float32Array {
  const src = g.data[v];
  const tf = TRANSFORMS[v];
  if (!tf) return src;
  let out = transformed.get(src);
  if (!out) {
    out = new Float32Array(src.length);
    for (let i = 0; i < src.length; i++) out[i] = tf[0](src[i]);
    transformed.set(src, out);
  }
  return out;
}

function smooth(g: ModelGrid, v: ModelVar, t: number, lat: number, lon: number): number {
  const arr = fieldArray(g, v);
  let r = bicubic(g, arr, t, lat, lon);
  if (Number.isNaN(r)) r = bilinear(g, arr, t, lat, lon); // NaN neighbour (e.g. no data over sea)
  return r;
}

/** Combined sampler: detail grid where available (feathered edges), global grid elsewhere. */
export class ModelSampler {
  constructor(
    readonly global: ModelGrid,
    readonly detail: ModelGrid | null,
    /** time index into global.times */
    readonly t: number,
  ) {}

  private detailT = -1;

  get time(): number {
    return this.global.times[this.t];
  }

  /** Weight of the detail grid at this point (0 outside, 1 well inside). */
  private detailWeight(lat: number, lon: number): number {
    const d = this.detail;
    if (!d) return 0;
    const x = (lon - d.lon0) / d.dx;
    const y = (d.lat0 - lat) / d.dy;
    if (x < 0 || y < 0 || x > d.nx - 1 || y > d.ny - 1) return 0;
    const edge = Math.min(x, y, d.nx - 1 - x, d.ny - 1 - y);
    // wide feather so the two resolutions blend without a visible frame
    const feather = Math.max(1.5, 0.25 * Math.min(d.nx - 1, d.ny - 1));
    const f = Math.min(1, edge / feather);
    return f * f * (3 - 2 * f);
  }

  /** Effective grid spacing [deg] at this point – used to scale cosmetic detail. */
  cellDeg(lat: number, lon: number): number {
    const w = this.detailWeight(lat, lon);
    const g = this.global.dy;
    return this.detail ? g + (this.detail.dy - g) * w : g;
  }

  sample(v: ModelVar, lat: number, lon: number): number {
    const gv = smooth(this.global, v, this.t, lat, lon);
    const w = this.detailWeight(lat, lon);
    let r = gv;
    if (w > 0) {
      const d = this.detail!;
      if (this.detailT < 0) {
        // match time step by timestamp (both grids share the model run, but be safe)
        const target = this.time;
        this.detailT = Math.max(0, d.times.findIndex((tt) => tt >= target));
      }
      const dv = smooth(d, v, this.detailT, lat, lon);
      if (!Number.isNaN(dv)) r = Number.isNaN(gv) ? dv : dv * w + gv * (1 - w);
    }
    const tf = TRANSFORMS[v];
    return tf && !Number.isNaN(r) ? tf[1](r) : r;
  }
}

export function nearestTimeIndex(times: number[], at = Date.now()): number {
  let best = 0;
  for (let i = 1; i < times.length; i++) if (Math.abs(times[i] - at) < Math.abs(times[best] - at)) best = i;
  return best;
}

export function isLimitError(e: unknown) {
  return e instanceof OpenMeteoLimitError;
}
