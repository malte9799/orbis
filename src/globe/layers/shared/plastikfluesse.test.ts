import { describe, expect, it } from 'vitest';
import { fmtRank, fmtTons, maxRankAt, radiusAt, radiusExpr } from './plastikfluesse';

describe('plastikfluesse', () => {
  it('formats tons the German way', () => {
    expect(fmtTons(62600)).toBe('62.600 t/Jahr');
    expect(fmtTons(3)).toBe('3 t/Jahr');
    expect(fmtTons(3.5)).toBe('3,5 t/Jahr');
  });
  it('words the rank', () => {
    expect(fmtRank(1)).toBe('Platz 1 von 31.819 Mündungen im Modell');
  });
  it('grows with t and zoom', () => {
    expect(radiusAt(60000, 2)).toBeGreaterThan(radiusAt(3, 2));
    expect(radiusAt(100, 7)).toBeGreaterThan(radiusAt(100, 1));
  });
  it('shows more ranks with zoom', () => {
    expect(maxRankAt(0.5)).toBe(300);
    expect(maxRankAt(2)).toBe(300);
    expect(maxRankAt(3.5)).toBe(2000);
    expect(maxRankAt(5)).toBe(Infinity);
  });
  it('builds a zoom interpolation for the radius', () => {
    const e = radiusExpr() as unknown[];
    expect(e.slice(0, 3)).toEqual(['interpolate', ['linear'], ['zoom']]);
  });
});
