import type { LngLat } from './types';

const R = 6371008.8;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** great-circle distance in m */
export function haversine(a: LngLat, b: LngLat): number {
  const h = Math.sin(rad(b[1] - a[1]) / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(rad(b[0] - a[0]) / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** initial bearing a → b in degrees (0–360, 0 = north) */
export function bearing(a: LngLat, b: LngLat): number {
  const y = Math.sin(rad(b[0] - a[0])) * Math.cos(rad(b[1]));
  const x = Math.cos(rad(a[1])) * Math.sin(rad(b[1])) - Math.sin(rad(a[1])) * Math.cos(rad(b[1])) * Math.cos(rad(b[0] - a[0]));
  return norm(deg(Math.atan2(y, x)));
}

/** point `m` metres from `a` along `brg` */
export function destination(a: LngLat, brg: number, m: number): LngLat {
  const d = m / R;
  const lat1 = rad(a[1]);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(rad(brg)));
  const lon2 = rad(a[0]) + Math.atan2(Math.sin(rad(brg)) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return [deg(lon2), deg(lat2)];
}

/** angle into 0 ≤ a < 360 */
export const norm = (a: number) => ((a % 360) + 360) % 360;

/** signed shortest turn from `from` to `to` in degrees (−180 … 180) */
export const angleDiff = (from: number, to: number) => ((((to - from) % 360) + 540) % 360) - 180;

/** moves `cur` towards `target` along the short way by `k` (0–1) of the gap */
export const lerpAngle = (cur: number, target: number, k: number) => norm(cur + angleDiff(cur, target) * k);

/** circular mean of angles (degrees); null for an empty list */
export function meanAngle(list: number[]): number | null {
  if (!list.length) return null;
  let s = 0;
  let c = 0;
  for (const a of list) {
    s += Math.sin(rad(a));
    c += Math.cos(rad(a));
  }
  return norm(deg(Math.atan2(s, c)));
}

/** circle polygon ring (for the accuracy disc) */
export function circle(center: LngLat, radius: number, n = 48): LngLat[] {
  const ring: LngLat[] = [];
  for (let i = 0; i <= n; i++) ring.push(destination(center, (360 / n) * i, radius));
  return ring;
}

/** Google / Valhalla encoded polyline; `precision` is 5 (Google, OSRM) or 6 (Valhalla, Mapbox polyline6) */
export function decodePolyline(str: string, precision = 5): LngLat[] {
  const f = 10 ** precision;
  const out: LngLat[] = [];
  let i = 0;
  let lat = 0;
  let lon = 0;
  const next = () => {
    let shift = 0;
    let result = 0;
    let b: number;
    do {
      b = str.charCodeAt(i++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20 && i <= str.length);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < str.length) {
    lat += next();
    lon += next();
    out.push([lon / f, lat / f]);
  }
  return out;
}

/** cumulative distance in m at every vertex */
export function cumulative(line: LngLat[]): number[] {
  const out = [0];
  for (let i = 1; i < line.length; i++) out.push(out[i - 1] + haversine(line[i - 1], line[i]));
  return out;
}

export interface Snap {
  /** index of the segment's first vertex */
  index: number;
  /** nearest point on the line */
  point: LngLat;
  /** distance from the position to the line in m */
  offset: number;
  /** distance along the line from its start in m */
  along: number;
  /** bearing of the segment in degrees */
  bearing: number;
}

/**
 * Nearest point of `line` to `p`. Only segments from `from` up to `from + window` are looked at, so a route that
 * crosses itself (or runs back next to itself) does not make the position jump to the other pass.
 * `cum` is {@link cumulative}(line).
 */
export function snapToLine(line: LngLat[], cum: number[], p: LngLat, from = 0, window = line.length): Snap | null {
  if (line.length < 2) return null;
  const cosLat = Math.cos(rad(p[1]));
  // local flat metres around p – exact enough for segments that are at most a few km long
  const mx = (lon: number) => rad(lon - p[0]) * R * cosLat;
  const my = (lat: number) => rad(lat - p[1]) * R;
  let best: Snap | null = null;
  const end = Math.min(line.length - 1, from + window);
  for (let i = Math.max(0, from); i < end; i++) {
    const ax = mx(line[i][0]);
    const ay = my(line[i][1]);
    const bx = mx(line[i + 1][0]);
    const by = my(line[i + 1][1]);
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    const off = Math.hypot(ax + dx * t, ay + dy * t);
    if (!best || off < best.offset) {
      best = {
        index: i,
        offset: off,
        point: [line[i][0] + (line[i + 1][0] - line[i][0]) * t, line[i][1] + (line[i + 1][1] - line[i][1]) * t],
        along: cum[i] + (cum[i + 1] - cum[i]) * t,
        bearing: bearing(line[i], line[i + 1]),
      };
    }
  }
  return best;
}

/** drops vertices closer than `m` to the previous kept one (keeps the last) – keeps long routes light for the map */
export function thin(line: LngLat[], m: number): LngLat[] {
  if (line.length < 3) return line;
  const out = [line[0]];
  for (let i = 1; i < line.length - 1; i++) if (haversine(out[out.length - 1], line[i]) >= m) out.push(line[i]);
  out.push(line[line.length - 1]);
  return out;
}
