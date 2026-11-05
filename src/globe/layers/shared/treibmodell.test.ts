import { describe, expect, it } from 'vitest';
import metaJson from '../../../../public/data/currents/meta.json';
import {
  areaShare,
  buildSources,
  createSim,
  DAY_S,
  decodeField,
  DIFFUSIVITY,
  eddySigma,
  EARTH_R,
  isSea,
  LIVE_PER_DAY,
  LIVE_SEED,
  movingCount,
  parseRivers,
  parseSeed,
  particleShare,
  pickSource,
  PARTICLES,
  releasedBy,
  restart,
  restartLive,
  restartRun,
  RUN_PER_DAY,
  seedParticles,
  snapToSea,
  rng,
  stepDay,
  stepParticles,
  strandedShare,
  velocityAt,
  type Box,
  type CurrentsMeta,
  type Field,
  type Particles,
  type River,
  type Seed,
  type SeedMeta,
  type Sources,
} from './treibmodell';

const meta = metaJson as unknown as CurrentsMeta;
const NODATA = -32768;

/** synthetic field: 1° cells, lon -179.5..179.5, lat -89.5..89.5, current (u, v) in m/s everywhere except `land` */
function flat(u: number, v: number, land: (i: number, j: number) => boolean = () => false): Field {
  const nx = 360;
  const ny = 180;
  const uu = new Int16Array(nx * ny);
  const vv = new Int16Array(nx * ny);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      uu[k] = land(i, j) ? NODATA : Math.round(u * 1000);
      vv[k] = land(i, j) ? NODATA : Math.round(v * 1000);
    }
  return { nx, ny, step: 1, lon0: -179.5, lat0: -89.5, scale: 1000, nodata: NODATA, u: uu, v: vv };
}
const one = (lon: number, lat: number): Particles => ({ count: 1, lon: Float32Array.of(lon), lat: Float32Array.of(lat), alive: Uint8Array.of(1), eu: new Float32Array(1), ev: new Float32Array(1) });

async function realBytes() {
  // the tests run in node; the project has no node types
  // @ts-ignore
  const { readFileSync } = (await import('node:fs')) as { readFileSync(url: URL): Uint8Array & { buffer: ArrayBuffer; byteOffset: number; byteLength: number } };
  const file = readFileSync(new URL('../../../../public/data/currents/mean.bin', import.meta.url));
  return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
}

async function realRivers() {
  // @ts-ignore
  const { readFileSync } = (await import('node:fs')) as { readFileSync(url: URL, enc: string): string };
  return parseRivers(JSON.parse(readFileSync(new URL('../../../../public/data/plastik/rivers.geojson', import.meta.url), 'utf8')));
}
/** two sources on the flat field: a small one at 10°E and a big one (9x the weight) at 100°W */
const twoSources = (f: Field): Sources => buildSources(f, [{ lon: 10.2, lat: 5.1, t: 100 }, { lon: -100.2, lat: -20.1, t: 900 }]);

describe('decodeField', () => {
  it('rejects a file of the wrong size', () => {
    expect(() => decodeField(new ArrayBuffer(10), meta)).toThrow();
  });
});

describe('velocityAt', () => {
  it('is the value of a uniform field', () => {
    const v = velocityAt(flat(0.3, -0.2), 12.3, 45.6)!;
    expect(v[0]).toBeCloseTo(0.3, 3);
    expect(v[1]).toBeCloseTo(-0.2, 3);
  });
  it('interpolates between cell centres and wraps the longitude', () => {
    const f = flat(0, 0);
    // east-west gradient: u = 0 in the cell at -179.5 and 1 m/s in the cell at 179.5 (neighbours across the date line)
    for (let j = 0; j < f.ny; j++) f.u[j * f.nx + f.nx - 1] = 1000;
    const v = velocityAt(f, 180, 0)!;
    expect(v[0]).toBeCloseTo(0.5, 2);
    expect(velocityAt(f, -180, 0)![0]).toBeCloseTo(0.5, 2);
  });
  it('renormalises over the corners that are sea, null if all are land', () => {
    const f = flat(0.4, 0, (i) => i === 100);
    // between cell 99 (sea) and 100 (land)
    expect(velocityAt(f, f.lon0 + 99.5, 0)![0]).toBeCloseTo(0.4, 3);
    expect(velocityAt(f, f.lon0 + 99.9, 0)![0]).toBeCloseTo(0.4, 3);
    const all = flat(0.4, 0, () => true);
    expect(velocityAt(all, 0, 0)).toBeNull();
  });
  it('clamps the latitude at the edge of the grid', () => {
    expect(velocityAt(flat(0.1, 0), 0, 95)![0]).toBeCloseTo(0.1, 3);
  });
});

describe('isSea', () => {
  it('looks at the nearest cell', () => {
    const f = flat(0, 0, (i, j) => i === 180 && j === 90); // cell centre 0.5, 0.5
    expect(isSea(f, 0.4, 0.4)).toBe(false);
    expect(isSea(f, 1.4, 0.4)).toBe(true);
    expect(isSea(f, 0.4, 1.4)).toBe(true);
  });
});

describe('rng', () => {
  it('is deterministic and uniform', () => {
    const a = rng(5);
    const b = rng(5);
    let sum = 0;
    for (let i = 0; i < 2000; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      sum += x;
    }
    expect(sum / 2000).toBeCloseTo(0.5, 1);
    expect(rng(6)()).not.toBe(rng(5)());
  });
});

describe('sources', () => {
  it('parses the river features and skips broken ones', () => {
    const rivers = parseRivers({
      features: [
        { properties: { t: 10 }, geometry: { type: 'Point', coordinates: [1, 2] } },
        { properties: { t: 0 }, geometry: { type: 'Point', coordinates: [1, 2] } },
        { properties: { t: 5 }, geometry: { type: 'LineString', coordinates: [] } },
        { properties: null, geometry: null },
      ],
    });
    expect(rivers).toEqual([{ lon: 1, lat: 2, t: 10 }]);
  });
  it('snaps a mouth on a land cell to the nearest sea cell and drops one that is too far inland', () => {
    // land from lon 0 to 20 (cells 180..199); a mouth at 1.2° E goes to the sea west of the coast, 10° inland there is nothing within 4 cells
    const f = flat(0, 0, (i) => i >= 180 && i < 200);
    const src = buildSources(f, [{ lon: 1.2, lat: 0.5, t: 1 }, { lon: 10, lat: 0.5, t: 1 }]);
    expect(src.lon.length).toBe(1);
    expect(isSea(f, src.lon[0], src.lat[0])).toBe(true);
    expect(src.lon[0]).toBeLessThan(0);
    expect(src.lon[0]).toBeGreaterThan(-3);
  });
  it('prefers open water (no land in the eight neighbours) a little further out over a cell at the coast', () => {
    const f = flat(0, 0, (i) => i >= 180);
    const src = buildSources(f, [{ lon: 0.2, lat: 0.5, t: 1 }]);
    // the cell at -0.5 touches the land: the source is at least one cell further out
    expect(src.lon[0]).toBeLessThanOrEqual(-1.5);
    expect(src.lon[0]).toBeGreaterThanOrEqual(-3);
  });
  it('keeps a mouth that is on a sea cell where it is (cell centre)', () => {
    const f = flat(0, 0);
    const src = buildSources(f, [{ lon: 10.2, lat: 5.1, t: 3 }]);
    expect(src.lon[0]).toBeCloseTo(10.5, 5);
    expect(src.lat[0]).toBeCloseTo(5.5, 5);
    expect(src.cum[0]).toBe(3);
  });
  it('picks sources in proportion to their weight', () => {
    const src = twoSources(flat(0, 0));
    const random = rng(11);
    let big = 0;
    const n = 10000;
    for (let k = 0; k < n; k++) if (pickSource(src, random) === 1) big++;
    expect(big / n).toBeGreaterThan(0.87);
    expect(big / n).toBeLessThan(0.93);
  });
  it('real river mouths: almost all find a sea cell, and every source is a sea cell', async () => {
    const f = decodeField(await realBytes(), meta);
    const rivers = await realRivers();
    const src = buildSources(f, rivers);
    expect(rivers.length).toBeGreaterThan(1000);
    expect(src.lon.length / rivers.length).toBeGreaterThan(0.9);
    for (let k = 0; k < src.lon.length; k++) expect(isSea(f, src.lon[k], src.lat[k])).toBe(true);
    // the weight is kept (mouths that are dropped are tiny or inland)
    const total = rivers.reduce((a: number, r: River) => a + r.t, 0);
    expect(src.cum[src.cum.length - 1] / total).toBeGreaterThan(0.9);
  });
});

describe('stepParticles', () => {
  it('moves with the current: 1 m/s east at the equator = u dt / R in degrees', () => {
    const f = flat(1, 0);
    const p = one(10, 0);
    stepParticles(f, p, DAY_S, rng(1), 0);
    expect(p.lon[0] - 10).toBeCloseTo((DAY_S / EARTH_R) * (180 / Math.PI), 3);
    expect(p.lat[0]).toBeCloseTo(0, 5);
  });
  it('divides by cos latitude for the longitude', () => {
    const f = flat(1, 0);
    const p = one(10, 60);
    stepParticles(f, p, DAY_S, rng(1), 0);
    expect(p.lon[0] - 10).toBeCloseTo(2 * (DAY_S / EARTH_R) * (180 / Math.PI), 2);
  });
  it('RK2 follows the curvature of the field better than Euler', () => {
    // solid-body-like: u grows with latitude, v = 0 -> pure shear, RK2 equals the exact result for a linear field
    const f = flat(0, 0);
    for (let j = 0; j < f.ny; j++) for (let i = 0; i < f.nx; i++) f.v[j * f.nx + i] = 500; // 0.5 m/s north
    for (let j = 0; j < f.ny; j++) for (let i = 0; i < f.nx; i++) f.u[j * f.nx + i] = Math.round((f.lat0 + j) * 10); // 0.01 m/s per degree
    const p = one(0, 10);
    stepParticles(f, p, DAY_S, rng(1), 0);
    const dlat = (0.5 * DAY_S) / EARTH_R / (Math.PI / 180);
    expect(p.lat[0]).toBeCloseTo(10 + dlat, 4);
    // u in the middle of the step: 0.1 + 0.01 * dlat / 2 (m/s), a little more than the start value
    const u = (10 + dlat / 2) * 0.01;
    expect(p.lon[0]).toBeCloseTo(((u * DAY_S) / (EARTH_R * Math.cos((10 + dlat / 2) * (Math.PI / 180)))) * (180 / Math.PI), 2);
  });
  it('wraps the longitude over the date line', () => {
    const p = one(179.9, 0);
    stepParticles(flat(1, 0), p, DAY_S, rng(1), 0);
    expect(p.lon[0]).toBeLessThan(-178);
    expect(p.alive[0]).toBe(1);
  });
  it('clamps at the pole edge of the grid', () => {
    const p = one(0, 89);
    stepParticles(flat(0, 2), p, 10 * DAY_S, rng(1), 0);
    expect(p.lat[0]).toBeLessThanOrEqual(89.5);
  });
  it('strands a particle on land: it stays at the last sea position and stops', () => {
    const f = flat(1, 0, (i) => i >= 182); // land from lon 2° on
    const p = one(1.5, 0);
    stepParticles(f, p, 3 * DAY_S, rng(1), 0);
    expect(p.alive[0]).toBe(0);
    expect(p.lon[0]).toBe(1.5);
    const n = stepParticles(f, p, DAY_S, rng(1), 0);
    expect(n).toBe(0);
    expect(p.lon[0]).toBe(1.5);
  });
  it('eddy velocity: stationary spread sigma = sqrt(K / T_L), correlated over T_L, spread of positions grows like sqrt(2 K t) for t >> T_L', () => {
    const f = flat(0, 0);
    const n = 3000;
    const K = 400;
    const tl = 4;
    const sigma = eddySigma(K, tl * DAY_S);
    const p: Particles = { count: n, lon: new Float32Array(n), lat: new Float32Array(n), alive: new Uint8Array(n).fill(1), eu: new Float32Array(n), ev: new Float32Array(n) };
    const random = rng(9);
    // start from the stationary distribution (as a release does)
    for (let k = 0; k < n; k++) {
      const r = Math.sqrt(-2 * Math.log(1 - random()));
      const a = 2 * Math.PI * random();
      p.eu[k] = sigma * r * Math.cos(a);
      p.ev[k] = sigma * r * Math.sin(a);
    }
    const rms = (arr: Float32Array) => Math.sqrt(arr.reduce((s, x) => s + x * x, 0) / n);
    expect(rms(p.eu)).toBeGreaterThan(sigma * 0.93);
    expect(rms(p.eu)).toBeLessThan(sigma * 1.07);
    const u0 = p.eu.slice();
    stepParticles(f, p, DAY_S, random, K, 1, tl);
    // still stationary after a step, and the velocity of the next day is correlated with that of today (exp(-1/4) = 0.78)
    expect(rms(p.eu)).toBeGreaterThan(sigma * 0.93);
    expect(rms(p.eu)).toBeLessThan(sigma * 1.07);
    let c = 0;
    for (let k = 0; k < n; k++) c += u0[k] * p.eu[k];
    expect(c / n / (sigma * sigma)).toBeGreaterThan(0.7);
    expect(c / n / (sigma * sigma)).toBeLessThan(0.86);
    // 200 days later (>> T_L): zero mean, spread per component about sqrt(2 K t)
    for (let d = 0; d < 199; d++) stepParticles(f, p, DAY_S, random, K, 1, tl);
    let sx = 0;
    let sxx = 0;
    for (let k = 0; k < n; k++) {
      const x = ((p.lon[k] * Math.PI) / 180) * EARTH_R; // equator
      sx += x;
      sxx += x * x;
    }
    const spread = Math.sqrt(2 * K * 200 * DAY_S);
    expect(Math.abs(sx / n)).toBeLessThan(spread * 0.1);
    expect(Math.sqrt(sxx / n)).toBeGreaterThan(spread * 0.85);
    expect(Math.sqrt(sxx / n)).toBeLessThan(spread * 1.15);
  });
  it('the path is smooth: the day-to-day change of direction is small compared with white noise of the same diffusivity', () => {
    const f = flat(0, 0);
    const p = one(0, 0);
    p.eu[0] = 0.03;
    const random = rng(3);
    let prev: [number, number] | null = null;
    let sum = 0;
    let cnt = 0;
    for (let d = 0; d < 300; d++) {
      const x0 = p.lon[0];
      const y0 = p.lat[0];
      stepParticles(f, p, DAY_S, random, DIFFUSIVITY);
      const dx = p.lon[0] - x0;
      const dy = p.lat[0] - y0;
      if (prev && Math.hypot(dx, dy) > 0 && Math.hypot(...prev) > 0) {
        sum += Math.acos(Math.max(-1, Math.min(1, (dx * prev[0] + dy * prev[1]) / (Math.hypot(dx, dy) * Math.hypot(...prev)))));
        cnt++;
      }
      prev = [dx, dy];
    }
    // white noise: the mean angle between successive steps is 90 degrees
    expect((sum / cnt) * (180 / Math.PI)).toBeLessThan(50);
  });
  it('a particle is deterministic with the same random numbers; K = 0 leaves the eddy velocity alone', () => {
    const f = flat(0.1, 0);
    const a = one(0, 0);
    const b = one(0, 0);
    a.eu[0] = b.eu[0] = 0.02;
    for (let d = 0; d < 20; d++) {
      stepParticles(f, a, DAY_S, rng(d), 400);
      stepParticles(f, b, DAY_S, rng(d), 400);
    }
    expect(a.lon[0]).toBe(b.lon[0]);
    expect(a.lat[0]).toBe(b.lat[0]);
    const c = one(0, 0);
    c.eu[0] = 0.5;
    stepParticles(f, c, DAY_S, rng(1), 0);
    expect(c.eu[0]).toBe(0.5);
    // K = 0: the eddy velocity plays no role, pure mean flow
    const d0 = one(0, 0);
    stepParticles(f, d0, DAY_S, rng(1), 0);
    expect(d0.lon[0]).toBeCloseTo(((0.1 * DAY_S) / EARTH_R) * (180 / Math.PI) , 4);
  });
});

describe('Sim', () => {
  it('has no particle in the sea at day 0', () => {
    const f = flat(0.1, 0.05);
    const sim = createSim(f, twoSources(f), 200, 4, 1000);
    expect(sim.day).toBe(0);
    expect(sim.released).toBe(0);
    expect(movingCount(sim)).toBe(0);
    expect(sim.active.reduce((a, b) => a + b, 0)).toBe(0);
    expect(Array.from(sim.p.alive).reduce((a, b) => a + b, 0)).toBe(0);
    expect(strandedShare(sim)).toBe(0);
  });
  it('releases a constant number per day: after N days the expected count is in the sea', () => {
    expect(releasedBy(0, 2.5)).toBe(0);
    expect(releasedBy(10, 2.5)).toBe(25);
    const f = flat(0.1, 0.05);
    const sim = createSim(f, twoSources(f), 1000, 4, 1000, 2.5);
    let total = 0;
    for (let d = 1; d <= 100; d++) {
      total += stepDay(sim);
      expect(sim.released).toBe(total);
    }
    expect(sim.released).toBe(250);
    expect(movingCount(sim)).toBe(250);
    expect(sim.active.reduce((a, b) => a + b, 0)).toBe(250);
    expect(sim.stranded).toBe(0);
  });
  it('recycles a slot when the pool is full, and reports slots that are used again', () => {
    const f = flat(0.1, 0.05);
    const sim = createSim(f, twoSources(f), 10, 4, 1000, 1);
    for (let d = 1; d <= 10; d++) {
      stepDay(sim);
      expect(sim.reused).toEqual([]);
    }
    expect(movingCount(sim)).toBe(10);
    stepDay(sim);
    // full: the next release takes over a slot (the cursor starts at 0)
    expect(movingCount(sim)).toBe(10);
    expect(sim.reused).toEqual([0]);
    expect(sim.released).toBe(11);
  });
  it('a stranded particle frees its slot and is counted, a new one can take it (and is reported as reused)', () => {
    // 1 m/s east, land from lon 2 on: every particle of the source at 10 E would be on land... use a source at -3 E, the coast is 5 degrees away
    const f = flat(1, 0, (i) => i >= 182 && i < 190);
    const src = buildSources(f, [{ lon: -1.2, lat: 0.5, t: 1 }]);
    const sim = createSim(f, src, 50, 3, 0, 1);
    let reused = 0;
    for (let d = 0; d < 20; d++) {
      stepDay(sim);
      reused += sim.reused.length;
    }
    expect(sim.stranded).toBeGreaterThan(0);
    expect(sim.stranded + sim.moving).toBe(sim.released);
    expect(movingCount(sim)).toBe(sim.active.reduce((a, b) => a + b, 0));
    expect(strandedShare(sim)).toBeGreaterThan(0.5);
    expect(reused).toBeGreaterThan(0);
    // stranded particles are not in the pool any more
    for (let k = 0; k < 50; k++) expect(sim.active[k] === 1).toBe(sim.p.alive[k] === 1);
  });
  it('a new particle gets a fresh eddy velocity (also in a reused slot), none without diffusivity', () => {
    const f = flat(0, 0);
    const sim = createSim(f, twoSources(f), 10, 4, 400, 1);
    for (let d = 0; d < 10; d++) stepDay(sim);
    sim.p.eu.fill(99);
    sim.p.ev.fill(99);
    stepDay(sim);
    // the slot released into now (the cursor: slot 0) is re-drawn, so it is no longer 99 and of the order of sigma (3 cm/s)
    expect(Math.abs(sim.p.eu[0])).toBeLessThan(0.3);
    const calm = createSim(f, twoSources(f), 10, 4, 0, 1);
    stepDay(calm);
    expect(calm.p.eu[0]).toBe(0);
  });
  it('releases at the sources only (a new particle sits in a source cell)', () => {
    const f = flat(0, 0);
    const sim = createSim(f, twoSources(f), 1000, 4, 0, 10);
    stepDay(sim);
    expect(sim.released).toBe(10);
    for (let k = 0; k < sim.released; k++) {
      const near10 = Math.abs(sim.p.lon[k] - 10.5) <= 0.5 && Math.abs(sim.p.lat[k] - 5.5) <= 0.5;
      const near100 = Math.abs(sim.p.lon[k] + 100.5) <= 0.5 && Math.abs(sim.p.lat[k] + 20.5) <= 0.5;
      expect(near10 || near100).toBe(true);
    }
  });
  it('is deterministic with a seed; restart empties the sea and runs anew', () => {
    const f = flat(0.1, 0.05);
    const make = () => createSim(f, twoSources(f), 2000, 4, 1000, 3);
    const a = make();
    const b = make();
    for (let d = 0; d < 200; d++) {
      stepDay(a);
      stepDay(b);
    }
    expect(a.day).toBe(200);
    expect(Array.from(a.p.lon)).toEqual(Array.from(b.p.lon));
    expect(Array.from(a.p.lat)).toEqual(Array.from(b.p.lat));
    // slider back: same seed again gives the same picture
    restart(a, 4);
    expect(a.day).toBe(0);
    expect(movingCount(a)).toBe(0);
    for (let d = 0; d < 200; d++) stepDay(a);
    expect(Array.from(a.p.lon)).toEqual(Array.from(b.p.lon));
    restart(a);
    expect(a.seedValue).toBe(5);
    for (let d = 0; d < 200; d++) stepDay(a);
    expect(Array.from(a.p.lon)).not.toEqual(Array.from(b.p.lon));
  });
});

/** ten years of simulated days (the length of the runs the real-field test compares) */
const TEN_YEARS = 3650;

describe('the real current field', () => {
  const NP: Box = { lonMin: -160, lonMax: -120, latMin: 22, latMax: 40 };


  it('has the size and sea share from meta.json and plausible speeds', async () => {
    const f = decodeField(await realBytes(), meta);
    let sea = 0;
    let max = 0;
    for (let k = 0; k < f.u.length; k++) {
      expect(f.u[k] === NODATA).toBe(f.v[k] === NODATA);
      if (f.u[k] === NODATA) continue;
      sea++;
      max = Math.max(max, Math.hypot(f.u[k], f.v[k]) / f.scale);
    }
    expect(sea / f.u.length).toBeGreaterThan(0.5);
    expect(sea / f.u.length).toBeLessThan(0.7);
    expect(max).toBeGreaterThan(1);
    expect(max).toBeLessThan(2.5);
    // Gulf Stream off Cape Canaveral / Cape Hatteras flows north (about 1 m/s in the 0.5° mean), Antarctic Circumpolar Current flows east
    expect(velocityAt(f, -79.5, 30)![1]).toBeGreaterThan(0.8);
    expect(velocityAt(f, -75, 35)![0]).toBeGreaterThan(0.5);
    expect(velocityAt(f, -150, -55)![0]).toBeGreaterThan(0.1);
  });

  it('fills the gyres from the river mouths within 10 years (fixed seed)', async () => {
    const f = decodeField(await realBytes(), meta);
    const src = buildSources(f, await realRivers());
    // the real mode "10 Jahre ab leerem Meer": empty sea, 6 per day, 10 years
    const sim = createSim(f, src, PARTICLES, 7, DIFFUSIVITY);
    restartRun(sim, 7);
    expect(RUN_PER_DAY).toBe(6);
    expect(movingCount(sim)).toBe(0);
    for (let d = 0; d < TEN_YEARS; d++) stepDay(sim);
    expect(sim.released).toBe(TEN_YEARS * 6);
    // a good share of the particles is still in the sea, and the pool is not exhausted
    expect(movingCount(sim)).toBeGreaterThan(1500);
    expect(movingCount(sim)).toBeLessThan(PARTICLES);
    // the North Pacific box holds several times its area share (the river mouths are not there: it filled by drift)
    expect(particleShare(sim.p, NP) / areaShare(f, NP)).toBeGreaterThan(2.5);
    expect(strandedShare(sim)).toBeLessThan(0.95);
    // the sources are at the coast, but the moving particles are not all there: some are in the open North Pacific, far from any river mouth
    let open = 0;
    for (let k = 0; k < sim.p.count; k++) if (sim.p.alive[k] && sim.p.lon[k] > -150 && sim.p.lon[k] < -130 && sim.p.lat[k] > 28 && sim.p.lat[k] < 38) open++;
    expect(open).toBeGreaterThan(30);
  }, 60000);
});

// ---------------------------------------------------------------- live mode

/** a seed with a heavy cell at 20°W 30°N (weight 100) and a light one at 120°E 10°S (weight 1), 1° cells */
const twoCells = (): Seed => ({ step: 1, lon: Float32Array.of(-19.5, 120.5), lat: Float32Array.of(30.5, -9.5), cum: Float64Array.of(100, 101) });

async function realSeedMeta() {
  // @ts-ignore
  const { readFileSync } = (await import('node:fs')) as { readFileSync(url: URL, enc: string): string };
  return JSON.parse(readFileSync(new URL('../../../../public/data/plastik/treibgut-seed.json', import.meta.url), 'utf8')) as SeedMeta;
}

describe('seed file', () => {
  it('decodes to weighted cells that are inside the grid, and rejects a wrong size', async () => {
    const m = await realSeedMeta();
    const seed = parseSeed(m);
    expect(seed.cum.length).toBeGreaterThan(10000);
    for (let k = 1; k < seed.cum.length; k++) expect(seed.cum[k]).toBeGreaterThan(seed.cum[k - 1]);
    expect(Math.min(...seed.lat)).toBeGreaterThan(-85);
    expect(Math.max(...seed.lat)).toBeLessThan(85);
    expect(() => parseSeed({ ...m, nx: m.nx - 1 })).toThrow();
  });
  it('follows the observed distribution: much more weight in the subtropical gyres than in an equal area of the Southern Ocean', async () => {
    const seed = parseSeed(await realSeedMeta());
    const w = (k: number) => seed.cum[k] - (k ? seed.cum[k - 1] : 0);
    const total = seed.cum[seed.cum.length - 1];
    let np = 0;
    let so = 0;
    for (let k = 0; k < seed.cum.length; k++) {
      if (seed.lon[k] >= -160 && seed.lon[k] <= -120 && seed.lat[k] >= 22 && seed.lat[k] <= 40) np += w(k);
      if (seed.lat[k] <= -50 && seed.lat[k] >= -62) so += w(k);
    }
    expect(np / total).toBeGreaterThan(0.05);
    expect(np).toBeGreaterThan(so);
  });
});

describe('snapToSea', () => {
  it('moves a point from land to the nearest sea cell, null if none is near', () => {
    const f = flat(0.1, 0, (i) => i >= 183 && i <= 187);
    const s = snapToSea(f, 5, 0)!;
    expect(isSea(f, s[0], s[1])).toBe(true);
    expect(Math.abs(s[0] - 5)).toBeLessThanOrEqual(4);
    expect(snapToSea(f, 5, 0, 1)).toBeNull();
  });
});

describe('live mode', () => {
  it('seeds in proportion to the weights, on sea cells only', () => {
    // land on the western half of the heavy cell's neighbourhood must not hold a particle
    const f = flat(0.1, 0, (i, j) => i === 160 && j === 119);
    const sim = createSim(f, twoSources(f), 5000, 3);
    seedParticles(sim, twoCells(), 4000);
    expect(sim.moving).toBe(4000);
    expect(sim.seeded).toBe(4000);
    let heavy = 0;
    for (let k = 0; k < 4000; k++) {
      expect(sim.active[k]).toBe(1);
      expect(isSea(f, sim.p.lon[k], sim.p.lat[k])).toBe(true);
      if (sim.p.lon[k] < 0) heavy++;
    }
    // expected share 100/101
    expect(heavy / 4000).toBeGreaterThan(0.97);
    expect(heavy).toBeLessThan(4000);
  });
  it('a seed point on land is moved to a sea cell', () => {
    // the heavy cell (lon -20..-19, lat 30..31) is land completely: i = 160, j = 119.5 -> cell index 160 and rows 119/120
    const f = flat(0.1, 0, (i, j) => i === 160 && (j === 119 || j === 120));
    const sim = createSim(f, twoSources(f), 200, 3);
    seedParticles(sim, { ...twoCells(), cum: Float64Array.of(1, 1.000001) }, 150);
    expect(sim.moving).toBeGreaterThan(100);
    for (let k = 0; k < sim.p.count; k++) if (sim.active[k]) expect(isSea(f, sim.p.lon[k], sim.p.lat[k])).toBe(true);
  });
  it('real seed on the real field: all particles start on sea cells, with the gyres filled (North Pacific box above its area share)', async () => {
    const f = decodeField(await realBytes(), meta);
    const seed = parseSeed(await realSeedMeta());
    const sim = createSim(f, buildSources(f, await realRivers()), PARTICLES, 5);
    restartLive(sim, seed, LIVE_SEED, 5);
    expect(sim.moving).toBe(LIVE_SEED);
    for (let k = 0; k < sim.p.count; k++) if (sim.active[k]) expect(isSea(f, sim.p.lon[k], sim.p.lat[k])).toBe(true);
    const NP: Box = { lonMin: -160, lonMax: -120, latMin: 22, latMax: 40 };
    expect(particleShare(sim.p, NP) / areaShare(f, NP)).toBeGreaterThan(2);
  });
  it('never exceeds the cap and removes the oldest particle first', () => {
    const f = flat(0, 0);
    const sim = createSim(f, twoSources(f), 50, 4);
    sim.perDay = 5;
    seedParticles(sim, twoCells(), 30);
    // the seeded particles are the oldest ones, in random order of age
    const seededBorn = Array.from(sim.born.slice(0, 30));
    expect(new Set(seededBorn).size).toBe(30);
    expect(Math.max(...seededBorn)).toBeLessThan(0);
    let maxMoving = 0;
    let order: number[] = [];
    for (let d = 0; d < 100; d++) {
      // note which slot is the oldest before the day's releases
      const old = Array.from(sim.active.keys()).filter((k) => sim.active[k]).sort((a, b) => sim.born[a] - sim.born[b]);
      const before = sim.evicted;
      stepDay(sim);
      maxMoving = Math.max(maxMoving, sim.moving);
      expect(sim.moving).toBeLessThanOrEqual(50);
      const n = sim.evicted - before;
      // the slots evicted today were the n oldest ones (the new particles took them)
      if (n > 0) order = order.concat(old.slice(0, n));
      for (const slot of old.slice(0, n)) expect(sim.born[slot]).toBeGreaterThanOrEqual(0);
    }
    expect(maxMoving).toBe(50);
    expect(sim.evicted).toBeGreaterThan(0);
    // at the end all seeded ones are gone (replaced by releases), none of the survivors is older than a recent release
    for (let k = 0; k < 50; k++) if (sim.active[k]) expect(sim.born[k]).toBeGreaterThan(sim.released - 51);
  });
  it('reports a reused slot so that its trail can be wiped', () => {
    const f = flat(0, 0);
    const sim = createSim(f, twoSources(f), 10, 4);
    sim.perDay = 10;
    seedParticles(sim, twoCells(), 10);
    stepDay(sim);
    expect(sim.reused.length).toBe(10);
    expect(sim.moving).toBe(10);
  });
  it('a stranded particle is hidden (alive 0) and its slot is free for the next release', () => {
    // everything east of 5°E is land: a particle drifting east strands
    const f = flat(5, 0, (i) => i >= 186);
    const sim = createSim(f, buildSources(f, [{ lon: -179.4, lat: 0, t: 1 }]), 20, 4);
    sim.perDay = 0;
    for (let k = 0; k < 5; k++) {
      sim.free.pop();
    }
    sim.free.length = 0;
    for (let k = 19; k >= 5; k--) sim.free.push(k);
    for (let k = 0; k < 5; k++) {
      sim.p.lon[k] = 4;
      sim.p.lat[k] = 0;
      sim.p.alive[k] = 1;
      sim.active[k] = 1;
      sim.born[k] = k;
    }
    sim.moving = 5;
    sim.perDay = 0;
    stepDay(sim);
    expect(sim.moving).toBe(0);
    expect(sim.stranded).toBe(5);
    expect(sim.free.length).toBe(20);
  });
  it('is deterministic with a seed', () => {
    const f = flat(0.1, 0);
    const a = createSim(f, twoSources(f), 100, 9);
    const b = createSim(f, twoSources(f), 100, 9);
    restartLive(a, twoCells(), 60, 9);
    restartLive(b, twoCells(), 60, 9);
    for (let d = 0; d < 30; d++) {
      stepDay(a);
      stepDay(b);
    }
    expect(Array.from(a.p.lon)).toEqual(Array.from(b.p.lon));
    expect(LIVE_PER_DAY).toBeGreaterThan(0);
  });
  it('real field with the full pool: the sea reaches the cap, the seeded particles go oldest first, the gyre stays filled', async () => {
    const f = decodeField(await realBytes(), meta);
    const seed = parseSeed(await realSeedMeta());
    const cap = PARTICLES;
    const sim = createSim(f, buildSources(f, await realRivers()), cap, 5);
    restartLive(sim, seed, LIVE_SEED, 5);
    let left = LIVE_SEED;
    let full = false;
    for (let d = 1; d <= 12 * 365; d++) {
      stepDay(sim);
      expect(sim.moving).toBeLessThanOrEqual(cap);
      if (sim.moving >= cap) full = true;
      if (d % 365 === 0) {
        let n = 0;
        for (let k = 0; k < cap; k++) if (sim.active[k] && sim.born[k] < 0) n++;
        expect(n).toBeLessThanOrEqual(left);
        left = n;
      }
    }
    expect(full).toBe(true);
    expect(sim.evicted).toBeGreaterThan(0);
    // a full pool removes the oldest: at the end nothing in the sea is older than the newest `cap` releases (stranded ones are gone anyway)
    for (let k = 0; k < cap; k++) if (sim.active[k] && sim.born[k] >= 0) expect(sim.born[k]).toBeGreaterThanOrEqual(0);
    const NP: Box = { lonMin: -160, lonMax: -120, latMin: 22, latMax: 40 };
    // 5.1 measured after 12 years (9.1 with the old white-noise walk); in a pool of 2,500 it falls below the area share, because the
    // old particles of the gyre are the ones that make room
    expect(particleShare(sim.p, NP) / areaShare(f, NP)).toBeGreaterThan(3);
  }, 60000);
});
