// Pure helpers of the layer "Herkunft des GPGP-Plastiks" (defs/plastikherkunft.ts): origin countries of the debris
// (Lebreton et al. 2022) as arcs to the middle of the Great Pacific Garbage Patch.

export interface OriginCountry {
  code: string;
  name: string;
  n: number;
  share: number;
}

/**
 * Anchor point per country [lon, lat]: a coastal point next to the main fishing ports on the Pacific side, not the
 * middle of the country (US: California coast, CA: Vancouver). Countries without an anchor have no arc.
 */
export const ANCHORS: Record<string, { lon: number; lat: number; place: string }> = {
  JP: { lon: 141, lat: 35.7, place: 'Pazifikküste Honshū (Chōshi)' },
  CN: { lon: 122, lat: 31.2, place: 'Ostchinesisches Meer (Shanghai)' },
  KR: { lon: 129.1, lat: 35.1, place: 'Busan' },
  US: { lon: -122.5, lat: 37.8, place: 'Westküste (San Francisco)' },
  TW: { lon: 120.3, lat: 22.6, place: 'Kaohsiung' },
  CA: { lon: -123.1, lat: 49.3, place: 'British Columbia (Vancouver)' },
};

export interface OriginSummary {
  /** countries with an anchor, i.e. with an arc, biggest share first */
  anchored: OriginCountry[];
  /** all the others together: no arc, only in the panel */
  other: { n: number; share: number; count: number };
}

/** Splits the countries into those with an anchor and one summed entry "andere". */
export function summarize(countries: OriginCountry[], withOrigin: number, anchors: Record<string, unknown> = ANCHORS): OriginSummary {
  const sorted = [...countries].sort((a, b) => b.share - a.share);
  const anchored = sorted.filter((c) => c.code in anchors);
  const rest = sorted.filter((c) => !(c.code in anchors));
  const n = rest.reduce((a, c) => a + c.n, 0);
  return { anchored, other: { n, share: withOrigin > 0 ? n / withOrigin : 0, count: rest.length } };
}

export const WIDTH_MIN = 1.5;
export const WIDTH_MAX = 8;

/** Line width (CSS px) proportional to the share, the biggest share gets WIDTH_MAX. */
export function arcWidth(share: number, maxShare: number): number {
  if (!(maxShare > 0) || !(share > 0)) return WIDTH_MIN;
  return WIDTH_MIN + (WIDTH_MAX - WIDTH_MIN) * Math.min(1, share / maxShare);
}

/** `lon` moved by whole turns to the side of `ref` (within 180°): -141 relative to 140 is 219. */
export function unwrapLon(lon: number, ref: number): number {
  return lon + 360 * Math.round((ref - lon) / 360);
}

/** Largest jump of the longitude between neighbouring points of a bow (degrees); a bow across the date line must not have one. */
export function maxLonJump(points: ArrayLike<number>[]): number {
  let m = 0;
  for (let i = 1; i < points.length; i++) m = Math.max(m, Math.abs(points[i][0] - points[i - 1][0]));
  return m;
}
