// Gridded forecast data for the map layers, built from Open-Meteo multi-location requests.
// A coarse global grid is always loaded; when zoomed in, a finer grid for the viewport is
// fetched and blended in seamlessly.

export const MODEL_VARS = [
  'temperature_2m',
  'apparent_temperature',
  'relative_humidity_2m',
  'dew_point_2m',
  'precipitation',
  'cloud_cover',
  'pressure_msl',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'snow_depth',
  'cape',
] as const;
export type ModelVar = (typeof MODEL_VARS)[number] | 'u' | 'v';

export interface ModelGrid {
  /** latitude of the first (northernmost) row */
  lat0: number;
  /** longitude of the first (westernmost) column */
  lon0: number;
  step: number;
  nx: number;
  ny: number;
  /** global grids wrap around in longitude */
  wrap: boolean;
  /** epoch ms of each time step */
  times: number[];
  /** layout: [(t * ny + y) * nx + x] */
  data: Record<ModelVar, Float32Array>;
}

export class ModelLimitError extends Error {}

const FORECAST_DAYS = 5;

type HourlyRow = { hourly: Record<string, (number | null)[]> & { time: string[] } };

async function fetchPoints(points: [number, number][]): Promise<HourlyRow[]> {
  const BATCH = 150;
  const batches: [number, number][][] = [];
  for (let i = 0; i < points.length; i += BATCH) batches.push(points.slice(i, i + BATCH));
  const out: HourlyRow[][] = new Array(batches.length);
  // two requests at a time – gentle on the free API
  let next = 0;
  const worker = async () => {
    while (next < batches.length) {
      const i = next++;
      const chunk = batches[i];
      const q = new URLSearchParams({
        latitude: chunk.map((p) => p[0].toFixed(2)).join(','),
        longitude: chunk.map((p) => p[1].toFixed(2)).join(','),
        hourly: MODEL_VARS.join(','),
        forecast_days: String(FORECAST_DAYS),
        temporal_resolution: 'hourly_3',
        wind_speed_unit: 'kmh',
        timezone: 'GMT',
        cell_selection: 'nearest',
      });
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`);
      if (res.status === 429) throw new ModelLimitError('Open-Meteo-Limit erreicht');
      if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
      const json = (await res.json()) as HourlyRow | HourlyRow[];
      out[i] = Array.isArray(json) ? json : [json];
    }
  };
  await Promise.all([worker(), worker()]);
  return out.flat();
}

async function fetchGrid(lat0: number, lon0: number, step: number, nx: number, ny: number, wrap: boolean): Promise<ModelGrid> {
  const points: [number, number][] = [];
  for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) points.push([lat0 - y * step, lon0 + x * step]);
  const rows = await fetchPoints(points);
  const times = rows[0].hourly.time.map((t) => Date.parse(`${t}Z`));
  const nt = times.length;
  const stepHours = nt > 1 ? (times[1] - times[0]) / 3600000 : 1;
  const n = nx * ny;
  const data = {} as Record<ModelVar, Float32Array>;
  for (const v of [...MODEL_VARS, 'u', 'v'] as ModelVar[]) data[v] = new Float32Array(nt * n);

  rows.forEach((row, p) => {
    const h = row.hourly;
    for (const v of MODEL_VARS) {
      const src = h[v] ?? [];
      const dst = data[v];
      for (let t = 0; t < nt; t++) {
        const val = src[t];
        dst[t * n + p] = val == null ? NaN : v === 'precipitation' ? val / stepHours : val;
      }
    }
    // Wind vector (m/s) for particles; direction is where the wind comes FROM.
    for (let t = 0; t < nt; t++) {
      const i = t * n + p;
      const spd = data.wind_speed_10m[i] / 3.6;
      const dir = (data.wind_direction_10m[i] * Math.PI) / 180;
      data.u[i] = -spd * Math.sin(dir);
      data.v[i] = -spd * Math.cos(dir);
    }
  });
  return { lat0, lon0, step, nx, ny, wrap, times, data };
}

// ---------------------------------------------------------------------------
// Global grid (10°, 612 points) – cached in memory and localStorage for 1 h.

const CACHE_KEY = 'wg.model.v2';
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
  globalPromise ??= fetchGrid(80, -180, 10, 36, 17, true)
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
    localStorage.removeItem('wg.cache.grid'); // pre-v2 cache
    const data: Record<string, string> = {};
    for (const [k, v] of Object.entries(g.data)) if (k !== 'u' && k !== 'v') data[k] = toB64(v);
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
    data.u = new Float32Array(data.wind_speed_10m.length);
    data.v = new Float32Array(data.wind_speed_10m.length);
    for (let i = 0; i < data.u.length; i++) {
      const spd = data.wind_speed_10m[i] / 3.6;
      const dir = (data.wind_direction_10m[i] * Math.PI) / 180;
      data.u[i] = -spd * Math.sin(dir);
      data.v[i] = -spd * Math.cos(dir);
    }
    return { at, grid: { ...g, data } };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Detail grid for the current viewport.

const NICE_STEPS = [0.25, 0.5, 1, 2, 2.5, 5];
const MAX_DETAIL_POINTS = 180;
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
    p = fetchGrid(req.lat0, req.lon0, req.step, req.nx, req.ny, false);
    p.catch(() => detailCache.delete(req.key));
    detailCache.set(req.key, p);
    if (detailCache.size > 8) detailCache.delete(detailCache.keys().next().value!);
  }
  return p;
}

// ---------------------------------------------------------------------------
// Sampling

function bilinear(g: ModelGrid, arr: Float32Array, t: number, lat: number, lon: number): number {
  let x = (lon - g.lon0) / g.step;
  let y = (g.lat0 - lat) / g.step;
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

  sample(v: ModelVar, lat: number, lon: number): number {
    const gv = bilinear(this.global, this.global.data[v], this.t, lat, lon);
    const d = this.detail;
    if (!d) return gv;
    const x = (lon - d.lon0) / d.step;
    const y = (d.lat0 - lat) / d.step;
    if (x < 0 || y < 0 || x > d.nx - 1 || y > d.ny - 1) return gv;
    if (this.detailT < 0) {
      // match time step by timestamp (both grids share the model run, but be safe)
      const target = this.time;
      this.detailT = Math.max(0, d.times.findIndex((tt) => tt >= target));
    }
    const dv = bilinear(d, d.data[v], this.detailT, lat, lon);
    if (Number.isNaN(dv)) return gv;
    const edge = Math.min(x, y, d.nx - 1 - x, d.ny - 1 - y);
    const w = Math.min(1, edge / 1.5);
    return Number.isNaN(gv) ? dv : dv * w + gv * (1 - w);
  }
}

export function nearestTimeIndex(times: number[], at = Date.now()): number {
  let best = 0;
  for (let i = 1; i < times.length; i++) if (Math.abs(times[i] - at) < Math.abs(times[best] - at)) best = i;
  return best;
}

export function isLimitError(e: unknown) {
  return e instanceof ModelLimitError;
}
