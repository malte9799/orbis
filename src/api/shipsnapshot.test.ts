import { describe, expect, it } from 'vitest';
import { shipsFromSnapshot } from './transport';

const v = { mmsi: 1, lat: 1, lon: 2, sog: 0, cog: 0, heading: 0, at: 1 };

describe('shipsFromSnapshot', () => {
  it('reads the ships worker shape { vessels } and fills source', () => {
    const r = shipsFromSnapshot({ mode: 'vessels', vessels: [v], t: 1, source: 'aisstream.io' });
    expect(r).toEqual([{ ...v, source: 'aisstream.io' }]);
  });
  it('still reads { ships } and bare arrays, keeps an existing source', () => {
    expect(shipsFromSnapshot({ ships: [{ ...v, source: 'x' }] })?.[0].source).toBe('x');
    expect(shipsFromSnapshot([v])).toHaveLength(1);
  });
  it('returns null for anything else', () => {
    expect(shipsFromSnapshot(null)).toBeNull();
    expect(shipsFromSnapshot({ vessels: 'no' })).toBeNull();
  });
});
