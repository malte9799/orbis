import { describe, expect, it } from 'vitest';
import type { Itinerary } from './connections';
import { matchesRun, stillUseful, worthKeeping, KEEP_AFTER_MS, KEEP_AHEAD_MS, type StoredRun } from './triprun';

const H = 3600000;
const NOW = Date.parse('2026-10-29T08:00:00Z');
const itin = (dep: number, arr: number): Itinerary => ({ dep, arr, transfers: 0, legs: [] });
const stored = (dep: number, arr: number): StoredRun => ({ at: NOW - 60000, dep, today: true, it: itin(dep, arr) });

describe('worthKeeping', () => {
  it('keeps what runs soon and what runs right now', () => {
    expect(worthKeeping({ dep: NOW + H }, itin(NOW + H, NOW + 2 * H), NOW)).toBe(true);
    expect(worthKeeping({ dep: NOW - 10 * 60000 }, itin(NOW - 10 * 60000, NOW + 20 * 60000), NOW)).toBe(true);
  });
  it('skips what is far ahead or long over', () => {
    expect(worthKeeping({ dep: NOW + KEEP_AHEAD_MS + 60000 }, itin(NOW + KEEP_AHEAD_MS + 60000, NOW + KEEP_AHEAD_MS + H), NOW)).toBe(false);
    expect(worthKeeping({ dep: NOW - 2 * H }, itin(NOW - 2 * H, NOW - H), NOW)).toBe(false);
  });
});

describe('kept runs', () => {
  it('are of use until shortly after arrival', () => {
    expect(stillUseful(stored(NOW, NOW + H), NOW)).toBe(true);
    expect(stillUseful(stored(NOW - 2 * H, NOW - H), NOW)).toBe(false);
    expect(stillUseful(stored(NOW - 2 * H, NOW - KEEP_AFTER_MS + 1000), NOW)).toBe(true);
  });
  it('answer only for the same departure', () => {
    const s = stored(NOW + H, NOW + 2 * H);
    expect(matchesRun(s, { dep: NOW + H }, NOW)).toBe(true);
    expect(matchesRun(s, { dep: NOW + 25 * H }, NOW)).toBe(false);
    expect(matchesRun(undefined, { dep: NOW + H }, NOW)).toBe(false);
  });
});
