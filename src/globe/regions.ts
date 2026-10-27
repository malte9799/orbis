import type { FeatureCollection, Point } from 'geojson';

/** Continents and large natural regions for the zoomed-out map (names that vector tiles do not carry). */
type Kind = 'continent' | 'desert' | 'mountain' | 'region';

// [name, lon, lat, kind, importance 1 (most) … 3]
const RAW: [string, number, number, Kind, number][] = [
  // continents
  ['Europa', 14, 52, 'continent', 0],
  ['Asien', 90, 47, 'continent', 0],
  ['Afrika', 20, 4, 'continent', 0],
  ['Nordamerika', -100, 47, 'continent', 0],
  ['Südamerika', -60, -13, 'continent', 0],
  ['Australien', 134, -25, 'continent', 0],
  ['Antarktis', 0, -80, 'continent', 0],
  // deserts
  ['Sahara', 12, 24, 'desert', 1],
  ['Arabische Wüste', 46, 22, 'desert', 2],
  ['Gobi', 104, 43, 'desert', 2],
  ['Taklamakan', 83, 39.5, 'desert', 3],
  ['Karakum', 59, 40, 'desert', 3],
  ['Kalahari', 22, -23, 'desert', 2],
  ['Atacama', -69, -23.5, 'desert', 3],
  ['Große Victoriawüste', 126, -29, 'desert', 3],
  // mountains
  ['Anden', -70, -18, 'mountain', 1],
  ['Anden', -72, -34, 'mountain', 2],
  ['Himalaya', 85, 28.5, 'mountain', 1],
  ['Karakorum', 76, 36, 'mountain', 3],
  ['Hindukusch', 70, 35.5, 'mountain', 3],
  ['Rocky Mountains', -112, 46, 'mountain', 1],
  ['Appalachen', -80, 38, 'mountain', 3],
  ['Alpen', 10, 46.6, 'mountain', 2],
  ['Ural', 60, 58, 'mountain', 2],
  ['Kaukasus', 44, 42.6, 'mountain', 3],
  ['Atlas', -3, 32, 'mountain', 3],
  ['Tian Shan', 80, 42, 'mountain', 3],
  ['Äthiopisches Hochland', 38.5, 9, 'mountain', 3],
  // regions
  ['Sibirien', 100, 63, 'region', 1],
  ['Skandinavien', 15, 63, 'region', 2],
  ['Amazonien', -62, -5, 'region', 1],
  ['Patagonien', -69, -46, 'region', 2],
  ['Sahel', 0, 14.5, 'region', 3],
  ['Kongobecken', 23, -1, 'region', 3],
  ['Arabische Halbinsel', 45, 26, 'region', 3],
  ['Tibetisches Hochland', 90, 33.5, 'region', 3],
  ['Dekkan-Plateau', 77, 17, 'region', 3],
  ['Indochina', 104, 16, 'region', 3],
  ['Anatolien', 33, 39, 'region', 3],
  ['Iranisches Hochland', 55, 33, 'region', 3],
  ['Great Plains', -100, 41, 'region', 3],
  ['Mittelamerika', -86, 13, 'region', 3],
  ['Karibik', -75, 17.5, 'region', 3],
];

export const regionsGeoJSON = (): FeatureCollection<Point> => ({
  type: 'FeatureCollection',
  features: RAW.map(([name, lon, lat, kind, rank]) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: { name, kind, rank },
  })),
});
