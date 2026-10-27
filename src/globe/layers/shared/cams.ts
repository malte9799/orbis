import type { Feature } from 'geojson';

// Constants and helpers shared by the camera layers (webcams, ALPR, Blitzer).

/** Zoom from which cameras are loaded for the visible area (Overpass). */
export const CAM_DETAIL_ZOOM = 9;
/** camera dots appear from this zoom on; below it the heatmap shows the distribution */
export const CAM_DOT_ZOOM = 6;
export const CAM_COLOR = '#00bfa5';
export const CAM_ZOOM_RED = '#e53935';
export const ALPR_RED = '#ef4444';
export const CARDINAL = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
export const ALPR_ZONE: Record<string, string> = { traffic: 'Verkehr', parking: 'Parkplatz', town: 'Ortschaft', building: 'Gebäude', public: 'Öffentlich', shop: 'Geschäft' };
export const ALPR_MOUNT: Record<string, string> = { pole: 'Mast', wall: 'Wand', street_lamp: 'Laterne', ceiling: 'Decke', bridge: 'Brücke', traffic_signals: 'Ampel', building: 'Gebäude' };

/** Stock photo per vendor (DeFlock CDN, first image of each LPR vendor), matched on the manufacturer tag. */
export const ALPR_VENDOR_IMG: [RegExp, string][] = [
  [/flock/i, 'flock/flock-1.jpg'],
  [/motorola|vigilant/i, 'motorola/motorola-1.jpg'],
  [/genetec/i, 'genetec/genetec-1.webp'],
  [/leonardo|elsag/i, 'leonardo/elsag-1.jpg'],
  [/neology/i, 'neology/neology-1.jpg'],
  [/axon/i, 'axon/axon-1.webp'],
  [/verkada/i, 'verkada/verkada_bullet_cropped.png'],
];
export const alprVendorImg = (brand: string) => {
  const hit = ALPR_VENDOR_IMG.find(([re]) => re.test(brand));
  return hit ? `https://cdn.deflock.me/vendors/${hit[1]}` : '';
};

/** Properties of an overview-tile camera in the shape of the live (Overpass) ones. */
export function alprTileProps(t: Record<string, unknown> | null, lon: number, lat: number): Record<string, unknown> {
  const brand = String(t?.brand ?? '');
  const flock = /flock/i.test(brand);
  const dir = Number(t?.direction);
  return {
    title: flock ? 'Flock-Kamera (ALPR)' : 'Kennzeichenerfassung (ALPR)',
    subtitle: [brand, t?.operator].filter(Boolean).join(' · '),
    flock,
    dir: t?.direction != null && t.direction !== '' && Number.isFinite(dir) ? dir : -1,
    mount: t?.mountType ?? '',
    operator: t?.operator ?? '',
    brand,
    zone: t?.surveillanceZone ?? '',
    since: t?.startDate ?? '',
    ref: t?.ref ?? '',
    url: t?.osmId ? `https://www.openstreetmap.org/${t.osmType ?? 'node'}/${t.osmId}` : undefined,
    deflock: `https://maps.deflock.org/?lat=${lat.toFixed(5)}&lng=${lon.toFixed(5)}&zoom=17`,
  };
}
export const ALPR_FOV_ZOOM = 12; // sectors are drawn from here on
export const ALPR_FOV_RADIUS = 80; // metres
export const ALPR_FOV_ANGLE = 60; // degrees
export const CAM_FOV_RADIUS = 80; // metres
export const CAM_FOV_ANGLE = 60; // degrees
/** road cameras of the feeds: the direction is mostly the road's direction of travel, view angle and
 * range are typical values (as in God's Eye View), not measurements */
export const ROAD_CAM_FOV_RADIUS = 210; // metres
export const ROAD_CAM_FOV_ANGLE = 56; // degrees

/** Sector polygons on the ground (metres → degrees), one per [lon, lat, heading]. */
export function fovSectors(cams: [number, number, number][], radius: number, angle: number): Feature[] {
  return cams.map(([lon, lat, dir]) => {
    const kx = 111320 * Math.cos((lat * Math.PI) / 180);
    const ring: [number, number][] = [[lon, lat]];
    for (let i = 0; i <= 12; i++) {
      const a = ((dir - angle / 2 + (angle * i) / 12) * Math.PI) / 180;
      ring.push([lon + (Math.sin(a) * radius) / kx, lat + (Math.cos(a) * radius) / 111320]);
    }
    ring.push([lon, lat]);
    return { type: 'Feature' as const, geometry: { type: 'Polygon' as const, coordinates: [ring] }, properties: {} };
  });
}
