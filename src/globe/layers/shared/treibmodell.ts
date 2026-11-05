// Drift model ("Treibgut-Modell"): particles are released continuously at the river mouths (Meijer et al. 2021, weighted by
// their plastic emission) - in the "live" mode on top of a start distribution that follows the observed surface plastic
// (Eriksen et al. 2014, public/data/plastik/treibgut-seed.json, see scripts/treibgut-seed-build.py) - advected with a MEAN surface current field (NOAA/AOML drifter climatology, Laurindo et al. 2017)
// and collect in the subtropical gyres. Pure functions, no map and no DOM (tested in treibmodell.test.ts).
// Format of public/data/currents/mean.bin: see the head of scripts/currents-build.py.

export interface CurrentsMeta {
  version: number;
  credit: string;
  doi: string;
  license: string;
  source: string;
  nx: number;
  ny: number;
  /** degrees */
  step: number;
  /** longitude / latitude of the centre of cell [0][0] */
  lon0: number;
  lat0: number;
  /** value * 1/scale = m/s */
  scale: number;
  nodata: number;
}

export interface Field {
  nx: number;
  ny: number;
  step: number;
  lon0: number;
  lat0: number;
  scale: number;
  nodata: number;
  u: Int16Array;
  v: Int16Array;
}

/** mean earth radius (m) */
export const EARTH_R = 6371000;
export const DEG = Math.PI / 180;
/** seconds per simulated day: the time step of the model */
export const DAY_S = 86400;
/**
 * Horizontal eddy diffusivity (m²/s) of the unresolved motion (eddies, waves, wind variability). Without it the particles would
 * stick to streamlines. It is not applied as white noise (a new random kick every day made the tracks zigzag, the kicks were
 * several times larger than the daily drift of the mean current) but as a random flight (Ornstein-Uhlenbeck): every particle
 * carries an eddy velocity that fades with the Lagrangian time scale EDDY_TL and is fed by noise, K = sigma² T_L. On scales
 * beyond T_L this spreads the particles like a random walk with K, but the path in between is smooth, since the direction
 * changes over days, not from one step to the next. 400 m²/s is at the lower end of the surface ocean on scales of 100 km
 * (Okubo 1971: 10^3 to 10^4 for the whole turbulence spectrum; the mesoscale part of it is what a mean field misses, but the
 * mean field here is a 0.5° climatology that already carries some of it); with T_L = 4 days it gives sigma = 3.4 cm/s.
 */
export const DIFFUSIVITY = 400;
/** Lagrangian time scale of the eddy velocity (days): typical for mesoscale surface motion is 2 to 10 days */
export const EDDY_TL_DAYS = 4;
/**
 * Size of the particle pool (slots for particles in the sea). Most released particles strand within months or years at the coast
 * (a river mouth lies on the coast), so far fewer are in the sea at once; a stranded particle frees its slot. If the pool is full,
 * the oldest particle makes room, so the release never stops.
 */
export const PARTICLES = 8000;
export const BEACH = 1;
/**
 * Live mode (endless): the sea starts with LIVE_SEED particles spread like the observed plastic (Eriksen et al. 2014), then
 * LIVE_PER_DAY enter at the river mouths per day. The pool (PARTICLES) is the cap; if it is full, the oldest particle makes room.
 * 6 per day = 2,190 a year: visible as streams from the big rivers, and with the stranding of most of them (they start on the
 * coast) the gyres keep their filling. 6,000 of 8,000 slots at the start leave room for the first rivers' years.
 */
export const LIVE_SEED = 5000;
export const LIVE_PER_DAY = 8;
/** Run "10 Jahre ab leerem Meer": empty sea on day 0, a constant RUN_PER_DAY particles per day enter at the river mouths (21,900 in 10 years). */
export const RUN_PER_DAY = 6;
/**
 * Historic run ("Historisch ab 1950"): empty sea on day 0, particles released at the sources at a rate that follows the global plastic
 * production of the calendar year (see shared/treibhistorie.ts), plus a removal of particles in the sea (sinking, breakdown).
 */
export interface HistCfg {
  /** particles released on simulated day `day` (a fraction carries over to the next day) */
  rate: (day: number) => number;
  /** probability per day that a particle in the sea is removed (1 - exp(-1/(tau 365))) */
  decay: number;
}
/** how many cells further out than the nearest sea cell a river mouth may be moved to reach open water */
export const OFFSHORE_CELLS = 2;
/** how far (in cells) a river mouth may lie from the nearest sea cell of the field and still count as a source */
export const SNAP_CELLS = 4;

export function decodeField(buf: ArrayBuffer, meta: CurrentsMeta): Field {
  const n = meta.nx * meta.ny;
  if (buf.byteLength !== n * 4) throw new Error(`mean.bin: ${buf.byteLength} bytes, expected ${n * 4}`);
  // a copy: the buffer from a slice has no alignment guarantee
  const all = new Int16Array(buf.slice(0));
  return { nx: meta.nx, ny: meta.ny, step: meta.step, lon0: meta.lon0, lat0: meta.lat0, scale: meta.scale, nodata: meta.nodata, u: all.subarray(0, n), v: all.subarray(n, 2 * n) };
}

export const latMin = (f: Field) => f.lat0;
export const latMax = (f: Field) => f.lat0 + (f.ny - 1) * f.step;
const wrapLon = (lon: number) => ((((lon + 180) % 360) + 360) % 360) - 180;

/** is the cell nearest to the point sea (a value)? Latitudes beyond the grid are clamped to its edge row. */
export function isSea(f: Field, lon: number, lat: number): boolean {
  const j = Math.max(0, Math.min(f.ny - 1, Math.round((lat - f.lat0) / f.step)));
  const i = ((Math.round((wrapLon(lon) - f.lon0) / f.step) % f.nx) + f.nx) % f.nx;
  return f.u[j * f.nx + i] !== f.nodata;
}

/**
 * Velocity (m/s) at a point: bilinear between the four cell centres around it, longitudes periodic, latitudes clamped.
 * Corners without a value (land) drop out and the weights of the others are renormalised, so a point near the coast
 * still gets a current. null if all four are land.
 */
export function velocityAt(f: Field, lon: number, lat: number, out: [number, number] = [0, 0]): [number, number] | null {
  const y = Math.max(0, Math.min(f.ny - 1.000001, (lat - f.lat0) / f.step));
  const x = (wrapLon(lon) - f.lon0) / f.step;
  const j0 = Math.floor(y);
  const i0f = Math.floor(x);
  const fy = y - j0;
  const fx = x - i0f;
  const i0 = ((i0f % f.nx) + f.nx) % f.nx;
  const i1 = (i0 + 1) % f.nx;
  let su = 0;
  let sv = 0;
  let sw = 0;
  for (let c = 0; c < 4; c++) {
    const i = c & 1 ? i1 : i0;
    const j = j0 + (c >> 1);
    const idx = j * f.nx + i;
    if (f.u[idx] === f.nodata) continue;
    const w = (c & 1 ? fx : 1 - fx) * (c >> 1 ? fy : 1 - fy);
    su += w * f.u[idx];
    sv += w * f.v[idx];
    sw += w;
  }
  if (sw <= 0) return null;
  out[0] = su / sw / f.scale;
  out[1] = sv / sw / f.scale;
  return out;
}

/** a seedable generator whose state can be read and set (checkpoints of the historic run restore it) */
export interface Rng {
  (): number;
  get(): number;
  set(state: number): void;
}

/** seedable PRNG (mulberry32), uniform in [0, 1) */
export function rng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (() => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }) as Rng;
  next.get = () => a;
  next.set = (state) => {
    a = state >>> 0;
  };
  return next;
}

export interface Particles {
  count: number;
  /** degrees, -180..180 */
  lon: Float32Array;
  lat: Float32Array;
  /** 1 moving, 0 stranded (stays where it hit the coast) */
  alive: Uint8Array;
  /** eddy velocity (m/s, east / north) of each particle: the random part of its motion (see DIFFUSIVITY) */
  eu: Float32Array;
  ev: Float32Array;
}

export interface River {
  lon: number;
  lat: number;
  /** emission, t/year: the weight of the source */
  t: number;
}

/** the river mouths of public/data/plastik/rivers.geojson (Points, properties `t`); features without a usable point or t are skipped */
export function parseRivers(fc: { features?: { properties?: { t?: unknown } | null; geometry?: { type?: string; coordinates?: unknown } | null }[] }): River[] {
  const out: River[] = [];
  for (const ft of fc.features ?? []) {
    const c = ft.geometry?.type === 'Point' ? (ft.geometry.coordinates as number[] | undefined) : undefined;
    const t = Number(ft.properties?.t);
    if (c && Number.isFinite(c[0]) && Number.isFinite(c[1]) && t > 0) out.push({ lon: c[0], lat: c[1], t });
  }
  return out;
}

/** release points: centres of sea cells, with the cumulative emission of the river mouths snapped to them (for weighted picking) */
export interface Sources {
  lon: Float32Array;
  lat: Float32Array;
  /** cumulative weight (t/year), ascending; the last entry is the total */
  cum: Float64Array;
}

/** is the cell sea, and all eight around it too (not at the coast)? */
function openSea(f: Field, i: number, j: number): boolean {
  for (let dj = -1; dj <= 1; dj++)
    for (let di = -1; di <= 1; di++) {
      const jj = Math.max(0, Math.min(f.ny - 1, j + dj));
      if (f.u[jj * f.nx + ((((i + di) % f.nx) + f.nx) % f.nx)] === f.nodata) return false;
    }
  return true;
}

/**
 * Snap the river mouths to the field: each one moves to the nearest sea cell (in cells, Euclidean) within `maxCells`. Mouths lie on
 * the coast, often on a land cell of the coarse field. A cell that is not at the coast (all neighbours sea) wins over a closer one
 * at the coast, if there is one within `OFFSHORE_CELLS`: the plume of a river leaves the coast, and a particle that is released in
 * a coastal cell is on land after a few days of eddy motion (most would strand at once). Mouths with no sea cell nearby (inland
 * lakes, polar gaps) are dropped.
 */
export function buildSources(f: Field, rivers: River[], maxCells = SNAP_CELLS): Sources {
  const lon: number[] = [];
  const lat: number[] = [];
  const cum: number[] = [];
  let total = 0;
  for (const r of rivers) {
    const j0 = Math.round((r.lat - f.lat0) / f.step);
    const i0 = Math.round((wrapLon(r.lon) - f.lon0) / f.step);
    // nearest sea cell (any) and nearest open-sea cell, each as [i, j, squared distance]
    let near: [number, number, number] | null = null;
    let offshore: [number, number, number] | null = null;
    const reach = maxCells + OFFSHORE_CELLS;
    for (let dj = -reach; dj <= reach; dj++) {
      const j = j0 + dj;
      if (j < 0 || j >= f.ny) continue;
      for (let di = -reach; di <= reach; di++) {
        const d = di * di + dj * dj;
        if (d > reach * reach) continue;
        const i = (((i0 + di) % f.nx) + f.nx) % f.nx;
        if (f.u[j * f.nx + i] === f.nodata) continue;
        if (d <= maxCells * maxCells && (!near || d < near[2])) near = [i, j, d];
        if ((!offshore || d < offshore[2]) && openSea(f, i, j)) offshore = [i, j, d];
      }
    }
    if (!near) continue;
    // the open cell only if it is at most OFFSHORE_CELLS further out than the nearest sea cell
    const pick = offshore && Math.sqrt(offshore[2]) <= Math.sqrt(near[2]) + OFFSHORE_CELLS ? offshore : near;
    const best = pick[0];
    const bestJ = pick[1];
    total += r.t;
    lon.push(wrapLon(f.lon0 + best * f.step));
    lat.push(f.lat0 + bestJ * f.step);
    cum.push(total);
  }
  return { lon: Float32Array.from(lon), lat: Float32Array.from(lat), cum: Float64Array.from(cum) };
}

/** index of a source, chosen with probability proportional to its weight */
export function pickSource(src: Sources, random: () => number): number {
  const target = random() * src.cum[src.cum.length - 1];
  let lo = 0;
  let hi = src.cum.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (src.cum[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

const vel: [number, number] = [0, 0];
const mid: [number, number] = [0, 0];

/** two independent N(0,1) numbers from two uniform ones (Box-Muller) */
function gauss2(random: () => number, out: [number, number]) {
  const r = Math.sqrt(-2 * Math.log(1 - random()));
  const a = 2 * Math.PI * random();
  out[0] = r * Math.cos(a);
  out[1] = r * Math.sin(a);
}
const gz: [number, number] = [0, 0];

/** standard deviation (m/s) of the eddy velocity per component for the diffusivity K (m²/s) and time scale T_L (s): K = sigma² T_L */
export const eddySigma = (kdiff: number, tlSec: number) => Math.sqrt(Math.max(0, kdiff) / tlSec);

/** give slot `k` a fresh eddy velocity from the stationary distribution of the process (the particle is new or its slot is reused) */
function initEddy(p: Particles, k: number, sigma: number, random: () => number) {
  if (sigma > 0) {
    gauss2(random, gz);
    p.eu[k] = sigma * gz[0];
    p.ev[k] = sigma * gz[1];
  } else {
    p.eu[k] = 0;
    p.ev[k] = 0;
  }
}

/**
 * One time step of `dtSec` for all moving particles: the mean current by RK2 (midpoint) in degrees (dlon = u dt / (R cos φ),
 * dlat = v dt / R), plus the eddy velocity (u', v') of the particle, which is first advanced as an Ornstein-Uhlenbeck process,
 * u' <- u' exp(-dt/T_L) + sigma sqrt(1 - exp(-2 dt/T_L)) N(0,1), with sigma = sqrt(K / T_L) (`kdiff` = K in m²/s, `tlDays` = T_L);
 * the step uses the mean of the old and the new u' (so the path is smooth). K = 0 switches the eddies off. A particle that ends on
 * land (nearest cell without a value) or without a current is stranded: it stays at its last sea position and stops. Longitudes
 * wrap, latitudes are clamped to the grid. Returns the number of particles stranded in this step.
 */
export function stepParticles(f: Field, p: Particles, dtSec: number, random: () => number, kdiff = DIFFUSIVITY, beach = 1, tlDays = EDDY_TL_DAYS): number {
  const sigma = eddySigma(kdiff, tlDays * DAY_S);
  const decay = Math.exp(-dtSec / (tlDays * DAY_S));
  const kick = sigma * Math.sqrt(1 - decay * decay);
  const lo = latMin(f);
  const hi = latMax(f);
  let stranded = 0;
  for (let k = 0; k < p.count; k++) {
    if (!p.alive[k]) continue;
    const lon = p.lon[k];
    const lat = p.lat[k];
    const v1 = velocityAt(f, lon, lat, vel);
    if (!v1) {
      p.alive[k] = 0;
      stranded++;
      continue;
    }
    let eu = 0;
    let ev = 0;
    if (sigma > 0) {
      // the same two random numbers per particle and step as the old random walk (same order, so runs stay reproducible)
      gauss2(random, gz);
      const nu = p.eu[k] * decay + kick * gz[0];
      const nv = p.ev[k] * decay + kick * gz[1];
      eu = 0.5 * (p.eu[k] + nu);
      ev = 0.5 * (p.ev[k] + nv);
      p.eu[k] = nu;
      p.ev[k] = nv;
    }
    const cosLat = Math.max(0.05, Math.cos(lat * DEG));
    const half = 0.5 * dtSec;
    const midLon = lon + (v1[0] * half) / (EARTH_R * cosLat * DEG);
    const midLat = Math.max(lo, Math.min(hi, lat + (v1[1] * half) / (EARTH_R * DEG)));
    const v2 = velocityAt(f, midLon, midLat, mid) ?? v1;
    const dx = (v2[0] + eu) * dtSec;
    const dy = (v2[1] + ev) * dtSec;
    const nlon = wrapLon(lon + dx / (EARTH_R * cosLat * DEG));
    const nlat = Math.max(lo, Math.min(hi, lat + dy / (EARTH_R * DEG)));
    if (!isSea(f, nlon, nlat)) {
      // lands on the coast: stays there for good, or (probability 1 - beach) is held back at sea and tries again tomorrow
      if (beach >= 1 || random() < beach) {
        p.alive[k] = 0;
        stranded++;
      }
      continue;
    }
    p.lon[k] = nlon;
    p.lat[k] = nlat;
  }
  return stranded;
}

export interface Sim {
  field: Field;
  sources: Sources;
  /** the pool: slots 0..count-1 (only the moving particles are in it; a stranded one frees its slot) */
  p: Particles;
  /** 1 = the slot holds a moving particle, 0 = free (alive is 1 only for these) */
  active: Uint8Array;
  /** slots that were used before (their trail must be wiped when they are used again) */
  used: Uint8Array;
  /** free slots (stack) */
  free: number[];
  /** slots that were released into in the last stepDay and had been used before */
  reused: number[];
  random: Rng;
  seedValue: number;
  /** simulated days since the start of the run */
  day: number;
  /** particles released so far in the run */
  released: number;
  /** particles in the sea (moving) */
  moving: number;
  /** particles stranded so far in the run (they are no longer in the pool: they are gone from the picture, the count stays) */
  stranded: number;
  kdiff: number;
  /** probability that a particle that reaches the coast stays stranded */
  beach: number;
  /** particles released per simulated day (fractions carry over) */
  perDay: number;
  /** age order: release number of the particle in the slot (the seeded ones of the live mode are negative, random) */
  born: Float64Array;
  /** particles seeded at the start of a live run */
  seeded: number;
  /** particles removed because the pool was full (the oldest) */
  evicted: number;
  /** historic run: the release rate and the removal; null in the other modes */
  hist: HistCfg | null;
  /** historic run: fraction of a particle released but not yet whole (carries over from day to day) */
  relAcc: number;
  /** historic run: particles removed by the decay so far */
  decayed: number;
}

/** a run with an empty sea: no particle exists at day 0, they enter at the sources day by day (stepDay) */
export function createSim(field: Field, sources: Sources, count = PARTICLES, seedValue = 1, kdiff = DIFFUSIVITY, perDay = LIVE_PER_DAY): Sim {
  const sim: Sim = {
    field,
    sources,
    p: { count, lon: new Float32Array(count), lat: new Float32Array(count), alive: new Uint8Array(count), eu: new Float32Array(count), ev: new Float32Array(count) },
    active: new Uint8Array(count),
    used: new Uint8Array(count),
    born: new Float64Array(count),
    seeded: 0,
    evicted: 0,
    hist: null,
    relAcc: 0,
    decayed: 0,
    free: [],
    reused: [],
    random: rng(seedValue),
    seedValue,
    day: 0,
    released: 0,
    moving: 0,
    stranded: 0,
    kdiff,
    beach: BEACH,
    perDay,
  };
  resetPool(sim);
  return sim;
}

function resetPool(sim: Sim) {
  const n = sim.p.count;
  sim.p.lon.fill(0);
  sim.p.lat.fill(0);
  sim.p.alive.fill(0);
  sim.p.eu.fill(0);
  sim.p.ev.fill(0);
  sim.active.fill(0);
  sim.used.fill(0);
  sim.born.fill(0);
  sim.seeded = 0;
  sim.evicted = 0;
  sim.relAcc = 0;
  sim.decayed = 0;
  sim.reused.length = 0;
  // popped from the end: slot 0 is taken first
  sim.free = Array.from({ length: n }, (_, k) => n - 1 - k);
  sim.day = 0;
  sim.released = 0;
  sim.moving = 0;
  sim.stranded = 0;
}

/** new run (empty sea, new random numbers: the seed counts up) */
export function restart(sim: Sim, seedValue = sim.seedValue + 1) {
  sim.random = rng(seedValue);
  sim.seedValue = seedValue;
  resetPool(sim);
}

/** Release `n` particles at sources picked by weight (a random point inside the cell). Full pool: the oldest particle leaves. */
export function releaseParticles(sim: Sim, n: number) {
  const { sources, p, field: f } = sim;
  if (!sources.cum.length) return;
  for (let k = 0; k < n; k++) {
    let slot = sim.free.pop();
    if (slot === undefined) {
      // no free slot: the sea is full, the oldest particle leaves
      slot = oldestSlot(sim);
      sim.moving--;
      sim.evicted++;
    }
    if (sim.used[slot]) sim.reused.push(slot);
    sim.used[slot] = 1;
    sim.born[slot] = sim.released;
    const s = pickSource(sources, sim.random);
    p.lon[slot] = wrapLon(sources.lon[s] + (sim.random() - 0.5) * f.step);
    p.lat[slot] = sources.lat[s] + (sim.random() - 0.5) * f.step;
    initEddy(p, slot, eddySigma(sim.kdiff, EDDY_TL_DAYS * DAY_S), sim.random);
    p.alive[slot] = 1;
    sim.active[slot] = 1;
    sim.moving++;
    sim.released++;
  }
}

/** slot of the oldest moving particle (smallest `born`); linear scan, only when the pool is full (a few per day) */
function oldestSlot(sim: Sim): number {
  const { born, active } = sim;
  let best = 0;
  let min = Infinity;
  for (let k = 0; k < born.length; k++)
    if (active[k] && born[k] < min) {
      min = born[k];
      best = k;
    }
  return best;
}

/** the start distribution: 1° cells with a weight (pieces), as in public/data/plastik/treibgut-seed.json */
export interface SeedMeta {
  version: number;
  credit: string;
  license: string;
  source: string;
  step: number;
  lon0: number;
  lat0: number;
  nx: number;
  ny: number;
  /** log10 of the weight for byte 1 and byte 255 */
  lo: number;
  hi: number;
  /** base64 of nx * ny bytes, 0 = no weight */
  data: string;
}
export interface Seed {
  step: number;
  /** centres of the cells with a weight */
  lon: Float32Array;
  lat: Float32Array;
  /** cumulative weight, ascending; the last entry is the total */
  cum: Float64Array;
}

/** decode the seed file into the cells with a weight (cumulative, for weighted picking) */
export function parseSeed(meta: SeedMeta): Seed {
  const raw = atob(meta.data);
  if (raw.length !== meta.nx * meta.ny) throw new Error(`treibgut-seed: ${raw.length} bytes, expected ${meta.nx * meta.ny}`);
  const lon: number[] = [];
  const lat: number[] = [];
  const cum: number[] = [];
  let total = 0;
  const span = (meta.hi - meta.lo) / 254;
  for (let j = 0; j < meta.ny; j++)
    for (let i = 0; i < meta.nx; i++) {
      const q = raw.charCodeAt(j * meta.nx + i);
      if (!q) continue;
      total += Math.pow(10, meta.lo + (q - 1) * span);
      lon.push(wrapLon(meta.lon0 + i * meta.step));
      lat.push(meta.lat0 + j * meta.step);
      cum.push(total);
    }
  return { step: meta.step, lon: Float32Array.from(lon), lat: Float32Array.from(lat), cum: Float64Array.from(cum) };
}

/** nearest sea cell centre to a point within `maxCells` cells (Euclidean), null if there is none */
export function snapToSea(f: Field, lon: number, lat: number, maxCells = SNAP_CELLS): [number, number] | null {
  const j0 = Math.round((lat - f.lat0) / f.step);
  const i0 = Math.round((wrapLon(lon) - f.lon0) / f.step);
  let best: [number, number] | null = null;
  let bd = Infinity;
  for (let dj = -maxCells; dj <= maxCells; dj++) {
    const j = j0 + dj;
    if (j < 0 || j >= f.ny) continue;
    for (let di = -maxCells; di <= maxCells; di++) {
      const d = di * di + dj * dj;
      if (d > maxCells * maxCells || d >= bd) continue;
      const i = (((i0 + di) % f.nx) + f.nx) % f.nx;
      if (f.u[j * f.nx + i] === f.nodata) continue;
      bd = d;
      best = [wrapLon(f.lon0 + i * f.step), f.lat0 + j * f.step];
    }
  }
  return best;
}

/**
 * Fill the pool with `n` particles spread like the seed: a cell is picked by weight, the point is random inside it; on land it is
 * tried again a few times, then moved to the nearest sea cell (cells without sea nearby are skipped). The ages are random (negative
 * `born`), so in a full pool they leave one by one in random order and not all at once.
 */
export function seedParticles(sim: Sim, seed: Seed, n: number) {
  const { p, field: f } = sim;
  const total = seed.cum[seed.cum.length - 1];
  if (!seed.cum.length || !(total > 0)) return;
  let placed = 0;
  for (let tries = 0; placed < n && tries < n * 4; tries++) {
    // pick a cell by weight
    const target = sim.random() * total;
    let lo = 0;
    let hi = seed.cum.length - 1;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (seed.cum[m] < target) lo = m + 1;
      else hi = m;
    }
    let lon = 0;
    let lat = 0;
    let ok = false;
    for (let a = 0; a < 6 && !ok; a++) {
      lon = wrapLon(seed.lon[lo] + (sim.random() - 0.5) * seed.step);
      lat = seed.lat[lo] + (sim.random() - 0.5) * seed.step;
      ok = isSea(f, lon, lat);
    }
    if (!ok) {
      const s = snapToSea(f, lon, lat);
      if (!s) continue;
      [lon, lat] = s;
    }
    const slot = sim.free.pop();
    if (slot === undefined) break;
    sim.used[slot] = 1;
    sim.born[slot] = -1 - sim.random() * n;
    p.lon[slot] = lon;
    p.lat[slot] = lat;
    initEddy(p, slot, eddySigma(sim.kdiff, EDDY_TL_DAYS * DAY_S), sim.random);
    p.alive[slot] = 1;
    sim.active[slot] = 1;
    sim.moving++;
    placed++;
  }
  sim.seeded += placed;
}

/** new live run: random numbers from `seedValue`, empty pool, then `n` particles seeded from the distribution */
export function restartLive(sim: Sim, seed: Seed, n = LIVE_SEED, seedValue = sim.seedValue, perDay = LIVE_PER_DAY) {
  restart(sim, seedValue);
  sim.hist = null;
  sim.perDay = perDay;
  seedParticles(sim, seed, Math.min(n, sim.p.count));
}

/** new run "10 Jahre ab leerem Meer": empty sea, constant release at the sources, no removal besides stranding and a full pool */
export function restartRun(sim: Sim, seedValue = sim.seedValue, perDay = RUN_PER_DAY) {
  restart(sim, seedValue);
  sim.hist = null;
  sim.perDay = perDay;
}

/** new historic run: empty sea, release and removal after `cfg`; a full pool lets the oldest particle go (like live) */
export function restartHist(sim: Sim, cfg: HistCfg, seedValue = sim.seedValue) {
  restart(sim, seedValue);
  sim.hist = cfg;
  sim.perDay = 0;
}

/** particles released by the end of simulated day `day` */
export const releasedBy = (day: number, perDay = LIVE_PER_DAY) => Math.floor(day * perDay);

/**
 * One day: move the particles (a stranded one frees its slot), then release the new ones (they start moving on the next day).
 * Returns the number released; the slots that were used before are in `sim.reused`.
 */
export function stepDay(sim: Sim): number {
  const n0 = stepParticles(sim.field, sim.p, DAY_S, sim.random, sim.kdiff, sim.beach);
  if (n0 > 0) {
    const { alive } = sim.p;
    for (let k = 0; k < alive.length; k++)
      if (sim.active[k] && !alive[k]) {
        sim.active[k] = 0;
        sim.free.push(k);
      }
    sim.stranded += n0;
    sim.moving -= n0;
  }
  const h = sim.hist;
  if (h) removeDecayed(sim, h.decay);
  sim.day += 1;
  sim.reused.length = 0;
  let n: number;
  if (h) {
    // the rate of the day that just ended; the fraction left over carries into the next day
    sim.relAcc += Math.max(0, h.rate(sim.day - 1));
    n = Math.floor(sim.relAcc);
    sim.relAcc -= n;
  } else n = Math.max(0, releasedBy(sim.day, sim.perDay) - releasedBy(sim.day - 1, sim.perDay));
  if (n > 0) releaseParticles(sim, n);
  return n;
}

/**
 * Removes particles from the sea with probability `p` each (sinking, breakdown below the net limit): the number is drawn once
 * (moving * p, rounded up or down at random), the particles are picked at random, so a day costs a few random numbers, not one per particle.
 */
function removeDecayed(sim: Sim, p: number) {
  const k = Math.floor(sim.moving * p + sim.random());
  const n = sim.p.count;
  for (let r = 0; r < k && sim.moving > 0; r++) {
    // a few random tries (fast when the pool is well filled), then a scan from a random slot (a sparse pool)
    let slot = -1;
    for (let tries = 0; tries < 16 && slot < 0; tries++) {
      const c = Math.floor(sim.random() * n);
      if (sim.active[c]) slot = c;
    }
    if (slot < 0) {
      const c0 = Math.floor(sim.random() * n);
      for (let i = 0; i < n; i++) {
        const c = (c0 + i) % n;
        if (sim.active[c]) {
          slot = c;
          break;
        }
      }
    }
    if (slot < 0) break;
    sim.active[slot] = 0;
    sim.p.alive[slot] = 0;
    sim.free.push(slot);
    sim.moving--;
    sim.decayed++;
  }
}

/** moving particles: the ones that are drawn */
export const movingCount = (sim: Sim) => sim.moving;
/** share of the particles of this run that have stranded (those that were recycled out of a full sea do not count) */
export const strandedShare = (sim: Sim) => (sim.stranded + sim.moving ? sim.stranded / (sim.stranded + sim.moving) : 0);

export interface Box {
  lonMin: number;
  lonMax: number;
  latMin: number;
  latMax: number;
}

/** fraction of the sea area (cos latitude weights) of the field that lies in the box */
export function areaShare(f: Field, b: Box): number {
  let all = 0;
  let inside = 0;
  for (let j = 0; j < f.ny; j++) {
    const lat = f.lat0 + j * f.step;
    const w = Math.cos(lat * DEG);
    for (let i = 0; i < f.nx; i++) {
      if (f.u[j * f.nx + i] === f.nodata) continue;
      all += w;
      const lon = f.lon0 + i * f.step;
      if (lat >= b.latMin && lat <= b.latMax && lon >= b.lonMin && lon <= b.lonMax) inside += w;
    }
  }
  return inside / all;
}

/** fraction of the moving particles that is in the box */
export function particleShare(p: Particles, b: Box): number {
  let n = 0;
  let inside = 0;
  for (let k = 0; k < p.count; k++) {
    if (!p.alive[k]) continue;
    n++;
    if (p.lat[k] >= b.latMin && p.lat[k] <= b.latMax && p.lon[k] >= b.lonMin && p.lon[k] <= b.lonMax) inside++;
  }
  return n ? inside / n : 0;
}
