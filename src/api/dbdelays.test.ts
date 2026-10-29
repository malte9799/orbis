import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Departure, Itinerary, Leg } from './connections';

const mem = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
};
mem.set('wg.keys', JSON.stringify({ pushWorker: 'https://worker.example' }));
const { departuresWithDelays, planned, plannedDeps, resetDelaysPause, withDelays } = await import('./dbdelays');

const T = (m: number) => Date.UTC(2026, 9, 29, 6, m);
const leg = (over: Partial<Leg> = {}): Leg => ({ mode: 'REGIONAL_FAST_RAIL', line: 'RE8', headsign: 'Wismar', from: 'Bad Kleinen Bahnhof', to: 'Wismar', dep: T(12), arr: T(27), schedDep: T(12), schedArr: T(27), delayMin: 0, arrDelayMin: 0, cancelled: false, via: [], ...over });
const itin = (legs: Leg[]): Itinerary => ({ dep: legs[0].dep, arr: legs[legs.length - 1].arr, transfers: 0, legs });

describe('planned', () => {
  it('drops the unconfirmed Transitous delays of rail but keeps buses', () => {
    const it = planned(itin([leg({ dep: T(15), delayMin: 3 }), leg({ mode: 'BUS', line: '52', dep: T(40), schedDep: T(37), delayMin: 3 })]));
    expect(it.legs[0]).toMatchObject({ dep: T(12), delayMin: null });
    expect(it.legs[1]).toMatchObject({ dep: T(40), delayMin: 3 });
  });
});

describe('withDelays', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetDelaysPause();
  });
  const serve = (fn: (queries: { station: string; ts: number; kind: string; line: string }[]) => unknown, status = 200) =>
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => new Response(JSON.stringify({ results: fn(JSON.parse(init.body).queries) }), { status })));

  it('merges delay, platform and cancellation into the rail legs', async () => {
    const asked: unknown[] = [];
    serve((qs) => {
      asked.push(...qs);
      return qs.map((q) => (q.kind === 'dep' ? { delayMin: 15, cancelled: false, track: '1' } : { delayMin: 14, cancelled: false, track: '3' }));
    });
    const list = [itin([leg(), leg({ mode: 'BUS', line: '52', from: 'Wismar', to: 'Ziel', dep: T(35), arr: T(50), schedDep: T(35), schedArr: T(50) })])];
    const [it] = await withDelays(list);
    expect(asked).toHaveLength(2); // only the rail leg is asked: its departure and its arrival
    expect(it.delaySrc).toBe('db');
    expect(it.legs[0]).toMatchObject({ delayMin: 15, dep: T(27), arrDelayMin: 14, arr: T(41), track: '1', toTrack: '3' });
    expect(it.legs[1].delayMin).toBe(0);
    expect(it.dep).toBe(T(27));
  });
  it('returns the very same list when nothing matched or the worker is not set up', async () => {
    serve((qs) => qs.map(() => null));
    const list = [itin([leg()])];
    expect(await withDelays(list)).toBe(list);
  });
  it('does not wait again after a failure', async () => {
    const f = vi.fn(async () => new Response('no', { status: 501 }));
    vi.stubGlobal('fetch', f);
    const list = [itin([leg()])];
    expect(await withDelays(list)).toBe(list);
    expect(await withDelays(list)).toBe(list);
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe('departures', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetDelaysPause();
  });
  const dep = (over: Partial<Departure> = {}): Departure => ({ mode: 'REGIONAL_FAST_RAIL', line: 'RE8', headsign: 'Wismar', time: T(12), sched: T(12), delayMin: 0, cancelled: false, ...over });
  it('shows planned times for rail and merges the DB delays', async () => {
    expect(plannedDeps([dep({ time: T(20), delayMin: 8 }), dep({ mode: 'BUS', line: '5', time: T(20), delayMin: 8 })]).map((d) => [d.time, d.delayMin])).toEqual([[T(12), null], [T(20), 8]]);
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: { body: string }) => new Response(JSON.stringify({ results: JSON.parse(init.body).queries.map(() => ({ delayMin: 15, cancelled: false, track: '1' })) }), { status: 200 })));
    const [d] = await departuresWithDelays('Bad Kleinen', [dep()]);
    expect(d).toMatchObject({ delayMin: 15, time: T(27), track: '1', delaySrc: 'db' });
  });
});
