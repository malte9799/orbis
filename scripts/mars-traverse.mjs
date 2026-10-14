// Rover traverses (Perseverance, Curiosity) and Ingenuity flight paths from NASA's MMGIS
// (mars.nasa.gov/mmgis-maps). The files have no CORS headers, so they are condensed here
// (decimated to a point every few metres) and served as a static snapshot:
//   - node scripts/mars-traverse.mjs public/data/mars-traverse.json   (bundled fallback)
//   - scripts/fetch-data.ts writes the same file to the `data` branch (refreshed daily)
//
// Output: { updated, m20: Track, msl: Track, heli: { flights: [{ n, sol, len, pts }] } }
// Track = { sol0: ISO time of sol 0, sol: number[], ll: number[] (lon,lat pairs), km }

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const BASE = 'https://mars.nasa.gov/mmgis-maps';
const UA = { 'User-Agent': 'Orbis-data/1.0 (+https://github.com/malte9799/orbis)' };
const M_PER_DEG = (2 * Math.PI * 3389500) / 360;

async function getJson(url) {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(90000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} – ${url}`);
  return res.json();
}

const r5 = (v) => Math.round(v * 1e5) / 1e5;
const r6 = (v) => Math.round(v * 1e6) / 1e6;

/** Keeps points at least `minM` metres apart (plus the last one of each call). */
class Decimator {
  constructor(minM) {
    this.min = minM;
    this.out = [];
    this.last = null;
  }
  add(lon, lat, tag) {
    const l = this.last;
    if (l) {
      const dx = (lon - l[0]) * Math.cos((lat * Math.PI) / 180) * M_PER_DEG;
      const dy = (lat - l[1]) * M_PER_DEG;
      if (Math.hypot(dx, dy) < this.min) {
        this.pending = [lon, lat, tag];
        return;
      }
    }
    this.out.push([lon, lat, tag]);
    this.last = [lon, lat];
    this.pending = null;
  }
  flush() {
    if (this.pending) {
      this.out.push(this.pending);
      this.last = [this.pending[0], this.pending[1]];
      this.pending = null;
    }
  }
}

const lines = (g) => (g.type === 'MultiLineString' ? g.coordinates : [g.coordinates]);

function track(sol0, pts) {
  let m = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = (pts[i][0] - pts[i - 1][0]) * Math.cos((pts[i][1] * Math.PI) / 180) * M_PER_DEG;
    m += Math.hypot(dx, (pts[i][1] - pts[i - 1][1]) * M_PER_DEG);
  }
  return { sol0, sol: pts.map((p) => p[2]), ll: pts.flatMap((p) => [r5(p[0]), r5(p[1])]), km: Math.round(m / 10) / 100 };
}

export async function buildMarsTraverse() {
  const [m20, msl, mslWay, heli] = await Promise.all([
    getJson(`${BASE}/M20/Layers/json/M20_traverse.json`),
    getJson(`${BASE}/MSL/Layers/json/MSL_traverse.json`),
    getJson(`${BASE}/MSL/Layers/json/MSL_waypoints.json`),
    getJson(`${BASE}/M20/Layers/json/m20_heli_flight_path.json`),
  ]);

  // Perseverance: one feature per drive, with the sol
  const d1 = new Decimator(6);
  for (const f of m20.features) {
    if (!f.geometry || f.properties?.sol == null) continue;
    for (const line of lines(f.geometry)) for (const c of line) d1.add(c[0], c[1], f.properties.sol);
  }
  d1.flush();

  // Curiosity: the traverse has no sol – assign it by cumulative distance from the waypoints
  let top = 0;
  const wp = mslWay.features
    .map((f) => f.properties)
    .filter((p) => p.dist_total_m != null && p.sol != null)
    // the file has a few glitches where the odometer is 0 again – keep the monotonic part
    .filter((p) => p.dist_total_m >= top && ((top = p.dist_total_m), true));
  const solAt = (dist) => {
    let lo = 0;
    let hi = wp.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (wp[mid].dist_total_m < dist) lo = mid + 1;
      else hi = mid;
    }
    return wp[lo].sol;
  };
  const d2 = new Decimator(6);
  let cum = 0;
  let prev = null;
  for (const f of msl.features) {
    if (!f.geometry) continue;
    for (const line of lines(f.geometry))
      for (const c of line) {
        if (prev) {
          const dx = (c[0] - prev[0]) * Math.cos((c[1] * Math.PI) / 180) * M_PER_DEG;
          cum += Math.hypot(dx, (c[1] - prev[1]) * M_PER_DEG);
        }
        prev = c;
        d2.add(c[0], c[1], solAt(cum));
      }
  }
  d2.flush();

  const flights = heli.features
    .filter((f) => f.geometry && f.properties?.Flight != null)
    .map((f) => {
      const d = new Decimator(2);
      for (const line of lines(f.geometry)) for (const c of line) d.add(c[0], c[1], 0);
      d.flush();
      return { n: f.properties.Flight, sol: f.properties.Sol, len: f.properties.Length_m, pts: d.out.flatMap((p) => [r6(p[0]), r6(p[1])]) };
    })
    .sort((a, b) => a.n - b.n);

  return {
    updated: new Date().toISOString(),
    // landing = sol 0 (mission clock: sol length 88 775.244 s)
    m20: track('2021-02-18T20:55:00Z', d1.out),
    msl: track('2012-08-06T05:17:00Z', d2.out),
    heli: { sol0: '2021-02-18T20:55:00Z', flights },
  };
}

if (process.argv[1] && process.argv[1].endsWith('mars-traverse.mjs')) {
  const out = process.argv[2] ?? 'public/data/mars-traverse.json';
  const data = await buildMarsTraverse();
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(data));
  console.log(`${out}: M20 ${data.m20.km} km / ${data.m20.sol.length} pts, MSL ${data.msl.km} km / ${data.msl.sol.length} pts, ${data.heli.flights.length} Ingenuity flights`);
}
