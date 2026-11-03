import { describe, expect, it } from 'vitest';
import { VerticalAnchor, type GroundMeasure } from './verticalAnchor';

const T0 = 1000;
const at: [number, number] = [7, 51];

const step = (a: VerticalAnchor, n: number, m: GroundMeasure, terrain: number | null = null, t: [number, number] = at) =>
  a.tick(T0 + n * 400, t, () => m, terrain);

describe('VerticalAnchor', () => {
  it('lowers the set by its ground without terrain and locks on the first fine measurement', () => {
    const a = new VerticalAnchor();
    expect(step(a, 0, { h: 52, fine: false })).toBe(52);
    expect(a.settled).toBe(false); // coarse only: not yet trusted
    expect(step(a, 1, { h: 53, fine: true })).toBe(53);
    expect(a.settled).toBe(true);
    expect(step(a, 2, { h: 999, fine: true })).toBe(53); // frozen: the moving measurement no longer moves the set
  });

  it('locks without a fine signal on two agreeing measurements', () => {
    const a = new VerticalAnchor();
    step(a, 0, { h: 52, fine: false });
    step(a, 1, { h: 55, fine: false }); // still drifting
    step(a, 2, { h: 52.3, fine: false }); // still drifting
    expect(a.settled).toBe(false);
    step(a, 3, { h: 52.4, fine: false }); // agrees with the previous one
    expect(a.settled).toBe(true);
  });

  it('keeps measuring while the coarse measurements still drift', () => {
    const a = new VerticalAnchor();
    step(a, 0, { h: 40, fine: false });
    step(a, 1, { h: 46, fine: false });
    step(a, 2, { h: 51, fine: false });
    expect(a.settled).toBe(false);
    step(a, 3, { h: 52, fine: true });
    expect(a.settled).toBe(true);
    expect(a.ground).toBe(52);
  });

  it('pairs ground and terrain at the same moment and keeps the difference constant afterwards', () => {
    const a = new VerticalAnchor();
    // an ellipsoidal set: its ground lies ~48 m above the geoid-referenced terrain
    step(a, 0, { h: 100, fine: false }, 52);
    expect(a.offset).toBe(48);
    expect(a.settled).toBe(false);
    step(a, 1, { h: 101, fine: true }, 52.5);
    expect(a.offset).toBe(48.5);
    expect(a.settled).toBe(true);
    // panning changes both ground and terrain: the frozen difference must not move
    expect(a.tick(T0 + 3 * 400, [7.05, 51.02], () => ({ h: 140, fine: true }), 88)).toBe(48.5);
  });

  it('ignores a terrain elevation of 0 while the dem tile has not arrived, and pairs once it has', () => {
    const a = new VerticalAnchor();
    step(a, 0, { h: 120, fine: true }, 0); // 0 under a 120 m ground: dem not loaded, not usable
    expect(a.settled).toBe(false);
    expect(a.offset).toBeNull(); // nothing applied: the set keeps its raw heights
    step(a, 1, { h: 120, fine: true }, null); // terrain off in the meantime
    expect(a.settled).toBe(false); // the pairing is still pending
    step(a, 2, { h: 120, fine: true }, 52);
    expect(a.settled).toBe(true);
    expect(a.offset).toBe(68);
  });

  it('applies the flat placement when the terrain is off, even after a pending pairing', () => {
    const a = new VerticalAnchor();
    step(a, 0, { h: 120, fine: true }, 0); // pairing blocked by the missing dem
    expect(step(a, 1, { h: 120, fine: true }, null)).toBe(120); // terrain off: lowered onto the flat map
  });

  it('rejects an implausible pairing (hundreds of metres) instead of sinking the set', () => {
    const a = new VerticalAnchor();
    step(a, 0, { h: 100, fine: true }, 400);
    expect(a.offset).toBeNull(); // no shift applied, the set keeps its raw heights
    expect(a.settled).toBe(false); // a better terrain reading may still arrive
    step(a, 1, { h: 100, fine: true }, 52);
    expect(a.offset).toBe(48);
    expect(a.settled).toBe(true);
  });

  it('locks at the timeout even without agreement or fine geometry', () => {
    const a = new VerticalAnchor();
    a.tick(T0, at, () => ({ h: 50, fine: false }), null);
    a.tick(T0 + 400, at, () => ({ h: 55, fine: false }), null);
    const off = a.tick(T0 + 10000, at, () => ({ h: 60, fine: false }), null);
    expect(a.settled).toBe(true);
    expect(off).toBe(60);
    expect(a.tick(T0 + 10400, at, () => ({ h: 70, fine: false }), null)).toBe(60);
  });

  it('re-pairs after the view centre moved far away', () => {
    const a = new VerticalAnchor();
    step(a, 0, { h: 52, fine: true }, 50); // locks flat 52 and pair 2
    expect(a.settled).toBe(true);
    // ~72 km east, and the datum difference has drifted: the pairing must be measured again
    step(a, 1, { h: 30, fine: true }, 10, [7.65, 51]);
    expect(a.offset).toBe(20);
    expect(a.settled).toBe(true);
    expect(a.ground).toBe(30); // fresh ground for the loading order
  });

  it('keeps the last offset while nothing is measurable (flying over gaps)', () => {
    const a = new VerticalAnchor();
    step(a, 0, { h: 52, fine: true });
    expect(step(a, 1, { h: null, fine: false })).toBe(52);
  });
});
