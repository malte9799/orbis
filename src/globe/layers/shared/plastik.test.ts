import { beforeEach, describe, expect, it } from 'vitest';
import { CORNERS_GLOBAL, CORNERS_GPGP, patchPolygon, SCALE_STOPS } from './plastikgeo';
import { plastikCount, plastikYear, plastikYears, setPlastikYears, subscribePlastik, yearAt } from './plastiktime';
import { meerRange, resetMeer, setMeerFocus, setMeerTime, yearStartDay } from './meerzeit';
import { TOW_NOW, TOW_OLD, towsFilter, towsOpacity, towsRadius } from './plastiktows';
import { chartSvg, lineLegend, panelHtml, logRange, massInSeries, type History } from './plastikchart';

import globalJson from '../../../../public/data/plastik/global-density.json';
import gpgpJson from '../../../../public/data/plastik/gpgp-density.json';
import contoursJson from '../../../../public/data/plastik/gpgp-contours.geojson?raw';
import towsJson from '../../../../public/data/plastik/gpgp-tows.geojson?raw';

describe('image corners', () => {
  it('match the JSON next to the pictures', () => {
    expect(CORNERS_GLOBAL).toEqual(globalJson.coordinates);
    expect(CORNERS_GPGP).toEqual(gpgpJson.coordinates);
  });
});

describe('colour scale', () => {
  it('is the scale of the GPGP picture', () => {
    expect(SCALE_STOPS).toEqual(gpgpJson.stops);
  });
});

describe('contour lines', () => {
  const feats = JSON.parse(contoursJson).features as { properties: { level: number; boundary?: boolean }; geometry: { coordinates: number[][][] } }[];
  it('have unique levels in g/km² and exactly one boundary (10 kg/km²)', () => {
    const levels = feats.map((f) => f.properties.level);
    expect(new Set(levels).size).toBe(levels.length);
    const b = feats.filter((f) => f.properties.boundary);
    expect(b).toHaveLength(1);
    expect(b[0].properties.level).toBe(10000);
  });
  it('lie in the longitude range of the picture and have no tiny scraps', () => {
    for (const f of feats) {
      expect(f.geometry.coordinates.length).toBeLessThan(10);
      for (const line of f.geometry.coordinates) for (const [x] of line) expect(x).toBeGreaterThanOrEqual(CORNERS_GPGP[0][0] - 0.5);
    }
  });
});

describe('net tows', () => {
  const fc = JSON.parse(towsJson) as { features: { properties: { y: number; m?: number; n?: number; s: string }; geometry: { coordinates: number[] } }[]; methods: Record<string, string> };
  it('have a position in -180..180, a year and a known method', () => {
    expect(fc.features.length).toBeGreaterThan(4000);
    for (const f of fc.features) {
      const [lon, lat] = f.geometry.coordinates;
      expect(lon).toBeGreaterThanOrEqual(-180);
      expect(lon).toBeLessThanOrEqual(180);
      expect(Math.abs(lat)).toBeLessThanOrEqual(90);
      expect(f.properties.y).toBeGreaterThan(1960);
      expect(Object.keys(fc.methods)).toContain(f.properties.s);
      expect(f.properties.m != null || f.properties.n != null).toBe(true);
    }
  });
});

describe('time slider state', () => {
  beforeEach(() => resetMeer());
  it('sorts the years and follows the calendar year of the shared clock', () => {
    let n = 0;
    const off = subscribePlastik(() => n++);
    setPlastikYears([2008, 1972, 2008, 2015]);
    expect(plastikYears()).toEqual([1972, 2008, 2015]);
    // 1950: before the first year, nothing
    expect(plastikYear()).toBeNull();
    setMeerTime(yearStartDay(1990) + 100);
    expect(plastikYear()).toBe(1972);
    setMeerTime(yearStartDay(2008));
    expect(plastikYear()).toBe(2008);
    // after the last year the last one stays
    setMeerTime(yearStartDay(2025));
    expect(plastikYear()).toBe(2015);
    off();
    const before = n;
    setMeerTime(yearStartDay(2010));
    expect(n).toBe(before);
    setPlastikYears([]);
  });
  it('tells the layer only when the shown year changes', () => {
    setPlastikYears([1972, 2008]);
    setMeerTime(yearStartDay(1980));
    let n = 0;
    const off = subscribePlastik(() => n++);
    setMeerTime(yearStartDay(1981));
    setMeerTime(yearStartDay(1999));
    expect(n).toBe(0);
    setMeerTime(yearStartDay(2008) + 5);
    expect(n).toBe(1);
    off();
    setPlastikYears([]);
  });
  it('holds its year while another layer is the focus, and jumps to the shared time with "Alle"', () => {
    setPlastikYears([1972, 2008, 2015]);
    setMeerTime(yearStartDay(2009));
    expect(plastikYear()).toBe(2008);
    setMeerFocus('bojen');
    setMeerTime(yearStartDay(1980));
    expect(plastikYear()).toBe(2008);
    setMeerFocus('all');
    // the shared time is the one from before the focus left "Alle"
    expect(plastikYear()).toBe(2008);
    setPlastikYears([]);
  });
  it('as the focus its axis runs from the first to the last year of the slider', () => {
    setPlastikYears([1972, 2008, 2015]);
    setMeerFocus('plastik');
    expect(meerRange()).toEqual({ lo: yearStartDay(1972), hi: yearStartDay(2015) });
    // the focus starts at the time the layer held (1950 -> clamped to the first year)
    expect(plastikYear()).toBe(1972);
    setMeerTime(yearStartDay(2010));
    expect(plastikYear()).toBe(2008);
    setPlastikYears([]);
  });
  it('maps a calendar year to the latest year with data', () => {
    expect(yearAt([], 2000)).toBeNull();
    expect(yearAt([1950, 1951, 1960], 1949)).toBeNull();
    expect(yearAt([1950, 1951, 1960], 1955)).toBe(1951);
    expect(yearAt([1950, 1951, 1960], 2022)).toBe(1960);
  });
  it('counts the tows per year', () => {
    setPlastikYears([2008, 1972, 2008, 2015]);
    expect(plastikCount(2008)).toBe(2);
    expect(plastikCount(1972)).toBe(1);
    expect(plastikCount(1999)).toBe(0);
    expect(plastikCount(null)).toBe(0);
    setPlastikYears([]);
  });
});

describe('tow expressions', () => {
  it('show everything up to the year, the year itself strong, earlier ones faint', () => {
    expect(towsFilter(2008)).toEqual(['<=', ['get', 'y'], 2008]);
    expect(towsFilter(null)).toEqual(['boolean', false]);
    expect(towsOpacity(2008, 0.5)).toEqual(['case', ['==', ['get', 'y'], 2008], TOW_NOW * 0.5, TOW_OLD * 0.5]);
    expect(TOW_NOW).toBeGreaterThan(TOW_OLD * 5);
    const r = towsRadius(2008) as unknown[][];
    expect(r[3]).toBe(0);
    expect(r[5]).toBe(9);
  });
});

describe('patch polygon', () => {
  it('is the big closed ring of the boundary line', () => {
    const f = patchPolygon(JSON.parse(contoursJson));
    expect(f?.geometry.type).toBe('Polygon');
    expect(f!.geometry.coordinates[0].length).toBeGreaterThan(50);
  });
  it('is null without a boundary', () => {
    expect(patchPolygon({ type: 'FeatureCollection', features: [] })).toBeNull();
  });
});

const hist: History = {
  credit: 'x',
  note: 'n',
  series: [
    { id: 'l18-mass-in', label: 'A', unit: 'g/km²', method: 'm18', points: [{ year: 1972, value: 472 }, { year: 1985, value: 429 }, { year: 2000, value: 0 }] },
    { id: 'l24-manta-mass-in', label: 'B <b>', unit: 'g/km²', method: 'm24', points: [{ year: 2015, value: 13200 }, { year: 2020, value: 20000 }] },
    { id: 'l18-num-in', label: 'C', unit: 'Teile/km²', method: 'm18', points: [{ year: 1972, value: 6190 }] },
  ],
};

describe('mass chart', () => {
  it('takes only mass-in series and drops values that cannot be drawn on a log axis', () => {
    const s = massInSeries(hist);
    expect(s.map((x) => x.id)).toEqual(['l18-mass-in', 'l24-manta-mass-in']);
    expect(s[0].points).toHaveLength(2);
  });
  it('uses whole decades for the log axis', () => {
    expect(logRange([472, 20000])).toEqual([2, 5]);
    expect(logRange([100])).toEqual([2, 3]);
  });
  it('draws one path per line series, never joined, and escapes labels', () => {
    const svg = chartSvg(massInSeries(hist));
    expect(svg.match(/<path /g)).toHaveLength(2);
    expect(svg).toContain('1.000');
    expect(svg).not.toContain('<b>');
    expect(chartSvg([])).toBe('');
  });
});

describe('map line legend', () => {
  it('lists the four line entries and shows without history', () => {
    const html = panelHtml(undefined);
    expect(html).toContain('Linien auf der Karte');
    for (const t of ['1 kg/km² – Randzone', '10 kg/km² – Patch-Grenze', '100 kg/km² – Kern', 'Modell-Umriss des gewählten Jahres']) expect(html).toContain(t);
    expect(html).toContain('stroke-dasharray');
    expect(lineLegend()).toContain('159,9° W');
  });
});
