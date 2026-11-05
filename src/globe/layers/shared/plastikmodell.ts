// Expressions and texts of the modelled outline of the Great Pacific Garbage Patch ("Modell-Umriss") in the layer "Plastik im Meer".
// EXPERIMENTAL MODEL, not a measurement: scripts/gpgp-model.py (public/data/plastik/gpgp-model-outlines.geojson), calibrated to the
// 10 kg/km² boundary of Lebreton et al. 2018 (2015). Pure functions, no map and no DOM.

export const MODEL_COLOR = '#80deea';
export const MODEL_NOTE = 'Umriss = experimentelles Modell, kalibriert auf Lebreton 2018';

/** the outline of exactly this year (one feature per year) */
export const modelFilter = (year: number | null) => ['==', ['get', 'y'], year ?? 0];

/** label along the line */
export const modelLabel = (year: number | null) => `Modell-Umriss ${year ?? ''} (kalibriert auf 2015)`;

const MIO = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "1,60 Mio. km²"; below 10,000 km² (nothing worth an outline) and without data: null */
export function areaMio(km2: number | null): string | null {
  if (km2 == null || km2 < 10000) return null;
  return `${MIO.format(km2 / 1e6)} Mio. km²`;
}
