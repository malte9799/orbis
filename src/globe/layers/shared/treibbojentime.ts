// Time of the layer "Treibbojen (NOAA)": mode and its OWN time (days). Shared state like plastiktime.ts: the layer fills and
// advances it, the timeline (views/globe.ts) and the layer subscribe. Only this small state lives here; everything per map
// (parts, data, buffers) is in ctx.state of the layer. Play/pause belongs to the shared clock (meerzeit.ts). In the real-time mode the
// layer shows the time of that clock (while it is driven by it, else the time it held); `time` is only used by the shared start,
// which runs on its own loop and is only available while the timeline is focused on this layer (the focus "Alle" is always real time).
import { advanceTime, SHARED_SPAN_DAYS, type DriftMode, type TimeRange } from './treibbojen';
import { meerDriven, meerFocus, setMeerEnd, setMeerLayerRange, subscribeMeer } from './meerzeit';

export interface DriftState {
  mode: DriftMode;
  /** days: shared start: since release, real time: since 1970-01-01 */
  time: number;
  /** buoys shown right now (reported by the layer once per frame, no notification: the timeline reads it on its own ticks) */
  active: number;
  /** data loaded: the real-time range (days since 1970-01-01) and the number of buoys */
  ready: { first: number; last: number; count: number } | null;
}

// default: the real calendar (buoys appear and vanish as in reality); "shared start" is the alternative view
let st: DriftState = { mode: 'real', time: 0, active: 0, ready: null };
const subs = new Set<() => void>();
const tickSubs = new Set<() => void>();
let lastTick = 0;
const TICK_MS = 100;

const notify = () => {
  subs.forEach((fn) => fn());
  tickSubs.forEach((fn) => fn());
};

/** mode, play state or data changed */
export const subscribeDrift = (fn: () => void): (() => void) => {
  subs.add(fn);
  return () => subs.delete(fn);
};
/** also the time while it plays (at most every 100 ms) */
export const subscribeDriftTick = (fn: () => void): (() => void) => {
  tickSubs.add(fn);
  return () => tickSubs.delete(fn);
};

/** does the layer show the shared clock's date (real time, driven by the clock)? Otherwise it runs its own loop or holds. */
export const driftFollowsClock = (): boolean => st.mode === 'real' && meerDriven('bojen');
export const driftState = (): Readonly<DriftState> => st;
/** real time: first to last day of the data; before the data are there (and in shared start) a placeholder 0..loop length */
export const driftRange = (): TimeRange =>
  st.mode === 'real' && st.ready ? { lo: st.ready.first, hi: st.ready.last } : { lo: 0, hi: SHARED_SPAN_DAYS };

export function setDriftReady(ready: DriftState['ready']) {
  st = { ...st, ready, time: st.mode === 'real' ? (ready ? ready.first : 0) : 0 };
  // the last day of the data ends the shared axis, and the data range is the axis of the layer when it is the focus
  if (ready) {
    setMeerEnd(ready.last);
    setMeerLayerRange('bojen', { lo: ready.first, hi: ready.last });
  }
  notify();
}
export function setDriftMode(mode: DriftMode) {
  if (mode === st.mode) return;
  st = { ...st, mode, time: mode === 'real' && st.ready ? st.ready.first : 0 };
  notify();
}
export function setDriftTime(time: number) {
  const r = driftRange();
  st = { ...st, time: Math.max(r.lo, Math.min(r.hi, time)) };
  notify();
}
// the focus "Alle" always shows real time on the shared clock: the shared start belongs to the view of this layer alone
subscribeMeer(() => {
  if (meerFocus() === 'all' && st.mode !== 'real') {
    st = { ...st, mode: 'real', time: st.ready ? st.ready.first : 0 };
    notify();
  }
});

/** The layer reports how many buoys it shows. */
export function reportDriftActive(n: number) {
  st.active = n;
}

/** Called by the layer once per frame while it runs on its own; returns the new time. */
export function tickDrift(dtMs: number): number {
  st.time = advanceTime(st.mode, st.time, dtMs, driftRange());
  const now = performance.now();
  if (now - lastTick >= TICK_MS) {
    lastTick = now;
    tickSubs.forEach((fn) => fn());
  }
  return st.time;
}
