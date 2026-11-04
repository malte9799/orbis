import { describe, expect, it } from 'vitest';
import { buildSources, createSim, restartRun, RUN_PER_DAY, stepDay, type Field, type River, type Sim } from './treibmodell';
import {
  Checkpoints,
  enterHist,
  HIST_CHECK_DAYS,
  HIST_PER_DAY_REF,
  HIST_REF_YEAR,
  histConfig,
  histDate,
  histDay,
  histYear,
  parseProduction,
  prepareSeek,
  productionAt,
  startHist,
} from './treibhistorie';
import { MEER_START, yearStartDay } from './meerzeit';
import productionJson from '../../../../public/data/plastik/production.json';

const NODATA = -32768;
/** 1° cells, a westward current everywhere, a coast (land) at lon > 170 so that particles also strand */
function field(): Field {
  const nx = 360;
  const ny = 180;
  const u = new Int16Array(nx * ny);
  const v = new Int16Array(nx * ny);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const land = i >= 350;
      u[j * nx + i] = land ? NODATA : 200;
      v[j * nx + i] = land ? NODATA : 20;
    }
  return { nx, ny, step: 1, lon0: -179.5, lat0: -89.5, scale: 1000, nodata: NODATA, u, v };
}
const rivers: River[] = [
  { lon: -120, lat: 30, t: 100 },
  { lon: -60, lat: 10, t: 50 },
  { lon: 20, lat: -20, t: 10 },
];
const prod = parseProduction(productionJson);
const mkSim = (count = 600): Sim => {
  const f = field();
  return createSim(f, buildSources(f, rivers), count, 1);
};
const run = (sim: Sim, cps: Checkpoints, days: number) => {
  for (let d = 0; d < days; d++) {
    stepDay(sim);
    cps.maybeSave(sim);
  }
};
const state = (sim: Sim) => ({
  day: sim.day,
  lon: Array.from(sim.p.lon),
  lat: Array.from(sim.p.lat),
  alive: Array.from(sim.p.alive),
  eu: Array.from(sim.p.eu),
  ev: Array.from(sim.p.ev),
  active: Array.from(sim.active),
  born: Array.from(sim.born),
  free: sim.free.slice(),
  rng: sim.random.get(),
  released: sim.released,
  moving: sim.moving,
  stranded: sim.stranded,
  evicted: sim.evicted,
  decayed: sim.decayed,
  relAcc: sim.relAcc,
});

describe('production series', () => {
  it('is shipped from 1950 to 2025 in Mt/year', () => {
    expect(prod.first).toBe(1950);
    expect(prod.last).toBe(2025);
    expect(productionAt(prod, 1950)).toBe(2);
    expect(productionAt(prod, 2019)).toBeCloseTo(459.746, 2);
    expect(productionAt(prod, 1900)).toBe(2);
    expect(productionAt(prod, 2100)).toBe(productionAt(prod, 2025));
  });
  it('fills gaps with the previous value', () => {
    const p = parseProduction({ years: { '2000': 10, '2003': 40 } });
    expect([productionAt(p, 2000), productionAt(p, 2001), productionAt(p, 2003)]).toEqual([10, 10, 40]);
  });
});

describe('historic run', () => {
  it('maps simulated days to dates', () => {
    expect(histDate(0)).toBe(MEER_START);
    expect(histDay(yearStartDay(1951))).toBe(365);
    expect(histDay(yearStartDay(1940))).toBe(0);
    expect(histYear(0)).toBe(1950);
    expect(histYear(365)).toBe(1951);
  });

  it('releases in proportion to the production of the year and decays with 15 years', () => {
    const cfg = histConfig(prod);
    expect(cfg.rate(histDay(yearStartDay(HIST_REF_YEAR)) + 10)).toBeCloseTo(HIST_PER_DAY_REF, 6);
    const r1960 = cfg.rate(histDay(yearStartDay(1960)));
    const r2000 = cfg.rate(histDay(yearStartDay(2000)));
    expect(r1960 / r2000).toBeCloseTo(productionAt(prod, 1960) / productionAt(prod, 2000), 6);
    expect(r2000).toBeGreaterThan(r1960 * 10);
    expect(cfg.decay).toBeCloseTo(1 - Math.exp(-1 / (15 * 365)), 12);
    expect(1 / cfg.decay / 365).toBeCloseTo(15, 0);
  });

  it('the sea is empty on 1950-01-01 and the release follows the production', () => {
    const sim = mkSim(1500);
    const cps = new Checkpoints();
    startHist(sim, histConfig(prod, 60), cps);
    expect(sim.moving).toBe(0);
    expect(sim.released).toBe(0);
    run(sim, cps, 365);
    const early = sim.released; // 1950: 2 Mt
    run(sim, cps, 365 * 29); // to 1980
    const before = sim.released;
    run(sim, cps, 365);
    const lateYear = sim.released - before; // 1980
    expect(early).toBeGreaterThan(0);
    expect(lateYear / early).toBeGreaterThan(10);
    expect(lateYear / early).toBeCloseTo(productionAt(prod, 1980) / productionAt(prod, 1950), -1);
  });

  it('respects the cap (oldest particle makes room) and removes particles by decay', () => {
    const sim = mkSim(300);
    const cps = new Checkpoints();
    startHist(sim, histConfig(prod, 200), cps);
    run(sim, cps, 365 * 60);
    expect(sim.moving).toBeLessThanOrEqual(300);
    expect(sim.evicted).toBeGreaterThan(0);
    expect(sim.decayed).toBeGreaterThan(0);
    // released = in the sea + stranded + decayed + evicted
    expect(sim.released).toBe(sim.moving + sim.stranded + sim.decayed + sim.evicted);
  });

  it('decay alone: a pool without coast and with a slow current loses 1 - exp(-t/15 a)', () => {
    const f = field();
    // no current at all: nothing strands, only the decay removes particles
    f.u.fill(0);
    f.v.fill(0);
    const sim = createSim(f, buildSources(f, [{ lon: -120, lat: 30, t: 1 }]), 3000, 3, 0);
    const cps = new Checkpoints();
    // 3000 particles on day 1, then none
    startHist(sim, { rate: (d) => (d === 0 ? 3000 : 0), decay: 1 - Math.exp(-1 / (15 * 365)) }, cps, 3);
    stepDay(sim);
    expect(sim.moving).toBe(3000);
    for (let d = 0; d < 15 * 365; d++) stepDay(sim);
    // after one time constant 1/e of them remain
    expect(sim.moving / 3000).toBeGreaterThan(0.34);
    expect(sim.moving / 3000).toBeLessThan(0.4);
  });

  it('is deterministic for a fixed seed', () => {
    const a = mkSim();
    const b = mkSim();
    const ca = new Checkpoints();
    const cb = new Checkpoints();
    startHist(a, histConfig(prod, 80), ca);
    startHist(b, histConfig(prod, 80), cb);
    run(a, ca, 4000);
    run(b, cb, 4000);
    expect(state(a)).toEqual(state(b));
  });

  it('saves a checkpoint every 5 simulated years', () => {
    const sim = mkSim();
    const cps = new Checkpoints();
    startHist(sim, histConfig(prod, 80), cps);
    expect(cps.size).toBe(1);
    run(sim, cps, HIST_CHECK_DAYS * 3 + 10);
    expect(cps.size).toBe(4);
    expect(cps.nearest(HIST_CHECK_DAYS * 2 + 5)?.day).toBe(HIST_CHECK_DAYS * 2);
    expect(cps.nearest(10)?.day).toBe(0);
  });

  it('a jump back restores the nearest earlier checkpoint and simulating on gives the identical state', () => {
    const cfg = histConfig(prod, 80);
    const straight = mkSim();
    const cs = new Checkpoints();
    startHist(straight, cfg, cs);
    run(straight, cs, 9000);
    const expected = state(straight);

    const sim = mkSim();
    const cps = new Checkpoints();
    startHist(sim, cfg, cps);
    run(sim, cps, 9000);
    // jump back into the second interval (day 2500: the checkpoint of day 1825)
    expect(prepareSeek(sim, cps, 2500)).toBe(true);
    expect(sim.day).toBe(HIST_CHECK_DAYS);
    run(sim, cps, 9000 - sim.day);
    expect(state(sim)).toEqual(expected);
  });

  it('a jump ahead takes a later checkpoint; within the same interval it simulates on', () => {
    const cfg = histConfig(prod, 80);
    const sim = mkSim();
    const cps = new Checkpoints();
    startHist(sim, cfg, cps);
    run(sim, cps, 6000);
    const snap = state(sim);
    expect(prepareSeek(sim, cps, 6000)).toBe(false);
    prepareSeek(sim, cps, 100);
    expect(sim.day).toBe(0);
    // from day 0 to a target past the checkpoints that exist: the latest one at or before it
    expect(prepareSeek(sim, cps, 5900)).toBe(true);
    expect(sim.day).toBe(HIST_CHECK_DAYS * 3);
    // inside the interval: no restore
    expect(prepareSeek(sim, cps, HIST_CHECK_DAYS * 3 + 50)).toBe(false);
    run(sim, cps, 6000 - sim.day);
    expect(state(sim)).toEqual(snap);
  });

  it('coming back from another mode starts from a checkpoint (empty sea the first time)', () => {
    const cfg = histConfig(prod, 80);
    const sim = mkSim();
    const cps = new Checkpoints();
    enterHist(sim, cfg, cps, 0);
    expect(sim.day).toBe(0);
    expect(sim.hist).toBe(cfg);
    run(sim, cps, 3700);
    // another mode takes over the pool ...
    sim.hist = null;
    sim.p.alive.fill(0);
    sim.day = 777;
    // ... and the historic run is entered at day 3700 again: the checkpoint of day 3650
    enterHist(sim, cfg, cps, 3700);
    expect(sim.day).toBe(HIST_CHECK_DAYS * 2);
    expect(sim.hist).toBe(cfg);
  });
});

describe('run "10 Jahre ab leerem Meer"', () => {
  const start = (sim: Sim, cps: Checkpoints, seed = 3) => {
    restartRun(sim, seed);
    cps.clear();
    cps.maybeSave(sim);
  };
  it('starts with an empty sea and releases the constant rate (6 a day)', () => {
    const sim = mkSim(2000);
    const cps = new Checkpoints(365);
    start(sim, cps);
    expect(sim.day).toBe(0);
    expect(sim.moving).toBe(0);
    expect(sim.hist).toBeNull();
    for (let d = 0; d < 100; d++) stepDay(sim);
    expect(sim.released).toBe(100 * RUN_PER_DAY);
  });
  it('saves a checkpoint every simulated year', () => {
    const sim = mkSim();
    const cps = new Checkpoints(365);
    start(sim, cps);
    run(sim, cps, 365 * 3 + 10);
    expect(cps.size).toBe(4);
    expect(cps.nearest(365 * 2 + 5)?.day).toBe(730);
  });
  it('seeking back is deterministic: restore + simulate on = the run without a jump (same seed)', () => {
    const straight = mkSim();
    const cs = new Checkpoints(365);
    start(straight, cs);
    run(straight, cs, 3650);
    const expected = state(straight);

    const sim = mkSim();
    const cps = new Checkpoints(365);
    start(sim, cps);
    run(sim, cps, 3650);
    // back to year 4.5 (checkpoint of day 1460), and all the way back to day 0
    expect(prepareSeek(sim, cps, 1640)).toBe(true);
    expect(sim.day).toBe(1460);
    expect(prepareSeek(sim, cps, 0)).toBe(true);
    expect(sim.day).toBe(0);
    expect(sim.moving).toBe(0);
    run(sim, cps, 3650);
    expect(state(sim)).toEqual(expected);
  });
  it('a new seed gives another run', () => {
    const a = mkSim();
    const b = mkSim();
    const ca = new Checkpoints(365);
    const cb = new Checkpoints(365);
    start(a, ca, 3);
    start(b, cb, 4);
    run(a, ca, 400);
    run(b, cb, 400);
    expect(Array.from(a.p.lon)).not.toEqual(Array.from(b.p.lon));
  });
});
