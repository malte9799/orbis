// Historic run of the drift model ("Historisch ab 1950"): the sea is empty on 1950-01-01, particles enter at the river mouths at a rate
// proportional to the global plastic production of the calendar year (Our World in Data / Geyer et al. 2017, CC BY,
// public/data/plastik/production.json from scripts/production-build.py) and are removed from the sea with a time constant of 15 years
// (sinking, breakdown; the same assumption as scripts/gpgp-model.py), on top of the stranding at the coast. The pool is capped
// (the oldest particle makes room). The sim reaches a date of the shared clock (meerzeit.ts) by simulating forward from the start;
// checkpoints every 5 simulated years let a jump back restart from the nearest earlier one. Pure functions, no map and no DOM.
import { dayCalendarYear, MEER_START } from './meerzeit';
import { restartHist, type HistCfg, type Sim } from './treibmodell';

/** fixed seed of the historic run: the same run every time (checkpoints stay valid) */
export const HIST_SEED = 1;

/** time constant of the removal (years), like scripts/gpgp-model.py */
export const HIST_TAU_YEARS = 15;
/** a checkpoint every this many simulated days (5 years) */
export const HIST_CHECK_DAYS = 5 * 365;
/**
 * Particles released per simulated day in the reference year (HIST_REF_YEAR); all other years scale with the production. Chosen so that
 * the pool is close to its cap (8,000) around 2020: 7,600 in 2020, 3,000 in 2000, 900 in 1980 (measured with the real field and sources, see PLAN-MEERESPLASTIK.md).
 */
export const HIST_PER_DAY_REF = 12;
export const HIST_REF_YEAR = 2020;
/** the model sim runs this many days ahead of the clock while it plays (the clock waits for the sim, see meerzeit.ts) */
export const HIST_LEAD_DAYS = 3;

export interface ProductionDoc {
  /** Mt per year, key = year */
  years: Record<string, number>;
}
/** production by year (Mt/year), years ascending */
export interface Production {
  first: number;
  last: number;
  mt: Float64Array;
}

export function parseProduction(doc: ProductionDoc): Production {
  const ys = Object.keys(doc.years).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!ys.length) throw new Error('production.json: keine Jahre');
  const first = ys[0];
  const last = ys[ys.length - 1];
  const mt = new Float64Array(last - first + 1);
  let prev = 0;
  for (let y = first; y <= last; y++) {
    const v = Number(doc.years[String(y)]);
    prev = Number.isFinite(v) && v >= 0 ? v : prev;
    mt[y - first] = prev;
  }
  return { first, last, mt };
}

/** production of a year (Mt); outside of the series the nearest end counts */
export const productionAt = (p: Production, year: number): number => p.mt[Math.max(p.first, Math.min(p.last, year)) - p.first];

/** simulated day 0 is MEER_START; the calendar date (days since 1970-01-01) of a simulated day and back */
export const histDate = (simDay: number): number => MEER_START + simDay;
export const histDay = (date: number): number => Math.max(0, Math.floor(date - MEER_START));
export const histYear = (simDay: number): number => dayCalendarYear(histDate(simDay));

/** release rate (particles per day) and removal of the historic run */
export function histConfig(p: Production, perDayRef = HIST_PER_DAY_REF, tauYears = HIST_TAU_YEARS): HistCfg {
  const ref = productionAt(p, HIST_REF_YEAR);
  // one number per year: the rate of a day is a table lookup
  const perYear = new Float64Array(p.last - p.first + 1);
  for (let i = 0; i < perYear.length; i++) perYear[i] = ref > 0 ? (perDayRef * p.mt[i]) / ref : 0;
  return {
    rate: (day) => perYear[Math.max(p.first, Math.min(p.last, histYear(day))) - p.first],
    decay: 1 - Math.exp(-1 / (tauYears * 365)),
  };
}

/** new historic run on the sim (empty sea on 1950-01-01); the checkpoint of day 0 is stored */
export function startHist(sim: Sim, cfg: HistCfg, cps: Checkpoints, seedValue = sim.seedValue) {
  restartHist(sim, cfg, seedValue);
  cps.clear();
  cps.maybeSave(sim);
}

/**
 * Switch the sim to the historic run at `targetDay` (e.g. back from the live mode): the sim is set up for it and takes the nearest
 * earlier checkpoint; without any (first time) it starts with an empty sea.
 */
export function enterHist(sim: Sim, cfg: HistCfg, cps: Checkpoints, targetDay: number) {
  const s = cps.nearest(targetDay);
  if (!s) return startHist(sim, cfg, cps, HIST_SEED);
  sim.hist = cfg;
  sim.perDay = 0;
  cps.restore(sim, s);
}

/** a copy of everything that makes the next day of the sim: restoring it and simulating on gives the same days as never having stopped */
interface Snapshot {
  day: number;
  lon: Float32Array;
  lat: Float32Array;
  alive: Uint8Array;
  eu: Float32Array;
  ev: Float32Array;
  active: Uint8Array;
  used: Uint8Array;
  born: Float64Array;
  free: number[];
  rng: number;
  released: number;
  moving: number;
  stranded: number;
  evicted: number;
  relAcc: number;
  decayed: number;
}

export class Checkpoints {
  private snaps = new Map<number, Snapshot>();

  /** `every`: simulated days between two checkpoints (the historic run: 5 years, the run "10 Jahre": 1 year) */
  constructor(private every = HIST_CHECK_DAYS) {}

  get size() {
    return this.snaps.size;
  }
  clear() {
    this.snaps.clear();
  }

  /** stores the state when the sim stands on a multiple of the interval that is not stored yet */
  maybeSave(sim: Sim) {
    if (sim.day % this.every !== 0 || this.snaps.has(sim.day)) return;
    const p = sim.p;
    this.snaps.set(sim.day, {
      day: sim.day,
      lon: p.lon.slice(),
      lat: p.lat.slice(),
      alive: p.alive.slice(),
      eu: p.eu.slice(),
      ev: p.ev.slice(),
      active: sim.active.slice(),
      used: sim.used.slice(),
      born: sim.born.slice(),
      free: sim.free.slice(),
      rng: sim.random.get(),
      released: sim.released,
      moving: sim.moving,
      stranded: sim.stranded,
      evicted: sim.evicted,
      relAcc: sim.relAcc,
      decayed: sim.decayed,
    });
  }

  /** the latest checkpoint at or before `day`, undefined if none */
  nearest(day: number): Snapshot | undefined {
    let best: Snapshot | undefined;
    for (const s of this.snaps.values()) if (s.day <= day && (!best || s.day > best.day)) best = s;
    return best;
  }

  restore(sim: Sim, s: Snapshot) {
    const p = sim.p;
    p.lon.set(s.lon);
    p.lat.set(s.lat);
    p.alive.set(s.alive);
    p.eu.set(s.eu);
    p.ev.set(s.ev);
    sim.active.set(s.active);
    sim.used.set(s.used);
    sim.born.set(s.born);
    sim.free = s.free.slice();
    sim.reused.length = 0;
    sim.random.set(s.rng);
    sim.day = s.day;
    sim.released = s.released;
    sim.moving = s.moving;
    sim.stranded = s.stranded;
    sim.evicted = s.evicted;
    sim.relAcc = s.relAcc;
    sim.decayed = s.decayed;
  }
}

/**
 * Before simulating toward `target`: a jump back restores the nearest earlier checkpoint; a jump far ahead takes a later checkpoint if there
 * is one past the current day. Returns true if the state was replaced (the caller wipes the trails of the picture).
 */
export function prepareSeek(sim: Sim, cps: Checkpoints, target: number): boolean {
  const s = cps.nearest(target);
  if (!s) return false;
  if (target < sim.day || s.day > sim.day) {
    cps.restore(sim, s);
    return true;
  }
  return false;
}
