import { describe, expect, it } from 'vitest';
import { indexAt, sampleAt } from './track';
import { embedOf } from './embed';
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

describe('Einbettung', () => {
  it('erkennt die Hoster', () => {
    expect(embedOf('https://www.facebook.com/reel/1643065457610833')?.src).toContain('plugins/video.php?href=https%3A%2F%2Fwww.facebook.com%2Freel%2F1643065457610833');
    expect(embedOf('https://www.reddit.com/r/aviation/comments/1xlcp7p/dashcam_footage/?utm=x')?.src).toBe('https://embed.reddit.com/r/aviation/comments/1xlcp7p/dashcam_footage/?embed=true&theme=dark&showmedia=true');
    expect(embedOf('https://youtu.be/abc123')?.src).toContain('youtube-nocookie.com/embed/abc123');
    expect(embedOf('https://x.com/AirNavRadar/status/2117026892192579691')?.src).toContain('id=2117026892192579691');
  });
  it('lässt Unbekanntes und Kaputtes als nicht einbettbar', () => {
    expect(embedOf('https://www.instagram.com/reels/DfNekoeguTB/')).toBeNull();
    expect(embedOf('https://example.com/video')).toBeNull();
    expect(embedOf('kein link')).toBeNull();
    expect(embedOf('https://www.reddit.com/r/aviation/')).toBeNull();
  });
});

describe('Titan-Rekonstruktion', () => {
  it('Definition und Spuren passen zusammen', async () => {
    const { readFileSync } = await import('node:fs');
    const { default: def } = await import('./defs/titan-2023-06-18');
    const load = (p: string) => (JSON.parse(readFileSync(`src/incidents/data/${p.slice(7)}`, 'utf8')) as { pts: TrackPoint[] }).pts;
    const sub = load(def.track);
    const ship = load(def.ship!.track);
    // Tiefen sind negativ, die Spur sinkt gleichmäßig bis 3.346 m und endet mit der Implosion
    expect(sub[0][3]).toBe(0);
    expect(sub.at(-1)![3]).toBeCloseTo(-3346.28);
    for (let i = 1; i < sub.length; i++) expect(sub[i][3]!).toBeLessThanOrEqual(sub[i - 1][3]!);
    // Schiff liegt beim Abtauchen am Tauchplatz
    const at = sampleAt(ship, sub[0][0]);
    expect(Math.hypot(at.lat - sub[0][1], at.lon - sub[0][2])).toBeLessThan(0.01);
    // Sinkrate rund 36 m/min
    expect(sampleAt(sub, sub[0][0] + 1800).vs!).toBeCloseTo(-35.9, 0);
    expect(def.events.some((e) => e.kind === 'impact' && e.t === sub.at(-1)![0])).toBe(true);
  });
});
