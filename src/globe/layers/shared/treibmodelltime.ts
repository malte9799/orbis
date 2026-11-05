// State of the layer "Treibgut-Modell": mode, simulated days, counters. Shared state like treibbojentime.ts: the layer runs the
// simulation and reports to it, the timeline (views/globe.ts) and the layer subscribe. Everything per map (particles, buffers) stays in
// ctx.state of the layer. Play/pause belongs to the shared clock (meerzeit.ts). Two ways to run: "Historisch ab 1950" (the layer
// follows the time of the timeline, the default, see treibhistorie.ts), "Live" (its own endless run) or "10 Jahre ab leerem Meer"
// (`run`: its own run of RUN_YEARS years from an empty sea, with a slider of its own); live and run only while the timeline is
// focused on this layer, the focus "Alle" is always the historic run.
import { meerFocus, subscribeMeer } from './meerzeit';

/** one simulated year takes this long in real time (ms) in the modes that run on their own */
export const YEAR_MS = 3000;
/** simulated days per real millisecond */
export const DAYS_PER_MS = 365 / YEAR_MS;
/** the run "10 Jahre ab leerem Meer": length in years and days */
export const RUN_YEARS = 10;
export const RUN_DAYS = RUN_YEARS * 365;
export type ModelMode = 'hist' | 'live' | 'run';

export interface ModelState {
  /** the mode chosen in the view of this layer (`hist`: on the timeline, `live` / `run`: its own run); the focus "Alle" is always historic */
  mode: ModelMode;
  /** counts up when the live / run is to start anew ("Jetzt"): the layer seeds again */
  restarts: number;
  /** run mode: day the slider was moved to while the model is still catching up (null: no jump pending) */
  target: number | null;
  /** counts up with every jump of the slider in the run mode */
  seeks: number;
  /** simulated days since the start of the run (reported by the layer); historic: days since 1950-01-01 */
  day: number;
  /** share of the released particles stranded (0..1) */
  stranded: number;
  /** particles in the sea right now (released, not stranded) */
  inSea: number;
  /** data loaded: number of particles */
  ready: { count: number } | null;
}

let st: ModelState = { mode: 'hist', restarts: 0, target: null, seeks: 0, day: 0, stranded: 0, inSea: 0, ready: null };
const subs = new Set<() => void>();
const tickSubs = new Set<() => void>();
let lastTick = 0;
const TICK_MS = 100;

const notify = () => {
  subs.forEach((fn) => fn());
  tickSubs.forEach((fn) => fn());
};

/** mode, restart or data changed */
export const subscribeModel = (fn: () => void): (() => void) => {
  subs.add(fn);
  return () => subs.delete(fn);
};
/** also the time while it runs (at most every 100 ms) */
export const subscribeModelTick = (fn: () => void): (() => void) => {
  tickSubs.add(fn);
  return () => tickSubs.delete(fn);
};

export const modelState = (): Readonly<ModelState> => st;
/** the run mode that is active: the historic run on the timeline, or live (endless, starts with the observed plastic) */
export const modelRunMode = (): ModelMode => st.mode;
/** does the layer follow the time of the timeline (historic run)? */
export const modelHistoric = (): boolean => st.mode === 'hist';

export function setModelReady(ready: ModelState['ready']) {
  st = { ...st, ready };
  notify();
}
/** Choose a mode: `hist` follows the timeline; live and run run on their own and start anew from day 0. */
export function setModelMode(mode: ModelMode) {
  if (mode === st.mode) return;
  st = mode !== 'hist' ? { ...st, mode, day: 0, stranded: 0, inSea: 0, target: null, restarts: st.restarts + 1 } : { ...st, mode, target: null };
  notify();
}
// the focus "Alle" is always the historic run
subscribeMeer(() => {
  if (meerFocus() === 'all' && st.mode !== 'hist') setModelMode('hist');
});
/** Live / run mode "Jetzt": start again (live: seed from the distribution, run: empty sea). */
export function restartModel() {
  st = { ...st, restarts: st.restarts + 1, day: 0, target: null };
  notify();
}
/** Run mode, slider: jump to a day of the run (0..RUN_DAYS); the layer simulates there (back: from the nearest earlier checkpoint). null: the jump is done. */
export function setModelRunTarget(day: number | null) {
  if (day === null) {
    if (st.target === null) return;
    st = { ...st, target: null };
  } else st = { ...st, target: Math.max(0, Math.min(RUN_DAYS, Math.round(day))), seeks: st.seeks + 1 };
  notify();
}

/** The layer reports its state once per frame. */
export function reportModel(day: number, stranded: number, inSea = 0) {
  const changed = stranded !== st.stranded;
  st = { ...st, day, stranded, inSea };
  const now = performance.now();
  if (changed || now - lastTick >= TICK_MS) {
    lastTick = now;
    tickSubs.forEach((fn) => fn());
  }
}
