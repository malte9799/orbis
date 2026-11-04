import { afterEach, describe, expect, it } from 'vitest';
import { areaMio, modelFilter, modelLabel } from './plastikmodell';
import { plastikCount, plastikModelArea, plastikYear, plastikYears, setPlastikYears, sliderYears } from './plastiktime';
import { resetMeer, setMeerTime, yearStartDay } from './meerzeit';

import outlinesJson from '../../../../public/data/plastik/gpgp-model-outlines.geojson?raw';
import metaJson from '../../../../public/data/plastik/gpgp-model-meta.json';

afterEach(() => {
  setPlastikYears([]);
  resetMeer();
});

describe('slider years with the model', () => {
  it('are the model years without a gap plus the tow years', () => {
    expect(sliderYears([1972, 2008], [{ y: 1950, a: 0 }, { y: 1955, a: 0 }, { y: 1953, a: 0 }])).toEqual([1950, 1951, 1952, 1953, 1954, 1955, 1972, 2008]);
    expect(sliderYears([2008, 1972, 2008], [])).toEqual([1972, 2008]);
  });
  it('count 0 tows for model years without a tow, and know the model area', () => {
    setPlastikYears([1972, 1972, 1975], [{ y: 1970, a: 0 }, { y: 1976, a: 1_600_000 }]);
    expect(plastikYears()).toEqual([1970, 1971, 1972, 1973, 1974, 1975, 1976]);
    // the shared clock starts in 1950: before the first model year nothing is shown, after the last one the last
    expect(plastikYear()).toBeNull();
    setMeerTime(yearStartDay(1973));
    expect(plastikYear()).toBe(1973);
    setMeerTime(yearStartDay(2022));
    expect(plastikYear()).toBe(1976);
    expect(plastikCount(1973)).toBe(0);
    expect(plastikCount(1972)).toBe(2);
    expect(plastikModelArea(1976)).toBe(1_600_000);
    expect(plastikModelArea(1970)).toBe(0);
    expect(plastikModelArea(1999)).toBeNull();
    // the same lists again keep the shown year
    setPlastikYears([1972, 1972, 1975], [{ y: 1970, a: 0 }, { y: 1976, a: 1_700_000 }]);
    expect(plastikYear()).toBe(1976);
  });
});

describe('model outline expressions and texts', () => {
  it('filters exactly the shown year', () => {
    expect(modelFilter(2015)).toEqual(['==', ['get', 'y'], 2015]);
    expect(modelFilter(null)).toEqual(['==', ['get', 'y'], 0]);
    expect(modelLabel(2015)).toBe('Modell-Umriss 2015 (kalibriert auf 2015)');
  });
  it('writes the area of the outline', () => {
    expect(areaMio(1_600_000)).toBe('1,60 Mio. km²');
    expect(areaMio(5000)).toBeNull();
    expect(areaMio(null)).toBeNull();
  });
});

describe('gpgp-model-outlines.geojson', () => {
  const feats = JSON.parse(outlinesJson).features as { properties: { y: number; a: number }; geometry: { type: string; coordinates: number[][][] } }[];
  const years = feats.map((f) => f.properties.y);
  it('has exactly one feature per year, without a gap', () => {
    expect(new Set(years).size).toBe(years.length);
    const lo = Math.min(...years);
    const hi = Math.max(...years);
    expect(lo).toBe(1950);
    expect(hi).toBeGreaterThanOrEqual(2022);
    expect(years).toHaveLength(hi - lo + 1);
  });
  it('has lines (or none, without an area) in the longitude range 120..260', () => {
    for (const f of feats) {
      expect(f.geometry.type).toBe('MultiLineString');
      if (f.properties.a === 0) expect(f.geometry.coordinates).toHaveLength(0);
      else expect(f.geometry.coordinates.length).toBeGreaterThan(0);
      for (const line of f.geometry.coordinates) for (const [x, y] of line) {
        expect(x).toBeGreaterThanOrEqual(120);
        expect(x).toBeLessThanOrEqual(260);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(60);
      }
    }
  });
  it('is calibrated to about 1.6 million km² in 2015 and marked experimental', () => {
    const a = feats.find((f) => f.properties.y === 2015)!.properties.a;
    expect(a).toBeGreaterThan(1_550_000);
    expect(a).toBeLessThan(1_650_000);
    expect(metaJson.experimental).toBe(true);
    expect(metaJson.hinweis).toMatch(/keine Messung/);
  });
  it('stays small', () => {
    expect(outlinesJson.length).toBeLessThan(600 * 1024);
  });
});
