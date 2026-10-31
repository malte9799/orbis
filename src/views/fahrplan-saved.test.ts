import { describe, expect, it } from 'vitest';
import type { Itinerary } from '../api/connections';

// fahrplan-saved.ts pulls in the DOM-bound search module; only the pure helpers are tested here
const mem = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
};
// the de strings are asserted below: force German before the module is imported
const { setLang } = await import('../i18n');
setLang('de');
const { daysTxt, nextRun, findTrip } = await import('./fahrplan-saved');

describe('daysTxt', () => {
  it('names common patterns', () => {
    expect(daysTxt([1, 2, 3, 4, 5])).toBe('Mo–Fr');
    expect(daysTxt([0, 1, 2, 3, 4, 5, 6])).toBe('täglich');
    expect(daysTxt([6, 0])).toBe('Sa, So');
    expect(daysTxt([1, 3])).toBe('Mo, Mi');
    expect(daysTxt([])).toBe('nie');
  });
});

describe('nextRun', () => {
  // Thursday 2026-10-29
  const at = (h: number, m: number) => new Date(2026, 9, 29, h, m);
  it('is today while the train is still relevant', () => {
    const r = nextRun({ hm: '07:12', days: [1, 2, 3, 4, 5] }, at(7, 30));
    expect(r?.today).toBe(true);
    expect(new Date(r!.dep).getHours()).toBe(7);
  });
  it('skips to the next chosen weekday once it is long gone', () => {
    const r = nextRun({ hm: '07:12', days: [1, 2, 3, 4, 5] }, at(12, 0));
    expect(r?.today).toBe(false);
    expect(new Date(r!.dep).getDay()).toBe(5); // Friday
  });
  it('wraps over the weekend and handles no days', () => {
    const fri = new Date(2026, 9, 30, 12, 0);
    expect(new Date(nextRun({ hm: '07:12', days: [1, 2, 3, 4, 5] }, fri)!.dep).getDay()).toBe(1);
    expect(nextRun({ hm: '07:12', days: [] }, fri)).toBeNull();
  });
});

describe('findTrip', () => {
  const itin = (line: string, dep: number): Itinerary => ({ dep, arr: dep + 1, transfers: 0, legs: [{ mode: 'REGIONAL_RAIL', line, headsign: '', from: 'A', to: 'B', dep, arr: dep + 1, schedDep: dep, schedArr: dep + 1, delayMin: 14, arrDelayMin: 14, cancelled: false, via: [] }] });
  it('matches line and scheduled time, not the delayed time', () => {
    const list = [itin('RE 1', 1000000), itin('RE 8', 1000000), itin('RE 8', 5000000)];
    expect(findTrip(list, { line: 'RE 8' }, 1000000)).toBe(list[1]);
    expect(findTrip(list, { line: 'RE 9' }, 1000000)).toBeNull();
  });
});
