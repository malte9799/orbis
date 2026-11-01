import { describe, expect, it } from 'vitest';
import { PlaneTracker, type PlaneReport, type RunwayRef } from './planes3d';

// Synthetic runway east of a point, heading 90° (towards east), 3 km long.
const RWY: RunwayRef = { thLon: 7.0, thLat: 49.0, hdg: 90, lenM: 3000 };
const M_PER_DEG = 111320;
const cos49 = Math.cos((49 * Math.PI) / 180);
/** `m` metres before the threshold on the extended centre line (negative: past the threshold, on the runway) */
const at = (m: number): { lon: number; lat: number } => ({ lon: 7.0 - m / (M_PER_DEG * cos49), lat: 49.0 });

const report = (over: Partial<PlaneReport> = {}): PlaneReport => ({
  hex: 'abc123',
  ...at(8000),
  altM: 500,
  vsMs: -3.5,
  track: 90,
  speedMs: 75,
  ground: false,
  model: 'narrow',
  emergency: false,
  rwy: RWY,
  props: {},
  ...over,
});

describe('PlaneTracker start & landing', () => {
  it('a landing aircraft is kept on the approach centre line with a nose-down attitude', () => {
    const t = new PlaneTracker();
    // 1. approach: 8 km before the threshold, at the 3° glide path (418 m)
    t.feed([report({ lat: 49.011 })], 0); // 1.2 km off the line
    for (let i = 0; i < 40; i++) t.step(i * 50);
    feA(t, { ...at(4000), altM: 220, vsMs: -3.5 }, 10000);
    for (let i = 40; i < 100; i++) t.step(10000 + (i - 40) * 50); // 3 s approach
    const p = t.planes.get('abc123')!;
    expect(p.phase).toBe('approach');
    const latOff = Math.abs((p.dLat - 49) * M_PER_DEG);
    expect(latOff).toBeLessThan(400); // clearly pulled toward the line (from ~1200 m out)
    expect(p.dPitch).toBeLessThan(0); // nose down in the approach
  });

  it('touchdown: flare levels off softly, nose up briefly, landing roll centred on the runway', () => {
    const t = new PlaneTracker();
    t.feed([report({ ...at(800), altM: 30, vsMs: -4, track: 90 })], 0);
    for (let i = 0; i < 40; i++) t.step(i * 50); // 2 s
    const mid = t.planes.get('abc123')!;
    expect(mid.phase).toBe('flare');
    expect(mid.dPitch).toBeGreaterThan(1); // nose up for the flare
    expect(mid.dAlt).toBeLessThan(30); // still sinking
    expect(mid.dAlt).toBeGreaterThanOrEqual(0);
    // … after 10 s it has sunk in softly (exponential flare, no hard impact)
    for (let i = 40; i < 240; i++) t.step(i * 50);
    expect(t.planes.get('abc123')!.dAlt).toBeLessThan(12);
    // touchdown (ground report): centred on the runway, slight nose-up retained while rolling out
    t.feed([report({ ground: true, altM: 0, vsMs: 0, speedMs: 68, ...at(600) })], 12000);
    for (let i = 240; i < 420; i++) t.step(i * 50);
    const p = t.planes.get('abc123')!;
    expect(p.phase).toBe('landed');
    expect(Math.abs((p.dLat - 49) * M_PER_DEG)).toBeLessThan(30);
    expect(p.dPitch).toBeGreaterThanOrEqual(0); // no ducking
  });

  it('take-off: accelerating on the runway (roll), rotation nose up, then climb', () => {
    const t = new PlaneTracker();
    t.feed([report({ ground: true, altM: 0, vsMs: 0, speedMs: 40, ...at(-500) })], 0);
    t.feed([report({ ground: true, altM: 0, vsMs: 0, speedMs: 55, ...at(-750), lat: 49.0004 })], 10000);
    const p = t.planes.get('abc123')!;
    expect(p.phase).toBe('roll');
    for (let i = 0; i < 60; i++) t.step(20000 + i * 50);
    const off = t.planes.get('abc123')!;
    expect(Math.abs((off.dLat - 49) * M_PER_DEG)).toBeLessThan(30); // taken onto the centre line
    t.feed([report({ ground: false, altM: 30, vsMs: 4, speedMs: 78, ...at(-1300) })], 30000);
    expect(t.planes.get('abc123')!.phase).toBe('climb');
    for (let i = 60; i < 140; i++) t.step(30000 + (i - 60) * 50);
    const up = t.planes.get('abc123')!;
    expect(up.dPitch).toBeGreaterThan(2); // clearly nose up in the initial climb
    expect(up.dPitch).toBeLessThanOrEqual(14.001);
  });

  it('without a runway the display keeps working (no reference, no crash)', () => {
    const t = new PlaneTracker();
    for (let k = 0; k < 5; k++) t.feed([report({ rwy: undefined, ...at(8000 - k * 1000), altM: 500 - k * 100 })], k * 10000);
    for (let i = 0; i < 100; i++) t.step(50000 + i * 50);
    expect(t.planes.get('abc123')!.dAlt).toBeGreaterThan(0);
  });
});

/** feed a report at time `now` */
function feA(t: PlaneTracker, over: Partial<PlaneReport>, now: number) {
  t.feed([report(over)], now);
}
