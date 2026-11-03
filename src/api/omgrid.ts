// Pure helpers for the Open-Meteo model grid: which points and variables are requested, how the answers are thinned to the
// 3-hourly map grid, and the compact snapshot (openmeteo/global.json) that the orbis-data collector builds every 2 hours so
// the browsers do not have to ask Open-Meteo for 408 locations each. No browser APIs – the collector imports this file.
//
// Weather data by Open-Meteo.com (https://open-meteo.com), CC BY 4.0.

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
export type RawVar = (typeof MODEL_VARS)[number];

export const FORECAST_DAYS = 3;
/** locations per multi-location request */
export const OM_BATCH = 100;
/** map time step in hours (the hourly answer is thinned to every 3rd value) */
export const STEP_HOURS = 3;

export interface GridSpec {
  lat0: number;
  lon0: number;
  dx: number;
  dy: number;
  nx: number;
  ny: number;
  wrap: boolean;
}

/** The global grid: 15° × 10°, 24 × 17 = 408 points, wraps around in longitude. */
export const GLOBAL_GRID: GridSpec = { lat0: 80, lon0: -180, dx: 15, dy: 10, nx: 24, ny: 17, wrap: true };

/** [lat, lon] of every grid point, row by row from the north-west corner. */
export function gridPoints(g: GridSpec): [number, number][] {
  const pts: [number, number][] = [];
  for (let y = 0; y < g.ny; y++) for (let x = 0; x < g.nx; x++) pts.push([g.lat0 - y * g.dy, g.lon0 + x * g.dx]);
  return pts;
}

export type HourlyRow = { hourly: Record<string, (number | null)[]> & { time: string[] } };

/** Open-Meteo forecast URL for up to OM_BATCH locations. */
export function forecastUrl(points: [number, number][]): string {
  const q = new URLSearchParams({
    latitude: points.map((p) => p[0].toFixed(2)).join(','),
    longitude: points.map((p) => p[1].toFixed(2)).join(','),
    hourly: MODEL_VARS.join(','),
    forecast_days: String(FORECAST_DAYS),
    wind_speed_unit: 'kmh',
    timezone: 'GMT',
  });
  return `https://api.open-meteo.com/v1/forecast?${q}`;
}

/** The request URLs for a point list, in OM_BATCH chunks (each chunk costs chunk.length API calls). */
export function forecastUrls(points: [number, number][]): { url: string; count: number }[] {
  const out: { url: string; count: number }[] = [];
  for (let i = 0; i < points.length; i += OM_BATCH) {
    const chunk = points.slice(i, i + OM_BATCH);
    out.push({ url: forecastUrl(chunk), count: chunk.length });
  }
  return out;
}

/** Thins hourly rows to the map's steps and lays them out [t * rows.length + point]; missing values are NaN. */
export function rowsToSeries(rows: HourlyRow[]): { times: number[]; data: Record<RawVar, Float32Array> } {
  const allTimes = rows[0].hourly.time.map((t) => Date.parse(`${t}Z`));
  const keep = allTimes.map((_, i) => i).filter((i) => i % STEP_HOURS === 0);
  const times = keep.map((i) => allTimes[i]);
  const n = rows.length;
  const data = {} as Record<RawVar, Float32Array>;
  for (const v of MODEL_VARS) data[v] = new Float32Array(times.length * n);
  rows.forEach((row, p) => {
    for (const v of MODEL_VARS) {
      const src = row.hourly[v] ?? [];
      const dst = data[v];
      keep.forEach((srcI, t) => {
        const val = src[srcI];
        dst[t * n + p] = val == null ? NaN : val;
      });
    }
  });
  return { times, data };
}

// ---------------------------------------------------------------------------
// Snapshot

export const SNAPSHOT_VERSION = 1;
/** A snapshot older than this is ignored by the app (the collector runs every 2 h). */
export const SNAPSHOT_MAX_AGE_MS = 3 * 3600 * 1000;

export interface OmSnapshot {
  v: 1;
  /** generated at, epoch seconds */
  g: number;
  /** first time step, epoch hours (GMT) */
  t: number;
  /** step between the values in hours */
  dt: number;
  /** number of time steps */
  n: number;
  vars: string[];
  /** [lon, lat] of every point */
  pts: [number, number][];
  /** per variable, rounded, layout [step * pts.length + point]; null = missing */
  vals: Record<string, (number | null)[]>;
}

/** decimals kept per variable (about the precision the model has anyway) */
const DECIMALS: Record<RawVar, number> = {
  temperature_2m: 1,
  relative_humidity_2m: 0,
  precipitation: 1,
  cloud_cover: 0,
  pressure_msl: 1,
  wind_speed_10m: 1,
  wind_direction_10m: 0,
  wind_gusts_10m: 1,
  snow_depth: 2,
  cape: 0,
};

function round(x: number, d: number): number | null {
  if (!Number.isFinite(x)) return null;
  const f = 10 ** d;
  return Math.round(x * f) / f;
}

export function buildSnapshot(grid: GridSpec, rows: HourlyRow[], now = Date.now()): OmSnapshot {
  const pts = gridPoints(grid);
  if (rows.length !== pts.length) throw new Error(`expected ${pts.length} locations, got ${rows.length}`);
  const { times, data } = rowsToSeries(rows);
  const vals: Record<string, (number | null)[]> = {};
  for (const v of MODEL_VARS) vals[v] = Array.from(data[v], (x) => round(x, DECIMALS[v]));
  return {
    v: SNAPSHOT_VERSION,
    g: Math.floor(now / 1000),
    t: times[0] / 3600000,
    dt: STEP_HOURS,
    n: times.length,
    vars: [...MODEL_VARS],
    pts: pts.map(([lat, lon]) => [lon, lat]),
    vals,
  };
}

export function snapshotIsStale(s: Pick<OmSnapshot, 'g'>, now = Date.now(), maxAgeMs = SNAPSHOT_MAX_AGE_MS): boolean {
  return now - s.g * 1000 > maxAgeMs;
}

/**
 * Validates a snapshot against the grid and returns the raw series like rowsToSeries(); null if it is malformed,
 * for another grid, or (unless maxAgeMs is Infinity) stale.
 */
export function parseSnapshot(
  json: unknown,
  grid: GridSpec,
  now = Date.now(),
  maxAgeMs = SNAPSHOT_MAX_AGE_MS,
): { times: number[]; data: Record<RawVar, Float32Array>; generated: number } | null {
  const s = json as Partial<OmSnapshot> | null;
  if (!s || s.v !== SNAPSHOT_VERSION || !Array.isArray(s.pts) || !s.vals || typeof s.g !== 'number' || typeof s.t !== 'number') return null;
  if (typeof s.n !== 'number' || s.n < 1 || s.dt !== STEP_HOURS) return null;
  if (snapshotIsStale({ g: s.g }, now, maxAgeMs)) return null;
  const expect = gridPoints(grid);
  if (s.pts.length !== expect.length) return null;
  for (let i = 0; i < expect.length; i++) {
    const p = s.pts[i];
    if (!p || p[0] !== expect[i][1] || p[1] !== expect[i][0]) return null;
  }
  const len = s.n * expect.length;
  const data = {} as Record<RawVar, Float32Array>;
  for (const v of MODEL_VARS) {
    const src = s.vals[v];
    if (!Array.isArray(src) || src.length !== len) return null;
    const dst = new Float32Array(len);
    for (let i = 0; i < len; i++) dst[i] = src[i] == null ? NaN : (src[i] as number);
    data[v] = dst;
  }
  const times = Array.from({ length: s.n }, (_, i) => (s.t! + i * s.dt!) * 3600000);
  return { times, data, generated: s.g * 1000 };
}
