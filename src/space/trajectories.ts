import type { Vec3 } from './ephemeris';

// Heliocentric probe trajectories from NASA/JPL Horizons (condensed by
// scripts/spacecraft-trajectories.mjs). Samples: t [ms], x, y, z [AU], vx, vy, vz [AU/day];
// between them a cubic Hermite spline reproduces fly-bys and gravity assists smoothly.

const STRIDE = 7;
const DAY_MS = 86400000;

let data: Record<string, number[]> | null = null;
let loading: Promise<boolean> | null = null;

export function loadTrajectories(): Promise<boolean> {
  loading ??= fetch('./data/spacecraft.json')
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((j: { craft: Record<string, number[]> }) => {
      data = j.craft;
      return true;
    })
    .catch((e) => {
      console.warn('Sondenbahnen', e);
      loading = null;
      return false;
    });
  return loading;
}

export const trajectoriesLoaded = () => !!data;

/** Position of a probe at `ms`, or null when the table is missing / does not cover the time. */
export function trajectoryAt(id: string, ms: number): Vec3 | null {
  const s = data?.[id];
  if (!s || s.length < 2 * STRIDE) return null;
  const n = s.length / STRIDE;
  if (ms < s[0] || ms > s[(n - 1) * STRIDE]) return null;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (s[mid * STRIDE] <= ms) lo = mid;
    else hi = mid;
  }
  const a = lo * STRIDE;
  const b = hi * STRIDE;
  const h = (s[b] - s[a]) / DAY_MS; // days
  const u = (ms - s[a]) / (s[b] - s[a]);
  const u2 = u * u;
  const u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = u3 - u2;
  const out: Vec3 = [0, 0, 0];
  for (let k = 0; k < 3; k++) {
    out[k] = h00 * s[a + 1 + k] + h10 * h * s[a + 4 + k] + h01 * s[b + 1 + k] + h11 * h * s[b + 4 + k];
  }
  return out;
}

/** Times [ms] of all stored samples of a probe (the exact path nodes), or null without data. */
export function trajectoryTimes(id: string): number[] | null {
  const s = data?.[id];
  if (!s || s.length < 2 * STRIDE) return null;
  const out: number[] = [];
  for (let i = 0; i < s.length; i += STRIDE) out.push(s[i]);
  return out;
}
