// Camera pose from point pairs: the user marks the same spot on the ground in the camera picture and on the map.
// A pinhole camera at a known position (height `alt` above the ground) looks along `heading` (clockwise from north),
// `down` degrees below the horizon, with a vertical field of view `fov`. With 1 pair only the heading is fitted,
// with 2 also the field of view, from 3 on also tilt and height.

export interface Pose {
  heading: number; // degrees, clockwise from north
  down: number; // degrees below the horizon
  alt: number; // metres above the ground
  fov: number; // vertical field of view, degrees
}

/** u, v: position in the picture (u right, v up; v from -1 to 1, u from -aspect to aspect); e, n: metres east / north of the camera */
export interface Pair {
  u: number;
  v: number;
  e: number;
  n: number;
}

const RAD = Math.PI / 180;

/** where a ground point (metres east / north of the camera) lands in the picture, null when it is behind the camera */
export function project(p: Pose, e: number, n: number): [number, number] | null {
  const sh = Math.sin(p.heading * RAD);
  const ch = Math.cos(p.heading * RAD);
  const st = Math.sin(p.down * RAD);
  const ct = Math.cos(p.down * RAD);
  const z = (e * sh + n * ch) * ct + p.alt * st; // along the viewing direction
  if (z <= 0.01) return null;
  const x = e * ch - n * sh; // to the right
  const y = (e * sh + n * ch) * st - p.alt * ct; // up
  const f = 1 / Math.tan((p.fov * RAD) / 2);
  return [(f * x) / z, (f * y) / z];
}

const BOUNDS = { down: [-10, 60], alt: [0.5, 80], fov: [15, 90] } as const;
const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, v));

function cost(pairs: Pair[], p: Pose, full: boolean) {
  let s = 0;
  for (const pr of pairs) {
    const q = project(p, pr.e, pr.n);
    if (!q) {
      s += 100;
      continue;
    }
    s += (q[0] - pr.u) ** 2;
    if (full) s += (q[1] - pr.v) ** 2;
  }
  return s;
}

function nelderMead(f: (x: number[]) => number, x0: number[], step: number[], iters = 500): number[] {
  const n = x0.length;
  let simplex = [x0, ...x0.map((_, i) => x0.map((v, j) => (j === i ? v + step[i] : v)))];
  let vals = simplex.map(f);
  for (let it = 0; it < iters; it++) {
    const order = vals.map((_, i) => i).sort((a, b) => vals[a] - vals[b]);
    simplex = order.map((i) => simplex[i]);
    vals = order.map((i) => vals[i]);
    if (Math.abs(vals[n] - vals[0]) < 1e-13) break;
    const c = x0.map((_, j) => simplex.slice(0, n).reduce((s, p) => s + p[j], 0) / n);
    const worst = simplex[n];
    const refl = c.map((v, j) => v + (v - worst[j]));
    const fr = f(refl);
    if (fr < vals[0]) {
      const exp = c.map((v, j) => v + 2 * (v - worst[j]));
      const fe = f(exp);
      simplex[n] = fe < fr ? exp : refl;
      vals[n] = Math.min(fe, fr);
    } else if (fr < vals[n - 1]) {
      simplex[n] = refl;
      vals[n] = fr;
    } else {
      const con = c.map((v, j) => v + 0.5 * (worst[j] - v));
      const fc = f(con);
      if (fc < vals[n]) {
        simplex[n] = con;
        vals[n] = fc;
      } else {
        for (let i = 1; i <= n; i++) {
          simplex[i] = simplex[i].map((v, j) => simplex[0][j] + 0.5 * (v - simplex[0][j]));
          vals[i] = f(simplex[i]);
        }
      }
    }
  }
  let b = 0;
  for (let i = 1; i <= n; i++) if (vals[i] < vals[b]) b = i;
  return simplex[b];
}

/** Best pose for the pairs, starting from `start` (its tilt / height / field of view are kept where the pairs cannot decide).
 * `rms` is the remaining distance in picture heights ×0.5 (1 = half the picture height). */
export function fitPose(pairs: Pair[], start: Pose): { pose: Pose; rms: number } {
  const n = pairs.length;
  if (!n) return { pose: start, rms: 0 };
  const full = n >= 3;
  // the heading first, by scanning – the cost is periodic and has several minima
  let h0 = start.heading;
  let best = Infinity;
  for (let h = 0; h < 360; h += 4) {
    const c = cost(pairs, { ...start, heading: h }, false);
    if (c < best) {
      best = c;
      h0 = h;
    }
  }
  const build = (x: number[]): Pose => ({
    heading: x[0],
    down: full ? clamp(x[1], BOUNDS.down) : start.down,
    alt: full ? clamp(x[2], BOUNDS.alt) : start.alt,
    fov: n >= 2 ? clamp(x[full ? 3 : 1], BOUNDS.fov) : start.fov,
  });
  // weak pull towards the start values keeps the 4-parameter fit from drifting with few, nearly collinear points
  const prior = (p: Pose) => 0.002 * (((p.down - start.down) / 40) ** 2 + ((p.alt - start.alt) / 20) ** 2 + ((p.fov - start.fov) / 40) ** 2);
  const x0 = full ? [h0, start.down, start.alt, start.fov] : n === 2 ? [h0, start.fov] : [h0];
  const step = full ? [8, 4, 2, 6] : n === 2 ? [8, 6] : [8];
  const f = (x: number[]) => {
    const p = build(x);
    return cost(pairs, p, full) + (full ? prior(p) : 0);
  };
  const x = nelderMead(f, x0, step);
  const pose = build(x);
  pose.heading = ((pose.heading % 360) + 360) % 360;
  return { pose, rms: Math.sqrt(cost(pairs, pose, full) / n) };
}

/** where two lines of the picture (each through two points, u / v units) meet; null when they are nearly parallel */
export function vanishingPoint(a: [number, number, number, number], b: [number, number, number, number]): [number, number] | null {
  const [x1, y1, x2, y2] = a;
  const [x3, y3, x4, y4] = b;
  const d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(d) < 1e-9) return null;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d;
  return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
}

/** From the vanishing point (u, v) of a horizontal direction (a straight road): the tilt of the camera below the horizon
 * and the angle of that direction to the viewing direction (clockwise, degrees). Needs the vertical field of view. */
export function fromVanishing(u: number, v: number, fov: number): { down: number; rel: number } {
  const f = 1 / Math.tan((fov * RAD) / 2);
  const down = Math.atan2(v, f);
  const rel = Math.atan2(u, v * Math.sin(down) + f * Math.cos(down));
  return { down: down / RAD, rel: rel / RAD };
}
