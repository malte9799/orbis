// Projektionen für die Sterne-Ansicht. Szenen-Richtung: +Y = Nordpol, x = RA 0°, −z = RA 90°
// (siehe healpix.ts). Flache Projektionen legen Osten (steigende RA) nach links, wie am Himmel.

export type Vec3 = [number, number, number];

export interface Projection {
  flat: boolean;
  // Halbe Ausdehnung der flachen Karte (Weltkoordinaten, 1 Einheit ≈ 1 rad in der Kartenmitte)
  halfW: number;
  halfH: number;
  project(d: Vec3): Vec3; // Richtung -> Position (Kugel: identisch, flach: Kartenebene z = 0)
  unproject(x: number, y: number): Vec3 | null; // Kartenpunkt -> Richtung, null außerhalb
  seam: number; // Dreiecke, deren x-Spanne größer ist, liegen über dem Kartenrand (flach)
}

const dirFromLonLat = (lon: number, lat: number): Vec3 => [Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon)];
const lonLatFromDir = (d: Vec3) => ({ lon: Math.atan2(-d[2], d[0]), lat: Math.asin(Math.max(-1, Math.min(1, d[1]))) });

export const sphereProjection: Projection = {
  flat: false,
  halfW: 1,
  halfH: 1,
  project: (d) => d,
  unproject: () => null,
  seam: Infinity,
};

// Rechteckige Plattkarte (equirectangular): einfachste, am weitesten verbreitete Himmelskarte
export const equirectProjection: Projection = {
  flat: true,
  halfW: Math.PI,
  halfH: Math.PI / 2,
  project(d) {
    const { lon, lat } = lonLatFromDir(d);
    return [-lon, lat, 0];
  },
  unproject(x, y) {
    if (Math.abs(x) > Math.PI || Math.abs(y) > Math.PI / 2) return null;
    return dirFromLonLat(-x, y);
  },
  seam: Math.PI,
};

// Hammer-Aitoff: flächentreue Ganzhimmelskarte (Ellipse 2:1), Standard für Allsky-Karten
const S2 = Math.SQRT2;
export const hammerProjection: Projection = {
  flat: true,
  halfW: 2 * S2,
  halfH: S2,
  project(d) {
    const { lon, lat } = lonLatFromDir(d);
    const l = -lon;
    const den = Math.sqrt(1 + Math.cos(lat) * Math.cos(l / 2));
    return [(2 * S2 * Math.cos(lat) * Math.sin(l / 2)) / den, (S2 * Math.sin(lat)) / den, 0];
  },
  unproject(x, y) {
    if ((x * x) / 8 + (y * y) / 2 > 1) return null;
    const z = Math.sqrt(Math.max(0, 1 - (x / 4) ** 2 - (y / 2) ** 2));
    const l = 2 * Math.atan2(z * x, 2 * (2 * z * z - 1));
    return dirFromLonLat(-l, Math.asin(Math.max(-1, Math.min(1, z * y))));
  },
  seam: 2 * S2,
};
