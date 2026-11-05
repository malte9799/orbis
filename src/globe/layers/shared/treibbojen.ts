// Drifting buoys (NOAA Global Drifter Program): decoding of public/data/drifters/tracks.bin, interpolation between the
// points, the two time modes and a few numbers per track. Pure functions, no map and no DOM (tested in treibbojen.test.ts).
// Format: see the head of scripts/drifters-build.py.

export interface DrifterMeta {
  version: number;
  credit: string;
  doi: string;
  license: string;
  first: string;
  last: string;
  stepDays: number;
  scale: number;
  count: number;
  points: number;
  ids: number[];
}

export interface Tracks {
  count: number;
  stepDays: number;
  ids: number[];
  /** step of the first point (days since 1970-01-01 / stepDays) */
  start: Uint16Array;
  /** number of points */
  len: Uint16Array;
  /** index of the first point of each track in lon / lat */
  off: Uint32Array;
  /** degrees, -180..180 */
  lon: Float32Array;
  lat: Float32Array;
}

/** one simulated year per this many seconds, and the length of the loop in the "shared start" mode */
export const SHARED_SECONDS_PER_YEAR = 5;
export const REAL_SECONDS_PER_YEAR = 2.5;
export const SHARED_SPAN_DAYS = 4 * 365;
/** how far back the trail reaches (days) */
export const TRAIL_DAYS = 90;
/** a drifter fades in and out over this many steps */
const FADE_STEPS = 2;

export type DriftMode = 'shared' | 'real';

export function decodeTracks(buf: ArrayBuffer, meta: Pick<DrifterMeta, 'scale' | 'stepDays' | 'ids'>): Tracks {
  const v = new DataView(buf);
  if (buf.byteLength < 4) throw new Error('tracks.bin: zu kurz');
  const n = v.getUint32(0, true);
  const head = 4 + n * 4;
  if (n !== meta.ids.length || buf.byteLength < head) throw new Error('tracks.bin passt nicht zu meta.json');
  const start = new Uint16Array(n);
  const len = new Uint16Array(n);
  const off = new Uint32Array(n);
  let total = 0;
  for (let i = 0; i < n; i++) {
    start[i] = v.getUint16(4 + i * 4, true);
    len[i] = v.getUint16(6 + i * 4, true);
    off[i] = total;
    total += len[i];
  }
  if (buf.byteLength !== head + total * 4) throw new Error('tracks.bin: falsche Größe');
  const lon = new Float32Array(total);
  const lat = new Float32Array(total);
  for (let k = 0; k < total; k++) {
    lon[k] = v.getUint16(head + k * 4, true) / meta.scale - 180;
    lat[k] = v.getUint16(head + k * 4 + 2, true) / meta.scale - 90;
  }
  return { count: n, stepDays: meta.stepDays, ids: meta.ids, start, len, off, lon, lat };
}

/** Is the step between two longitudes a jump over the date line (the line must not run across the map)? */
export const crossesDateLine = (lon1: number, lon2: number) => Math.abs(lon2 - lon1) > 180;

const wrapLon = (l: number) => ((((l + 180) % 360) + 360) % 360) - 180;

/** Position at `local` steps after the first point; null outside of the track. Crosses the date line the short way. */
export function pointAt(t: Tracks, i: number, local: number): { lon: number; lat: number } | null {
  const n = t.len[i];
  if (!(local >= 0) || local > n - 1) return null;
  const k = Math.min(n - 2, Math.floor(local));
  if (k < 0) return { lon: t.lon[t.off[i]], lat: t.lat[t.off[i]] };
  const f = local - k;
  const a = t.off[i] + k;
  const d = wrapLon(t.lon[a + 1] - t.lon[a]);
  return { lon: wrapLon(t.lon[a] + d * f), lat: t.lat[a] + (t.lat[a + 1] - t.lat[a]) * f };
}

/** Steps since the start of a track at time `time` (days): shared start: from 0, real time: from the start of the track. */
export function localStep(mode: DriftMode, time: number, start: number, stepDays: number): number {
  return mode === 'shared' ? time / stepDays : time / stepDays - start;
}

/** 0..1: fading in at the start and out at the end of a track (0: not there) */
export function dotAlpha(local: number, len: number): number {
  if (!(local >= 0) || local > len - 1) return 0;
  return Math.min(1, (local + 0.5) / FADE_STEPS, (len - 1 - local + 0.5) / FADE_STEPS);
}

export interface TimeRange {
  lo: number;
  hi: number;
}

/** The range of the time (days) in a mode: shared start: 0 to the loop length, real time: first to last day of the data. */
export function timeRange(mode: DriftMode, tracks: Tracks): TimeRange {
  if (mode === 'shared') return { lo: 0, hi: SHARED_SPAN_DAYS };
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < tracks.count; i++) {
    lo = Math.min(lo, tracks.start[i] * tracks.stepDays);
    hi = Math.max(hi, (tracks.start[i] + tracks.len[i] - 1) * tracks.stepDays);
  }
  return { lo, hi };
}

export const daysPerSecond = (mode: DriftMode) => 365 / (mode === 'shared' ? SHARED_SECONDS_PER_YEAR : REAL_SECONDS_PER_YEAR);

/** Time after `dtMs` of playing; at the end of the range it starts over. */
export function advanceTime(mode: DriftMode, time: number, dtMs: number, range: TimeRange): number {
  const t = time + (dtMs / 1000) * daysPerSecond(mode);
  if (t > range.hi) return range.lo + ((t - range.lo) % (range.hi - range.lo));
  return Math.max(range.lo, t);
}

/** Index pairs of consecutive points of the same track (as line segments); steps over the date line are left out. */
export function segmentIndex(t: Tracks): Uint32Array {
  let n = 0;
  const out = new Uint32Array(Math.max(0, t.lon.length - t.count) * 2);
  for (let i = 0; i < t.count; i++) {
    for (let k = 0; k + 1 < t.len[i]; k++) {
      const a = t.off[i] + k;
      if (crossesDateLine(t.lon[a], t.lon[a + 1])) continue;
      out[n++] = a;
      out[n++] = a + 1;
    }
  }
  return out.slice(0, n);
}

/** Per point: [days since the start of its track, days since 1970-01-01]. */
export function pointTimes(t: Tracks): Float32Array {
  const out = new Float32Array(t.lon.length * 2);
  for (let i = 0; i < t.count; i++) {
    for (let k = 0; k < t.len[i]; k++) {
      const p = t.off[i] + k;
      out[p * 2] = k * t.stepDays;
      out[p * 2 + 1] = (t.start[i] + k) * t.stepDays;
    }
  }
  return out;
}

const R_KM = 6371.0088;
const rad = (d: number) => (d * Math.PI) / 180;

/** Distance between two points (km, great circle). */
export function distanceKm(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

export interface TrackSummary {
  id: number;
  startDay: number;
  endDay: number;
  days: number;
  /** sum of the steps between the stored points (a lower bound: the real path wiggles between them) */
  km: number;
  from: { lon: number; lat: number };
  to: { lon: number; lat: number };
}

export function summarize(t: Tracks, i: number): TrackSummary {
  const o = t.off[i];
  const n = t.len[i];
  let km = 0;
  for (let k = 0; k + 1 < n; k++) km += distanceKm(t.lon[o + k], t.lat[o + k], t.lon[o + k + 1], t.lat[o + k + 1]);
  return {
    id: t.ids[i],
    startDay: t.start[i] * t.stepDays,
    endDay: (t.start[i] + n - 1) * t.stepDays,
    days: (n - 1) * t.stepDays,
    km,
    from: { lon: t.lon[o], lat: t.lat[o] },
    to: { lon: t.lon[o + n - 1], lat: t.lat[o + n - 1] },
  };
}

/** ISO date (UTC) of a day count since 1970-01-01. */
export const dayToIso = (day: number) => new Date(Math.round(day) * 86400000).toISOString().slice(0, 10);

/** Calendar year of a day count since 1970-01-01. */
export const dayToYear = (day: number) => new Date(Math.round(day) * 86400000).getUTCFullYear();

/** Day count (since 1970-01-01) of the start of a year. */
export const yearToDay = (year: number) => Date.UTC(year, 0, 1) / 86400000;

/** Number of tracks that are there at this time (for the legend). */
export function activeCount(t: Tracks, mode: DriftMode, time: number): number {
  let n = 0;
  for (let i = 0; i < t.count; i++) if (dotAlpha(localStep(mode, time, t.start[i], t.stepDays), t.len[i]) > 0) n++;
  return n;
}

/** The whole track as [lon, lat, 0] with longitudes that run on across the date line (for GeoLine). */
export function unwrappedTrack(t: Tracks, i: number): [number, number, number][] {
  const out: [number, number, number][] = [];
  let shift = 0;
  for (let k = 0; k < t.len[i]; k++) {
    const p = t.off[i] + k;
    if (k && crossesDateLine(t.lon[p - 1], t.lon[p])) shift += t.lon[p] < t.lon[p - 1] ? 360 : -360;
    out.push([t.lon[p] + shift, t.lat[p], 0]);
  }
  return out;
}
