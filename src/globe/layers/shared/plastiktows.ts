// Paint/filter expressions of the net-tow layer of "Plastik im Meer": the shown year is strong and outlined, the years
// before it are only a faint context.
export const TOW_NOW = 0.95;
export const TOW_OLD = 0.12;

const isNow = (year: number | null) => ['==', ['get', 'y'], year ?? 0];

/** tows up to the shown year; without a year nothing matches (expression syntax: `['==', 1, 0]` would be parsed as a legacy filter and rejected) */
export const towsFilter = (year: number | null) => (year == null ? ['boolean', false] : ['<=', ['get', 'y'], year]);
export const towsOpacity = (year: number | null, f: number) => ['case', isNow(year), TOW_NOW * f, TOW_OLD * f];
export const towsStrokeOpacity = (year: number | null, f: number) => ['case', isNow(year), f, 0];
export const towsStrokeWidth = (year: number | null) => ['case', isNow(year), 1, 0];
export const towsRadius = (year: number | null) => [
  'interpolate',
  ['linear'],
  ['zoom'],
  0,
  ['case', isNow(year), 3, 1.5],
  9,
  ['case', isNow(year), 8, 3],
];
/** the shown year is drawn on top; within it the heavier tows last */
export const towsSort = (year: number | null, value: unknown = ['coalesce', ['get', 'm'], 0]) => ['case', isNow(year), ['+', 1e9, value], value];

// Global tows (tows-global.geojson) carry one of three quantities, each with its own colour scale: mass g/km² (the scale of the GPGP
// picture, see SCALE_STOPS), count pieces/km² (n) and concentration pieces/m³ of net water (c). Counts and masses are not
// comparable, so the count scales use a different palette (blue to green to yellow) than the mass scale (purple to orange to yellow).
export const COUNT_STOPS: [number, string][] = [
  [2, '#12285a'],
  [3, '#1f6a9a'],
  [4, '#2aa6a0'],
  [5, '#9fdc6a'],
  [6, '#f4f08a'],
];
export const CONC_STOPS: [number, string][] = [
  [-3, '#12285a'],
  [-2, '#1f6a9a'],
  [-1, '#2aa6a0'],
  [0, '#9fdc6a'],
  [1, '#f4f08a'],
];
export const TOW_GREY = '#8d949c';

/** colour of a global tow: mass if it has one, else count per km², else concentration per m³; no value above 0: grey */
export const globalTowsColor = (massStops: [number, string][]) => [
  'case',
  ['>', ['coalesce', ['get', 'm'], 0], 0],
  ['interpolate', ['linear'], ['log10', ['get', 'm']], ...massStops.flat()],
  ['>', ['coalesce', ['get', 'n'], 0], 0],
  ['interpolate', ['linear'], ['log10', ['get', 'n']], ...COUNT_STOPS.flat()],
  ['>', ['coalesce', ['get', 'c'], 0], 0],
  ['interpolate', ['linear'], ['log10', ['get', 'c']], ...CONC_STOPS.flat()],
  TOW_GREY,
];
export const globalTowsSort = (year: number | null) => towsSort(year, ['coalesce', ['get', 'm'], ['get', 'n'], ['get', 'c'], 0]);
