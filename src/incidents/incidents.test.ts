import { describe, expect, it } from 'vitest';
import { indexAt, sampleAt } from './track';
import type { TrackPoint } from './types';

const pts: TrackPoint[] = [
  [100, 10, 20, 1000, 200, 350],
  [110, 11, 22, 2000, 220, 10],
  [120, 12, 24, null, 240, 10],
];

describe('Flugspur', () => {
  it('findet den Punkt davor', () => {
    expect(indexAt(pts, 99)).toBe(-1);
    expect(indexAt(pts, 100)).toBe(0);
    expect(indexAt(pts, 115)).toBe(1);
    expect(indexAt(pts, 500)).toBe(2);
  });
  it('interpoliert Position, Höhe, Tempo und Sinkrate', () => {
    const s = sampleAt(pts, 105);
    expect(s.lat).toBeCloseTo(10.5);
    expect(s.lon).toBeCloseTo(21);
    expect(s.alt).toBeCloseTo(1500);
    expect(s.gs).toBeCloseTo(210);
    expect(s.vs).toBeCloseTo(6000);
  });
  it('dreht den Kurs über Nord auf dem kurzen Weg', () => {
    expect(sampleAt(pts, 105).trk).toBeCloseTo(0);
  });
  it('schreibt ohne Messwert die letzte Sinkrate fort, bis der Boden erreicht ist', () => {
    const tail: TrackPoint[] = [
      [100, 10, 20, 3000, 200, 0],
      [110, 10, 20, 2000, 200, 0],
      [120, 10, 20, null, 200, 0],
      [130, 10, 20, null, 200, 0],
    ];
    const s = sampleAt(tail, 115);
    expect(s.alt).toBeCloseTo(1500);
    expect(s.altHeld).toBe(true);
    expect(s.vs).toBeCloseTo(-6000);
    // nach dem letzten Punkt weiter, am Boden Schluss
    expect(sampleAt(tail, 125).alt).toBeCloseTo(500);
    expect(sampleAt(tail, 500).alt).toBe(0);
    expect(sampleAt(tail, 500).vs).toBe(0);
  });
  it('füllt eine Höhenlücke zwischen zwei Messwerten linear', () => {
    const gap: TrackPoint[] = [
      [100, 10, 20, 4000, 200, 0],
      [110, 10, 21, null, 200, 0],
      [120, 10, 22, 0, 200, 0],
    ];
    const s = sampleAt(gap, 110);
    expect(s.alt).toBeCloseTo(2000);
    expect(s.altHeld).toBe(true);
    expect(s.vs).toBeCloseTo(-12000);
    expect(sampleAt(gap, 120).alt).toBe(0);
  });
  it('klemmt außerhalb der Spur', () => {
    expect(sampleAt(pts, 0).lat).toBe(10);
    expect(sampleAt(pts, 999).t).toBe(120);
  });
});
