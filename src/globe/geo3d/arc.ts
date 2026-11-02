import { EARTH_RADIUS_M, type Vec3 } from './frame';

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export interface ArcOptions {
  /** height in the middle, as a share of the distance */
  lift?: number;
  /** sideways shift in the middle (degrees), keeps arcs between the same two places apart */
  bulge?: number;
  steps?: number;
}

/** Bow along the great circle between two places [lon, lat]: [lon, lat, altitude m] with continuous longitudes. */
export function arcPoints(a: [number, number], b: [number, number], opts: ArcOptions = {}): Vec3[] {
  const { lift = 0, bulge = 0, steps = 64 } = opts;
  const v = (p: [number, number]) => [Math.cos(rad(p[1])) * Math.cos(rad(p[0])), Math.cos(rad(p[1])) * Math.sin(rad(p[0])), Math.sin(rad(p[1]))];
  const [p, q] = [v(a), v(b)];
  const d = Math.acos(Math.min(1, Math.max(-1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2])));
  const out: Vec3[] = [];
  let last = a[0];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const k1 = d > 1e-9 ? Math.sin((1 - t) * d) / Math.sin(d) : 1 - t;
    const k2 = d > 1e-9 ? Math.sin(t * d) / Math.sin(d) : t;
    const [x, y, z] = [k1 * p[0] + k2 * q[0], k1 * p[1] + k2 * q[1], k1 * p[2] + k2 * q[2]];
    const middle = Math.sin(Math.PI * t);
    const w = middle * bulge;
    let lon = deg(Math.atan2(y, x)) + w * Math.sign(b[1] - a[1] || 1);
    lon += 360 * Math.round((last - lon) / 360);
    last = lon;
    out.push([lon, deg(Math.atan2(z, Math.hypot(x, y))) + w * Math.sign(a[0] - b[0] || 1), middle * lift * d * EARTH_RADIUS_M]);
  }
  return out;
}
