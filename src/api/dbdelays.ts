import { fetchJson } from '../util';
import type { Departure, Itinerary, Leg } from './connections';
import { pushBase } from './pushnotify';
import { RAIL_MODES } from './transit';

// Real-time delays of rail from the DB timetable data (official DB API Marketplace, "Timetables"). The key lives
// in our worker (proxy/fahrplan-push-worker.js, POST /db/delays), so every user gets the data without an own key.
// Transitous shows the connections at once; this merges the exact delays, platforms and cancellations in later.
// Only rail the DB timetable knows is matched – buses, trams and other operators keep what Transitous says.

interface Query {
  station: string;
  ts: number;
  kind: 'dep' | 'arr';
  line: string;
}
interface Hit {
  delayMin: number | null;
  cancelled: boolean;
  track?: string;
  trackChanged?: boolean;
}

/** the worker is set up (user setting or built in) */
export const delaysConfigured = (): boolean => !!pushBase();

let pausedUntil = 0;
let failures = 0;
/** for tests */
export const resetDelaysPause = () => {
  pausedUntil = 0;
  failures = 0;
};

async function lookup(queries: Query[]): Promise<(Hit | null)[]> {
  const none = queries.map(() => null);
  if (!queries.length || !pushBase() || Date.now() < pausedUntil) return none;
  const chunks: Query[][] = [];
  for (let i = 0; i < queries.length; i += 40) chunks.push(queries.slice(i, i + 40));
  try {
    const parts = await Promise.all(
      chunks.map((queries) => fetchJson<{ results: (Hit | null)[] }>(`${pushBase()}/db/delays`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ queries }) }, 15000).then((r) => r.results)),
    );
    failures = 0;
    return parts.flat();
  } catch {
    // not set up (501), down or unreachable: do not make every search wait for it. A single hiccup
    // (a dropout on the train) only costs 30 s; the pause doubles with every failure in a row, up to 5 min.
    pausedUntil = Date.now() + Math.min(30000 * 2 ** failures++, 5 * 60000);
    return none;
  }
}

const isRail = (mode: string) => RAIL_MODES.has(mode);
const keyOf = (q: Query) => `${q.station}|${q.ts}|${q.kind}|${q.line}`;

/** Planned times only for rail rides (their Transitous delays are not trustworthy) while the DB data loads. */
export function planned(it: Itinerary): Itinerary {
  const legs = it.legs.map((l): Leg => (isRail(l.mode) ? { ...l, dep: l.schedDep, arr: l.schedArr, delayMin: null, arrDelayMin: null, via: l.via.map((v) => ({ ...v, delayMin: null })) } : l));
  return { ...it, legs, dep: legs[0]?.dep ?? it.dep, arr: legs[legs.length - 1]?.arr ?? it.arr };
}

/** Planned departure times only for rail while the DB data loads. */
export const plannedDeps = (list: Departure[]): Departure[] => list.map((d) => (isRail(d.mode) ? { ...d, time: d.sched, delayMin: null } : d));

/** The connections with the DB real-time data merged in; `list` itself when nothing matched. */
export async function withDelays(list: Itinerary[]): Promise<Itinerary[]> {
  const qs = new Map<string, Query>();
  for (const it of list) {
    for (const l of it.legs) {
      if (!isRail(l.mode) || !l.line) continue;
      for (const q of [{ station: l.from, ts: l.schedDep, kind: 'dep' as const, line: l.line }, { station: l.to, ts: l.schedArr, kind: 'arr' as const, line: l.line }]) qs.set(keyOf(q), q);
    }
  }
  const queries = [...qs.values()];
  const results = new Map(queries.map((q) => [keyOf(q), null as Hit | null]));
  (await lookup(queries)).forEach((h, i) => results.set(keyOf(queries[i]), h));
  if (![...results.values()].some(Boolean)) return list;
  return list.map((it) => {
    let matched = false;
    const legs = it.legs.map((l): Leg => {
      if (!isRail(l.mode) || !l.line) return l;
      const d = results.get(keyOf({ station: l.from, ts: l.schedDep, kind: 'dep', line: l.line }));
      const a = results.get(keyOf({ station: l.to, ts: l.schedArr, kind: 'arr', line: l.line }));
      if (!d && !a) return l;
      matched = true;
      return {
        ...l,
        // per side: a leg matched only by its arrival keeps the Transitous departure delay, and the other way round
        ...(d ? { delaySrc: 'db' as const, delayMin: d.delayMin, dep: l.schedDep + (d.delayMin ?? 0) * 60000, track: d.track ?? l.track, trackChanged: d.trackChanged || l.trackChanged, cancelled: l.cancelled || d.cancelled } : {}),
        ...(a ? { arrDelaySrc: 'db' as const, arrDelayMin: a.delayMin, arr: l.schedArr + (a.delayMin ?? 0) * 60000, toTrack: a.track ?? l.toTrack, toTrackChanged: a.trackChanged || l.toTrackChanged, cancelled: l.cancelled || a.cancelled } : {}),
      };
    });
    return matched ? { ...it, legs, dep: legs[0].dep, arr: legs[legs.length - 1].arr, delaySrc: 'db' } : it;
  });
}

/** The departures of one stop with the DB real-time data merged in. */
export async function departuresWithDelays(station: string, list: Departure[]): Promise<Departure[]> {
  const queries = list.filter((d) => isRail(d.mode) && d.line).map((d): Query => ({ station, ts: d.sched, kind: 'dep', line: d.line }));
  const hits = await lookup(queries);
  const byKey = new Map(queries.map((q, i) => [keyOf(q), hits[i]]));
  if (![...byKey.values()].some(Boolean)) return list;
  return list.map((d) => {
    const h = isRail(d.mode) && d.line ? byKey.get(keyOf({ station, ts: d.sched, kind: 'dep', line: d.line })) : null;
    return h ? { ...d, time: d.sched + (h.delayMin ?? 0) * 60000, delayMin: h.delayMin, track: h.track ?? d.track, trackChanged: h.trackChanged || d.trackChanged, cancelled: d.cancelled || h.cancelled, delaySrc: 'db' } : d;
  });
}
