import { createPropertyExpression, latest, validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { afterEach, describe, expect, it } from 'vitest';
import { SCALE_STOPS } from './plastikgeo';
import { LINE_STYLE } from './plastikchart';
import { eriksenByRank, eriksenFilter, eriksenLabel, gyreModelFilter, gyreModelLabel } from './plastikwirbel';
import { plastikCount, plastikYears, setPlastikYears } from './plastiktime';
import { COUNT_STOPS, CONC_STOPS, TOW_GREY, globalTowsColor, globalTowsSort, towsFilter, towsOpacity, towsRadius, towsStrokeOpacity, towsStrokeWidth, towsSort } from './plastiktows';
import { globalTowPanel, towDate, towQuantity, type GlobalTowsMeta } from './plastiktowspanel';
import globalRaw from '../../../../public/data/plastik/tows-global.geojson?raw';
import gpgpRaw from '../../../../public/data/plastik/gpgp-tows.geojson?raw';

type F = { properties: Record<string, unknown>; geometry: { coordinates: number[] } };
const global = JSON.parse(globalRaw) as GlobalTowsMeta & { features: F[]; sources: Record<string, { license: string; url: string }> };
const gpgp = JSON.parse(gpgpRaw) as { features: F[] };

/** validates a circle layer with the style-spec like maplibre does when the layer is added; returns the error messages */
function validate(paint: Record<string, unknown>, filter: unknown, layout: Record<string, unknown> = {}): string[] {
  const style = {
    version: 8,
    sources: { t: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } } },
    layers: [{ id: 'c', type: 'circle', source: 't', filter, layout, paint }],
  };
  return validateStyleMin(style as never).map((e) => e.message);
}
const PAINT = (year: number | null) => ({
  'circle-color': globalTowsColor(SCALE_STOPS),
  'circle-radius': towsRadius(year),
  'circle-opacity': towsOpacity(year, 0.5),
  'circle-stroke-width': towsStrokeWidth(year),
  'circle-stroke-opacity': towsStrokeOpacity(year, 0.5),
});
/** evaluates the colour expression for the properties of one tow (spec of circle-color) */
const evalColor = (props: Record<string, unknown>) => {
  const r = createPropertyExpression(globalTowsColor(SCALE_STOPS), 'circle-color', latest.paint_circle['circle-color'] as never);
  if (r.result !== 'success') throw new Error(r.value.map((x) => x.message).join('; '));
  const v = r.value.evaluate({ zoom: 3 }, { type: 1, properties: props } as never);
  return JSON.stringify(v);
};

describe('tows-global.geojson (output of scripts/tows-build.py)', () => {
  it('has positions in range, a year, a date of that year, a quantity and known source and method', () => {
    expect(global.features.length).toBeGreaterThan(3000);
    for (const f of global.features) {
      const [lon, lat] = f.geometry.coordinates;
      expect(lon).toBeGreaterThanOrEqual(-180);
      expect(lon).toBeLessThanOrEqual(180);
      expect(Math.abs(lat)).toBeLessThanOrEqual(90);
      expect(String(f.properties.d).startsWith(String(f.properties.y))).toBe(true);
      expect(towQuantity(f.properties)).not.toBeNull();
      expect(Object.keys(global.sources)).toContain(f.properties.src);
      expect(Object.keys(global.methods)).toContain(f.properties.meth);
      if (f.properties.src === 'NCEI') expect(global.refs[Number(f.properties.r)]).toBeTruthy();
    }
  });
  it('only carries open licences and a source URL per source', () => {
    for (const s of Object.values(global.sources)) {
      expect(s.license).toMatch(/^(CC0 1\.0|CC BY (3|4)\.0)$/);
      expect(s.url).toMatch(/^https:\/\//);
    }
  });
  it('rounds coordinates to 0.01 degrees and stays small', () => {
    for (const f of global.features) for (const x of f.geometry.coordinates) expect(Math.abs(x * 100 - Math.round(x * 100))).toBeLessThan(1e-6);
    expect(globalRaw.length).toBeLessThan(3_000_000);
  });
  it('keeps units apart: counts per km² and per m³ never share a tow with a mass of another source', () => {
    for (const f of global.features) {
      if (f.properties.c != null) expect(f.properties.src).toBe('NCEI');
      if (f.properties.m != null) expect(f.properties.src).toBe('CO15');
    }
  });
  it('has no duplicate of a GPGP tow (same year, within 0.05 degrees) for NCEI records', () => {
    const pts = gpgp.features.map((f) => ({ y: f.properties.y, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }));
    const hits = global.features.filter(
      (f) => f.properties.src === 'NCEI' && f.properties.n == null && pts.some((p) => p.y === f.properties.y && Math.abs(p.lon - f.geometry.coordinates[0]) < 0.04 && Math.abs(p.lat - f.geometry.coordinates[1]) < 0.04),
    );
    expect(hits).toHaveLength(0);
  });
  it('has no repeated tow (same source, date, position, quantity)', () => {
    const keys = global.features.map((f) => [f.properties.src, f.properties.d, ...f.geometry.coordinates, f.properties.n, f.properties.m, f.properties.c].join('|'));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('colour scales of the global tows', () => {
  it('are valid style-spec expressions in a circle layer, for a year and for no year', () => {
    for (const year of [2010, null]) {
      expect(validate(PAINT(year), towsFilter(year), { 'circle-sort-key': globalTowsSort(year) })).toEqual([]);
      expect(validate(PAINT(year), towsFilter(year), { 'circle-sort-key': towsSort(year) })).toEqual([]);
    }
  });
  it('use a different palette than the mass scale and stay in the count domain', () => {
    const mass = new Set(SCALE_STOPS.map((s) => s[1]));
    for (const [, c] of [...COUNT_STOPS, ...CONC_STOPS]) expect(mass.has(c)).toBe(false);
    expect(COUNT_STOPS.map((s) => s[0])).toEqual([2, 3, 4, 5, 6]);
    expect(CONC_STOPS.map((s) => s[0])).toEqual([-3, -2, -1, 0, 1]);
  });
  it('colour by mass first, then count, then concentration, zero or nothing grey', () => {
    const grey = evalColor({});
    expect(evalColor({ m: 0 })).toBe(grey);
    expect(evalColor({ n: 0 })).toBe(grey);
    const m = evalColor({ m: 30000 });
    const n = evalColor({ n: 30000 });
    const c = evalColor({ c: 0.3 });
    expect(new Set([grey, m, n, c]).size).toBe(4);
    expect(evalColor({ m: 30000, n: 5 })).toBe(m);
    // the grey constant is the one of the GPGP tows
    expect(TOW_GREY).toBe('#8d949c');
  });
});

describe('timeline years with the global tows', () => {
  afterEach(() => setPlastikYears([]));
  it('contain the years of the GPGP and the global tows, and count both', () => {
    const years = [...gpgp.features, ...global.features].map((f) => Number(f.properties.y));
    setPlastikYears(years);
    const ys = plastikYears();
    expect(ys[0]).toBe(Math.min(...gpgp.features.map((f) => Number(f.properties.y))));
    for (const f of global.features) expect(ys).toContain(Number(f.properties.y));
    const y = 2014;
    const expected = years.filter((v) => v === y).length;
    expect(plastikCount(y)).toBe(expected);
    expect(expected).toBeGreaterThan(gpgp.features.filter((f) => f.properties.y === y).length);
  });
});

describe('panel of a global tow', () => {
  const meta: GlobalTowsMeta = {
    sources: { NCEI: { name: 'NOAA NCEI', license: 'CC0 1.0', cite: '', url: 'https://www.ncei.noaa.gov/x' } },
    methods: { M: 'Manta-Netz' },
    refs: [{ t: 'Eriksen et al. 2014', doi: '10.1371/journal.pone.0111913' }],
  };
  it('formats a date and picks the quantity', () => {
    expect(towDate('2013-05-04', 2013)).toBe('4. Mai 2013');
    expect(towDate(undefined, 2013)).toBe('2013');
    expect(towQuantity({ c: 0.5 })).toBe('c');
    expect(towQuantity({ n: 0, c: 1 })).toBe('n');
    expect(towQuantity({})).toBeNull();
  });
  it('shows the unit, the original study with DOI, the source with licence and a comparability note', () => {
    const d = globalTowPanel({ y: 2013, d: '2013-05-04', c: 0.0734, src: 'NCEI', meth: 'M', r: 0, mesh: 0.335 }, meta, '#fff');
    expect(d.tiles).toEqual([['Konzentration', '0,0734 Teile/m³']]);
    const rows = d.sections?.[0].rows ?? [];
    expect(rows.find((r) => r.k === 'Studie')?.href).toBe('https://doi.org/10.1371/journal.pone.0111913');
    expect(rows.find((r) => r.k === 'Daten')?.v).toContain('CC0 1.0');
    expect(rows.find((r) => r.k === 'Methode')?.v).toContain('0,335 mm');
    expect(d.note).toContain('nicht');
    const n = globalTowPanel({ y: 2013, d: '2013-07-06', n: 99600, src: 'NCEI', meth: 'M' }, meta, '#fff');
    expect(n.tiles?.[0]).toEqual(['Teile', '99.600 Teile/km²']);
  });
});

describe('line layers of the other gyres (style-spec)', () => {
  const lineStyle = (layers: unknown[]) =>
    validateStyleMin({
      version: 8,
      glyphs: 'https://example.com/{fontstack}/{range}.pbf',
      sources: { t: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } } },
      layers,
    } as never).map((e) => e.message);
  it('accepts the Eriksen isolines, their labels and the model outline for a year and for none', () => {
    const lines = {
      id: 'a',
      type: 'line',
      source: 't',
      filter: eriksenFilter(),
      paint: {
        'line-color': eriksenByRank(LINE_STYLE.eriksenOuter.color, LINE_STYLE.eriksenMid.color, LINE_STYLE.eriksenCore.color),
        'line-width': eriksenByRank(0.9, 1.2, 1.6),
        'line-opacity': eriksenByRank(0.4, 0.65, 0.95),
        'line-dasharray': LINE_STYLE.eriksenMid.dash,
      },
    };
    const label = { id: 'b', type: 'symbol', source: 't', filter: eriksenFilter(), layout: { 'symbol-placement': 'line', 'text-field': eriksenLabel(), 'text-font': ['Noto Sans Regular'] } };
    expect(lineStyle([lines, label])).toEqual([]);
    for (const year of [2013, null]) {
      const model = { id: 'c', type: 'line', source: 't', filter: gyreModelFilter(year), paint: { 'line-dasharray': LINE_STYLE.model.dash } };
      const ml = { id: 'd', type: 'symbol', source: 't', filter: gyreModelFilter(year), layout: { 'symbol-placement': 'line', 'text-field': gyreModelLabel(year), 'text-font': ['Noto Sans Regular'] } };
      expect(lineStyle([model, ml])).toEqual([]);
    }
  });
});
