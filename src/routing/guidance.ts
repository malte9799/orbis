import { cumulative, snapToLine, type Snap } from './geo';
import type { LngLat, Route } from './types';

/** a route prepared for guidance: cumulative distances and where along the line every manoeuvre happens */
export interface Prepared {
  route: Route;
  cum: number[];
  /** length of the geometry in m */
  length: number;
  /** distance along the line of every step's manoeuvre */
  stepAt: number[];
}

export function prepare(route: Route): Prepared {
  const cum = cumulative(route.geometry);
  const length = cum[cum.length - 1] ?? 0;
  const stepAt: number[] = [];
  let from = 0;
  for (const [i, s] of route.steps.entries()) {
    if (i === 0) {
      stepAt.push(0);
      continue;
    }
    // manoeuvres come in route order: look from the previous one on, so a road passed twice is not mixed up
    const sn = snapToLine(route.geometry, cum, s.at, from, 2000);
    const a = s.maneuver === 'arrive' && i === route.steps.length - 1 ? length : Math.max(sn?.along ?? stepAt[i - 1], stepAt[i - 1]);
    stepAt.push(a);
    if (sn) from = sn.index;
  }
  return { route, cum, length, stepAt };
}

export interface Progress {
  snap: Snap;
  /** m travelled on the route */
  along: number;
  /** m, seconds still to go */
  remaining: number;
  remainingTime: number;
  /** index of the upcoming manoeuvre in route.steps */
  next: number;
  /** m to that manoeuvre */
  toNext: number;
  /** the next manoeuvre after it, for a "then …" hint */
  after: number | null;
  arrived: boolean;
}

export interface GuideState {
  /** segment index we were at (the search only looks forward from here) */
  index: number;
  /** consecutive fixes far off the line */
  strays: number;
}

export const newGuideState = (): GuideState => ({ index: 0, strays: 0 });

/** how far from the line counts as "off the route" (m): generous with a bad GPS signal */
export const offRouteLimit = (accuracy: number) => Math.max(40, accuracy * 2.5);

/** next manoeuvre starts being "current" this many m before its point, so the banner flips in time */
const LEAD = 12;

/**
 * Where on the route is the position? Only the stretch ahead of the last known segment is searched first
 * (loops and out-and-back routes), a full search only runs when the position is far from that.
 * Returns null for a position far off the route.
 */
export function progress(p: Prepared, pos: LngLat, accuracy: number, st: GuideState): Progress | null {
  const g = p.route.geometry;
  let sn = snapToLine(g, p.cum, pos, Math.max(0, st.index - 3), 250);
  if (!sn || sn.offset > offRouteLimit(accuracy)) {
    const full = snapToLine(g, p.cum, pos);
    // back on the route somewhere else (cut a corner, skipped a stretch)
    if (full && (!sn || full.offset < sn.offset - 10)) sn = full;
  }
  if (!sn) return null;
  const off = sn.offset > offRouteLimit(accuracy);
  st.strays = off ? st.strays + 1 : 0;
  if (!off) st.index = sn.index;
  if (off) return null;

  const along = sn.along;
  const steps = p.route.steps;
  let next = steps.length - 1;
  for (let i = 1; i < steps.length; i++) {
    if (p.stepAt[i] > along + LEAD) {
      next = i;
      break;
    }
  }
  const remaining = Math.max(0, p.length - along);
  // time: the steps after the current one in full, the current one in proportion
  let t = 0;
  for (let i = 0; i < steps.length; i++) {
    const start = p.stepAt[i];
    const end = i + 1 < steps.length ? p.stepAt[i + 1] : p.length;
    if (end <= along) continue;
    const span = Math.max(1, end - start);
    t += steps[i].duration * Math.min(1, (end - Math.max(start, along)) / span);
  }
  // some providers leave step durations empty: then scale the total
  if (!(t > 0)) t = p.route.duration * (p.length ? remaining / p.length : 0);
  const arrived = remaining < Math.max(20, accuracy);
  return {
    snap: sn,
    along,
    remaining,
    remainingTime: t,
    next,
    toNext: Math.max(0, p.stepAt[next] - along),
    after: next + 1 < steps.length ? next + 1 : null,
    arrived,
  };
}
