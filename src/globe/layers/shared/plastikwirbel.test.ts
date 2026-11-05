import { createPropertyExpression, featureFilter, latest } from '@maplibre/maplibre-gl-style-spec';
import { describe, expect, it } from 'vitest';
import { lineLegend, lineLegendEntries } from './plastikchart';
import { ERIKSEN_GYRES, MODEL_GYRES, drawnGyreFeatures, eriksenFilter, eriksenLabel, gpgpEriksenRows, gyreArea, gyreAreas, gyreModelFilter, gyreSections, totalModelArea, type GyreContoursMeta, type GyreModelMeta } from './plastikwirbel';
import contoursRaw from '../../../../public/data/plastik/gyre-contours.geojson?raw';
import contoursMetaRaw from '../../../../public/data/plastik/gyre-contours.json?raw';
import outlinesRaw from '../../../../public/data/plastik/gyre-model-outlines.geojson?raw';
import modelMetaRaw from '../../../../public/data/plastik/gyre-model-meta.json?raw';

type F = { properties: Record<string, unknown>; geometry: { coordinates: unknown[] } };
const contours = JSON.parse(contoursRaw) as { features: F[] };
const cm = JSON.parse(contoursMetaRaw) as GyreContoursMeta;
const outlines = JSON.parse(outlinesRaw) as { features: F[] };
const mm = JSON.parse(modelMetaRaw) as GyreModelMeta;
const areas = gyreAreas(outlines.features);

/** evaluates a filter on the properties of a feature like maplibre does */
const passes = (filter: unknown, props: Record<string, unknown>) => featureFilter(filter as never, 'layers[0].filter').filter({ zoom: 3 } as never, { type: 2, properties: props } as never);

describe('filters of the other gyres', () => {
  it('draw the Eriksen lines of every gyre but the GPGP', () => {
    const drawn = new Set(contours.features.filter((f) => passes(eriksenFilter(), f.properties)).map((f) => f.properties.gyre));
    expect(drawn).toEqual(new Set(ERIKSEN_GYRES));
  });
  it('pick the model outline of exactly one year and only the gyres with a model', () => {
    const hit = outlines.features.filter((f) => passes(gyreModelFilter(2020), f.properties));
    expect(hit.map((f) => f.properties.g).sort()).toEqual([...MODEL_GYRES].sort());
    expect(hit.every((f) => f.properties.y === 2020)).toBe(true);
    expect(outlines.features.filter((f) => passes(gyreModelFilter(null), f.properties))).toHaveLength(0);
  });
  it('label the levels with thousands separators', () => {
    const r = createPropertyExpression(eriksenLabel() as never, 'text-field', latest.layout_symbol['text-field'] as never);
    if (r.result !== 'success') throw new Error(r.value.map((x) => x.message).join('; '));
    expect(String((r.value.evaluate({ zoom: 3 } as never, { type: 2, properties: { level: 30000 } } as never) as { toString(): string }).toString())).toBe('30.000 Teile/km² (Eriksen 2014)');
  });
});

describe('gyre data', () => {
  it('has no empty feature in the drawn model outlines, and empty gyres keep their (zero) area', () => {
    const drawn = drawnGyreFeatures(outlines.features);
    expect(drawn.length).toBeGreaterThan(100);
    expect(drawn.every((f) => f.geometry.coordinates.length > 0)).toBe(true);
    expect(gyreArea(areas, 'suedpazifik', 2022)).toBe(0);
    expect(gyreArea(areas, 'mittelmeer', 2022)).toBe(0);
    expect(gyreArea(areas, 'nordatlantik', 2022)).toBeGreaterThan(6e6);
    expect(gyreArea(areas, 'nordatlantik', null)).toBeNull();
  });
  it('sums the drawn gyres', () => {
    const t = totalModelArea(areas, 2.3e6, 2022) ?? 0;
    expect(t).toBeGreaterThan(2.3e6 + 14e6);
  });
});

describe('gyre panel sections', () => {
  const rows = (g: Parameters<typeof gyreSections>[0], y: number) => gyreSections(g, y, areas, cm, mm).flatMap((s) => s.rows);
  it('show Eriksen area, model area of the year, plausibility and credits for a gyre with a model', () => {
    const r = rows('suedatlantik', 2022);
    expect(r.find((x) => x.k === 'Eriksen-Fläche')?.v).toContain('1,65 Mio. km²');
    expect(r.find((x) => x.k === 'Modell-Umriss 2022')?.v).toBe('4,61 Mio. km²');
    expect(r.find((x) => x.k === 'Plausibilität')?.v).toMatch(/18 %.*1\.668 km/);
    expect(r.find((x) => x.k === 'Isolinien')?.v).toContain('CC BY 4.0');
    expect(r.find((x) => x.k === 'Modell')?.v).toContain('Meijer');
  });
  it('explain the empty model of the South Pacific and the Mediterranean', () => {
    expect(rows('suedpazifik', 2022).find((x) => x.k === 'Modell-Umriss 2022')?.v).toMatch(/Modellgrenze.*Flussmündungen/);
    expect(rows('mittelmeer', 2022).find((x) => x.k === 'Modell-Umriss 2022')?.v).toMatch(/Modellgrenze.*Mittelmeer/);
    expect(rows('mittelmeer', 2022).find((x) => x.k === 'Plausibilität')?.v).toContain('nirgends');
  });
  it('say so when a modelled gyre has no area yet in an early year', () => {
    expect(rows('nordatlantik', 1950).find((x) => x.k === 'Modell-Umriss 1950')?.v).toContain('keine Fläche über der Schwelle');
  });
  it('compare the GPGP with Eriksen as numbers', () => {
    const r = gpgpEriksenRows(cm);
    expect(r[0].v).toMatch(/416 km/);
    expect(gpgpEriksenRows(undefined)).toEqual([]);
  });
});

describe('line legend per gyre', () => {
  it('keeps the four GPGP entries', () => {
    expect(lineLegendEntries()).toHaveLength(4);
    expect(lineLegendEntries('gpgp')).toHaveLength(4);
    expect(lineLegend('gpgp')).toContain('Patch-Grenze');
  });
  it('shows three Eriksen levels plus the model outline, or only the levels without a model', () => {
    expect(lineLegendEntries('indik')).toHaveLength(4);
    expect(lineLegend('indik')).toContain('Modell-Umriss');
    expect(lineLegend('indik')).not.toContain('Patch-Grenze');
    expect(lineLegendEntries('mittelmeer', false)).toHaveLength(3);
    expect(lineLegend('mittelmeer', false)).not.toContain('Modell-Umriss');
  });
});
