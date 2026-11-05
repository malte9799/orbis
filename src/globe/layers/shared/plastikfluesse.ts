import type { ExpressionSpecification } from 'maplibre-gl';

// Pure helpers of the layer "Plastik aus Flüssen" (Meijer et al. 2021): size, colour and wording of the river mouths.

/** number of river mouths in the model (Meijer et al. 2021); the file only keeps those with >= 3 t/year */
export const MOUTHS_TOTAL = 31819;

const NUM = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
const NUM1 = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 });

/** "62.600 t/Jahr"; below 10 t one decimal */
export function fmtTons(t: number): string {
  return `${t < 10 ? NUM1.format(t) : NUM.format(Math.round(t))} t/Jahr`;
}

export const fmtRank = (r: number) => `Platz ${NUM.format(r)} von ${NUM.format(MOUTHS_TOTAL)} Mündungen im Modell`;

/** a mouth of rank `r` is drawn from this zoom on (ranks are sorted by t/year, 1 = largest) */
export const RANK_TIERS: [zoom: number, maxRank: number][] = [
  [1, 300],
  [3, 2000],
  [4.5, Infinity],
];

/** circle colour by log10(t): yellow (3 t) -> orange -> red -> dark red (60.000 t) */
export const colorExpr: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['log10', ['get', 't']],
  0.5, '#ffe082',
  1.5, '#ffb74d',
  2.5, '#ef6c00',
  3.5, '#d32f2f',
  4.8, '#7f0000',
];

/** radius in px by log10(t), clamped to 0.5..4.8: small at zoom 1, larger at zoom 7 (same numbers as `radiusExpr`) */
export function radiusAt(t: number, zoom: number): number {
  const f = (Math.min(4.8, Math.max(0.5, Math.log10(t))) - 0.5) / 4.3;
  const lo = 1.5 + f * 3.5;
  const hi = 3 + f * 10;
  const z = Math.min(1, Math.max(0, (zoom - 1) / 6));
  return lo + (hi - lo) * z;
}

/** the largest rank drawn at a zoom (zoom-dependent value of the last tier starting at or below it) */
export function maxRankAt(zoom: number): number {
  return [...RANK_TIERS].reverse().find(([z]) => z <= zoom)?.[1] ?? RANK_TIERS[0][1];
}

/**
 * circle-radius: grows with t and zoom. A mouth that is not "due" yet at its rank has radius 0: a zoom expression is
 * not allowed in a filter, so the rank tiers live in the zoom stops of the radius (like the ports layer).
 * Between two stops the radius of a newly due mouth grows from 0, i.e. it fades in over the zoom steps.
 */
export function radiusExpr(): ExpressionSpecification {
  const size = (a: number, b: number): ExpressionSpecification => ['interpolate', ['linear'], ['log10', ['get', 't']], 0.5, a, 4.8, b];
  const due = (zoom: number, a: number, b: number): ExpressionSpecification => {
    const max = maxRankAt(zoom);
    return Number.isFinite(max) ? ['case', ['<=', ['get', 'r'], max], size(a, b), 0] : size(a, b);
  };
  return ['interpolate', ['linear'], ['zoom'], 1, due(1, 1.5, 5), 3, due(3, 1.5, 5), 4.5, due(4.5, 1.5, 5), 7, due(7, 3, 13)];
}

/** stroke width follows the radius: no rim for mouths that are not due */
export function strokeExpr(): ExpressionSpecification {
  const w = (zoom: number): ExpressionSpecification => {
    const max = maxRankAt(zoom);
    return Number.isFinite(max) ? ['case', ['<=', ['get', 'r'], max], 0.6, 0] : 0.6 as never;
  };
  return ['interpolate', ['linear'], ['zoom'], 1, w(1), 3, w(3), 4.5, w(4.5)] as ExpressionSpecification;
}
