// Shared clock of the marine-plastic layers ("Plastik im Meer", "Treibbojen", "Treibgut-Modell"): ONE calendar axis from 1950-01-01 to
// the end of the drifter data, one play state, one speed. Time is in days since 1970-01-01 (negative before), like the drifter data.
// The timeline has a FOCUS: 'all' (the clock drives every plastic layer) or one layer (the timeline shows only that layer, with the axis
// of that layer; only it is driven by the clock, the others hold the time they had: `meerLayerTime`). One source of truth: `focus`,
// `time` (the time of the focus) and `held` (the time of each layer that is not driven).
// Pure state like treibbojentime.ts (no map, no DOM): the timeline in views/globe.ts drives `tickMeer`, the layers subscribe.

export type MeerLayer = 'plastik' | 'bojen' | 'modell';
/** what the timeline shows: all layers on the shared clock, or one layer alone */
export type MeerFocus = 'all' | MeerLayer;

/** seconds the clock needs for one calendar year */
export type MeerSpeed = 1 | 3 | 10;
export const MEER_SPEEDS: readonly MeerSpeed[] = [1, 3, 10];

/** days since 1970-01-01 of January 1st of a year */
export const yearStartDay = (year: number) => Date.UTC(year, 0, 1) / 86400000;
/** calendar year of a day count (UTC) */
export const dayCalendarYear = (day: number) => new Date(Math.floor(day) * 86400000).getUTCFullYear();

/** start of the axis: 1950-01-01 (first year of the plastic production series and of the historic model) */
export const MEER_START = yearStartDay(1950);
/** default end of the axis until the drifter data say otherwise: 2025-06-11 (last day of the NOAA data) */
export const MEER_END_DEFAULT = Date.UTC(2025, 5, 11) / 86400000;
/** at the end of the axis the last picture stays this long (ms) before the clock starts over */
export const HOLD_MS = 2000;
/** days per year of the clock (calendar mean) */
const YEAR_DAYS = 365.25;
/** "Plastik im Meer" steps through the years: one year takes this many ms per second of the tempo (3 s -> 600 ms per year) */
export const PLASTIK_MS_PER_TEMPO_S = 200;

export interface MeerState {
  /** days since 1970-01-01 */
  time: number;
  playing: boolean;
  speed: MeerSpeed;
  /** what the timeline shows (see the head of the file) */
  focus: MeerFocus;
  /** the time of each layer while it is not driven by the clock (the time it had when the focus left it) */
  held: Readonly<Record<MeerLayer, number>>;
  /** the shared time while the focus is on a single layer (restored by "Alle") */
  allTime: number;
  /** end of the axis (days since 1970-01-01) */
  end: number;
}

const initial = (): MeerState => ({ time: MEER_START, playing: true, speed: 3, focus: 'all', held: { plastik: MEER_START, bojen: MEER_START, modell: MEER_START }, allTime: MEER_START, end: MEER_END_DEFAULT });
let st: MeerState = initial();
/** the clock never runs past this day (a model that has not got there yet); null = no limit */
let gate: number | null = null;
let hold = 0;
/** the axis of a layer when it is the focus (null: the whole shared axis); the layers report their data range */
const layerRange: Partial<Record<MeerLayer, { lo: number; hi: number } | null>> = {};
const subs = new Set<() => void>();
const tickSubs = new Set<() => void>();

const notify = () => {
  subs.forEach((fn) => fn());
  tickSubs.forEach((fn) => fn());
};

/** play state, speed, focus, jumps (slider, "Jetzt") or the range changed */
export const subscribeMeer = (fn: () => void): (() => void) => {
  subs.add(fn);
  return () => subs.delete(fn);
};
/** every change of the time, also while it plays (once per tick) */
export const subscribeMeerTick = (fn: () => void): (() => void) => {
  tickSubs.add(fn);
  return () => tickSubs.delete(fn);
};

export const meerState = (): Readonly<MeerState> => st;
export const meerTime = (): number => st.time;
export const meerFocus = (): MeerFocus => st.focus;
/** is the layer driven by the clock (the focus is all layers or this one)? Otherwise it holds its picture. */
export const meerDriven = (layer: MeerLayer): boolean => st.focus === 'all' || st.focus === layer;
/** the time a layer shows: the clock while it is driven, else the time it held */
export const meerLayerTime = (layer: MeerLayer): number => (meerDriven(layer) ? st.time : st.held[layer]);
const axis = (focus: MeerFocus): { lo: number; hi: number } => {
  const r = focus === 'all' ? null : layerRange[focus];
  return r ? { lo: Math.max(MEER_START, r.lo), hi: Math.min(st.end, Math.max(r.lo, r.hi)) } : { lo: MEER_START, hi: st.end };
};
/** the axis of the timeline: the whole shared axis, or the data range of the layer in focus */
export const meerRange = (): { lo: number; hi: number } => axis(st.focus);
export const meerCalYear = (): number => dayCalendarYear(st.time);
/** days of the clock per millisecond at the current speed (in the focus "Plastik im Meer" the tempo is per year of its slider) */
export const meerDaysPerMs = (speed: MeerSpeed = st.speed): number => YEAR_DAYS / (speed * (st.focus === 'plastik' ? PLASTIK_MS_PER_TEMPO_S : 1000));

const clampTime = (t: number) => {
  const r = meerRange();
  return Math.max(r.lo, Math.min(r.hi, t));
};

/** A layer reports the range of its data (the axis when it is the focus); null = the whole shared axis. */
export function setMeerLayerRange(layer: MeerLayer, range: { lo: number; hi: number } | null) {
  layerRange[layer] = range;
  if (st.focus === layer) st = { ...st, time: clampTime(st.time) };
  notify();
}
/**
 * Choose what the timeline shows. Leaving "Alle" every layer holds the shared time; leaving a layer it holds the time it had. The new
 * focus starts at the time its layer held (clamped to its axis); "Alle" returns to the shared time (the layers jump to it).
 */
export function setMeerFocus(focus: MeerFocus) {
  if (focus === st.focus) return;
  hold = 0;
  let held = st.held;
  let allTime = st.allTime;
  if (st.focus === 'all') {
    allTime = st.time;
    held = { plastik: st.time, bojen: st.time, modell: st.time };
  } else held = { ...held, [st.focus]: st.time };
  const next = focus === 'all' ? allTime : held[focus];
  st = { ...st, focus, held, allTime };
  const r = axis(focus);
  st = { ...st, time: Math.max(r.lo, Math.min(r.hi, next)) };
  notify();
}

/** the drifter data are loaded: their last day ends the axis */
export function setMeerEnd(end: number) {
  if (!(end > MEER_START) || end === st.end) return;
  const cap = (t: number) => Math.min(t, end);
  st = { ...st, end, time: cap(st.time), allTime: cap(st.allTime), held: { plastik: cap(st.held.plastik), bojen: cap(st.held.bojen), modell: cap(st.held.modell) } };
  notify();
}
/** the slider or "Jetzt": jump to a time (clamped to the axis); a pending hold at the end is over */
export function setMeerTime(time: number) {
  hold = 0;
  st = { ...st, time: clampTime(time) };
  notify();
}
export function setMeerPlaying(playing: boolean) {
  if (playing === st.playing) return;
  hold = 0;
  // Play at the end of the axis starts over
  const r = meerRange();
  st = { ...st, playing, time: playing && st.time >= r.hi ? r.lo : st.time };
  notify();
}
export function setMeerSpeed(speed: MeerSpeed) {
  if (speed === st.speed || !MEER_SPEEDS.includes(speed)) return;
  st = { ...st, speed };
  notify();
}
/** The model reports the day it has simulated to (null: no model limits the clock). Does not notify. */
export function setMeerGate(day: number | null) {
  gate = day;
}
export const meerGate = (): number | null => gate;

/**
 * Advances the clock by `dtMs` of real time while it plays; returns the new time. A gate (a coupled model that lags) stops the clock
 * at the model's day: it waits instead of running ahead. At the end of the axis the last picture holds for HOLD_MS, then the clock
 * starts over at the beginning.
 */
export function tickMeer(dtMs: number): number {
  if (!st.playing || !(dtMs > 0)) return st.time;
  if (hold > 0) {
    hold -= dtMs;
    if (hold <= 0) {
      hold = 0;
      st = { ...st, time: meerRange().lo };
      tickSubs.forEach((fn) => fn());
    }
    return st.time;
  }
  let t = st.time + dtMs * meerDaysPerMs();
  // never backwards, and never beyond what the model has reached
  if (gate !== null && t > gate) t = Math.max(st.time, gate);
  const end = meerRange().hi;
  if (t >= end) {
    t = end;
    hold = HOLD_MS;
  }
  if (t !== st.time) {
    st = { ...st, time: t };
    tickSubs.forEach((fn) => fn());
  }
  return st.time;
}

/** back to the start values (tests) */
export function resetMeer() {
  st = initial();
  for (const k of Object.keys(layerRange) as MeerLayer[]) delete layerRange[k];
  gate = null;
  hold = 0;
}
