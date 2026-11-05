// The other garbage patches (North/South Atlantic, Indian Ocean, South Pacific, Mediterranean) in the layer "Plastik im Meer":
// isolines of the Eriksen et al. 2014 model (CC BY 4.0, public/data/plastik/gyre-contours.geojson) and the outline of the own
// experimental model per year (gyre-model-outlines.geojson). The GPGP keeps its Lebreton contours and model outline; its Eriksen
// lines and gyre-model outline are NOT drawn (they would contradict Lebreton), only used as numbers in the panel.
// Pure functions: expressions, texts and panel rows, no map and no DOM.
import { areaMio } from './plastikmodell';

export type GyreId = 'gpgp' | 'suedpazifik' | 'nordatlantik' | 'suedatlantik' | 'indik' | 'mittelmeer';

/** gyres with Eriksen isolines on the map (the GPGP has Lebreton's) */
export const ERIKSEN_GYRES: readonly GyreId[] = ['suedpazifik', 'nordatlantik', 'suedatlantik', 'indik', 'mittelmeer'];
/** gyres with a drawn model outline besides the GPGP (the model finds nothing for the South Pacific and the Mediterranean) */
export const MODEL_GYRES: readonly GyreId[] = ['nordatlantik', 'suedatlantik', 'indik'];

/** why a gyre has no model outline at all */
export const NO_MODEL_REASON: Partial<Record<GyreId, string>> = {
  suedpazifik: 'Flussmündungen speisen den Südpazifik im Modell kaum, die Dichte erreicht die Schwelle nirgends',
  mittelmeer: 'das 0,5°-Feld des Modells löst das Mittelmeer nicht auf, die Dichte erreicht die Schwelle nirgends',
};

/** Eriksen isolines of all gyres but the GPGP (valid expression syntax) */
export const eriksenFilter = (): unknown[] => ['!=', ['get', 'gyre'], 'gpgp'];
/** model outline of exactly this year, for the gyres that have one */
export const gyreModelFilter = (year: number | null): unknown[] => ['all', ['==', ['get', 'y'], year ?? 0], ['in', ['get', 'g'], ['literal', [...MODEL_GYRES]]]];
/** label of the Eriksen isoline: "10.000 Teile/km² (Eriksen 2014)" */
export const eriksenLabel = (): unknown[] => [
  'concat',
  ['match', ['get', 'level'], 10000, '10.000', 30000, '30.000', 100000, '100.000', ['to-string', ['get', 'level']]],
  ' Teile/km² (Eriksen 2014)',
];
/** value by rank of the Eriksen line (outer, mid, core) */
export const eriksenByRank = <T>(outer: T, mid: T, core: T): unknown[] => ['match', ['get', 'rank'], 'outer', outer, 'core', core, mid];
export const gyreModelLabel = (year: number | null) => `Modell-Umriss ${year ?? ''} (experimentell)`;

export interface GyreFeatureLike {
  properties?: Record<string, unknown> | null;
  geometry?: unknown;
}
const isEmpty = (f: GyreFeatureLike) => {
  const c = (f.geometry as { coordinates?: unknown } | null | undefined)?.coordinates;
  return !Array.isArray(c) || c.length === 0;
};

/** area in km² of the model outline per gyre and year; empty features count with their (zero) area */
export function gyreAreas(features: readonly GyreFeatureLike[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const f of features) {
    const y = Number(f.properties?.y);
    const g = String(f.properties?.g);
    const a = Number(f.properties?.a);
    if (Number.isFinite(y) && Number.isFinite(a)) out.set(`${g}|${y}`, a);
  }
  return out;
}
export const gyreArea = (areas: ReadonlyMap<string, number>, g: string, year: number | null): number | null => (year == null ? null : (areas.get(`${g}|${year}`) ?? null));
/** the features that actually have a line (empty ones are not given to the map) */
export const drawnGyreFeatures = <T extends GyreFeatureLike>(features: readonly T[]): T[] => features.filter((f) => !isEmpty(f));
/** sum of the areas of the drawn gyres (GPGP included) in a year, km² */
export function totalModelArea(areas: ReadonlyMap<string, number>, gpgp: number | null, year: number | null): number | null {
  if (year == null) return null;
  let sum = gpgp ?? 0;
  for (const g of MODEL_GYRES) sum += gyreArea(areas, g, year) ?? 0;
  return sum;
}

interface Plaus {
  model_area_km2?: number;
  eriksen_area_km2?: number;
  iou?: number;
  centre_dist_km?: number;
}
export interface GyreContoursMeta {
  credit: string;
  licence: string;
  doi: string;
  mid_area_km2: Record<string, number>;
  gpgp_vs_lebreton?: Record<string, { level: number; area_in_raster_km2: number; iou: number; centre_dist_km: number }>;
}
export interface GyreModelMeta {
  credits: string[];
  hinweis?: string;
  plausibility_vs_eriksen?: { gyres: Record<string, { mid?: Record<string, Plaus> | null }> };
}

const NUM = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
const PCT = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });

export interface Row {
  k: string;
  v: string;
  href?: string;
}
export interface Section {
  key: string;
  title: string;
  open?: boolean;
  rows: Row[];
}

/** model area of the selected year as a text (or the reason there is none) */
export function modelAreaText(g: GyreId, a: number | null, year: number | null): string {
  if (g === 'gpgp') return areaMio(a) ?? 'noch keine Fläche über der Schwelle';
  if (!MODEL_GYRES.includes(g)) return `keine Fläche über der Schwelle – Modellgrenze: ${NO_MODEL_REASON[g] ?? 'kein Modell-Umriss'}`;
  if (year == null) return 'kein Modelljahr gewählt';
  return areaMio(a) ?? `keine Fläche über der Schwelle (${year})`;
}

/** plausibility row of the model against the Eriksen mid area (state ~2013) */
export function plausibilityText(g: GyreId, mm: GyreModelMeta | undefined): string | null {
  const p = mm?.plausibility_vs_eriksen?.gyres?.[g]?.mid?.['2013'];
  if (!p) return null;
  if (!p.model_area_km2) return 'Modell erreicht die Schwelle nirgends, keine Überdeckung mit der Eriksen-Fläche';
  return `Überdeckung (IoU) ${PCT.format((p.iou ?? 0) * 100)} %${p.centre_dist_km != null ? `, Mitte ${NUM.format(p.centre_dist_km)} km von der Eriksen-Mitte` : ''} (Modell 2013 gegen Eriksen ≥ 30.000 Teile/km²)`;
}

/** panel sections for a gyre other than the GPGP: Eriksen area, model outline of the year, plausibility, credits */
export function gyreSections(g: GyreId, year: number | null, areas: ReadonlyMap<string, number>, cm: GyreContoursMeta | undefined, mm: GyreModelMeta | undefined): Section[] {
  const eri = cm?.mid_area_km2?.[g];
  const rows: Row[] = [
    { k: 'Eriksen-Fläche', v: eri != null ? `${areaMio(eri) ?? 'unter 0,01 Mio. km²'} mit mindestens 30.000 Teilen/km² (Modellraster, Stand ~2013)` : 'nicht geladen' },
    { k: `Modell-Umriss ${year ?? ''}`.trim(), v: modelAreaText(g, gyreArea(areas, g, year), year) },
  ];
  const pl = plausibilityText(g, mm);
  if (pl) rows.push({ k: 'Plausibilität', v: pl });
  const credits: Row[] = [
    { k: 'Isolinien', v: `${cm?.credit ?? 'Eriksen et al. 2014 (CC BY 4.0)'}`, href: cm?.doi ? `https://doi.org/${cm.doi}` : 'https://doi.org/10.1371/journal.pone.0111913' },
    { k: 'Modell', v: mm?.credits?.length ? mm.credits.join('; ') : 'eigene experimentelle Modellrechnung' },
  ];
  return [
    { key: 'gyre', title: 'Modell und Eriksen-Fläche', open: true, rows },
    { key: 'gyrecredit', title: 'Quellen der Linien', open: true, rows: credits },
  ];
}

/** rows with the Eriksen comparison for the GPGP panel (numbers only, the Eriksen lines are not drawn there) */
export function gpgpEriksenRows(cm: GyreContoursMeta | undefined): Row[] {
  const c = cm?.gpgp_vs_lebreton?.count_100000;
  if (!c) return [];
  return [
    {
      k: 'Eriksen 2014 (nicht gezeichnet)',
      v: `Kern ≥ 100.000 Teile/km²: ${areaMio(c.area_in_raster_km2)}, Mitte ${NUM.format(c.centre_dist_km)} km von der Lebreton-Mitte, Überdeckung (IoU) ${PCT.format(c.iou * 100)} %: die Studien setzen den Patch an leicht verschiedene Orte`,
    },
  ];
}
