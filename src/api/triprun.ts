import type { Itinerary } from './connections';

// Saved commuter trips that run soon or right now are kept in the browser (store.getRuns), so the app can show
// them offline (installed PWA, no signal on the train). A kept run is the connection as it was last seen online.

/** a kept run: the connection of the trip's next run, when it was seen (`at`) and which run it is */
export interface StoredRun {
  at: number;
  /** scheduled departure of the run (nextRun().dep) */
  dep: number;
  today: boolean;
  it: Itinerary;
}

/** how far ahead a run is kept: "soon" */
export const KEEP_AHEAD_MS = 36 * 3600000;
/** how long a run stays after its arrival ("it is still running" / a late train) */
export const KEEP_AFTER_MS = 30 * 60000;

/** worth keeping: it runs soon or right now */
export function worthKeeping(run: { dep: number }, it: Itinerary, now = Date.now()): boolean {
  return run.dep - now <= KEEP_AHEAD_MS && it.arr + KEEP_AFTER_MS >= now;
}

/** a kept run is still of use: not arrived long ago */
export const stillUseful = (s: StoredRun, now = Date.now()): boolean => s.it.arr + KEEP_AFTER_MS >= now;

/** the kept run answers for `run` when it is the same departure */
export const matchesRun = (s: StoredRun | undefined, run: { dep: number }, now = Date.now()): s is StoredRun => !!s && s.dep === run.dep && stillUseful(s, now);
