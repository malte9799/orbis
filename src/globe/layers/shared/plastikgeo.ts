import type { Feature, FeatureCollection, Polygon } from 'geojson';

type LngLat = [number, number];
type Corners = [LngLat, LngLat, LngLat, LngLat];
// Corners of the two pictures (top-left, top-right, bottom-right, bottom-left; lon/lat of the Web-Mercator images).
// Static copies of the "coordinates" of global-density.json and gpgp-density.json: that way the image source exists
// before any file is loaded (the test plastik.test.ts keeps them in line with the JSON). The GPGP lies at 200..240
// degrees east on purpose – MapLibre draws corners beyond 180 as they are, they are not converted.
export const CORNERS_GLOBAL: Corners = [[-180, 85], [180, 85], [180, -85], [-180, -85]];
export const CORNERS_GPGP: Corners = [[200.0, 45.2], [240.2, 45.2], [240.2, 20.0], [200.0, 20.0]];

/** colour scale of the GPGP picture (log10 g/km²), also used for the net tows; copy of "stops" in gpgp-density.json (kept in line by the test) */
export const SCALE_STOPS: [number, string][] = [
  [3.0, '#2a0b4f'],
  [3.367, '#6a176e'],
  [3.733, '#a52c60'],
  [4.1, '#dd513a'],
  [4.467, '#f98e09'],
  [4.833, '#f9d742'],
  [5.2, '#fcffa4'],
];

/** closed outline of the patch (boundary line, 10 kg/km²) as a polygon for clicks inside the area */
export function patchPolygon(contours: FeatureCollection): Feature<Polygon> | null {
  const b = contours.features.find((f) => f.properties?.boundary);
  if (!b || b.geometry.type !== 'MultiLineString') return null;
  let ring: number[][] | null = null;
  for (const line of b.geometry.coordinates) {
    const first = line[0];
    const last = line[line.length - 1];
    const closed = first[0] === last[0] && first[1] === last[1];
    // the big ring is the patch; the small closed rings are islands of high density elsewhere
    if (closed && line.length > 50 && (!ring || line.length > ring.length)) ring = line;
  }
  return ring ? { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: { kind: 'area', id: 'gpgp' } } : null;
}
