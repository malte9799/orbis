import type { Feature, FeatureCollection, LineString, Point, Polygon } from 'geojson';
import { overpass } from './overpass';

// Airport ground layout from OpenStreetMap (aeroway=*): runways, taxiways, aprons, terminals,
// hangars, buildings on airport grounds, gates, parking positions and navigation aids.

export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export type AirportKind = 'runway' | 'taxiway' | 'taxilane' | 'apron' | 'terminal' | 'hangar' | 'building' | 'helipad' | 'gate' | 'parking' | 'light';

export interface AirportLayout {
  polygons: Feature<Polygon>[];
  lines: Feature<LineString>[];
  points: Feature<Point>[];
}

interface OsmGeom {
  lat: number;
  lon: number;
}
interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  geometry?: OsmGeom[];
  tags?: Record<string, string>;
}

/** Default widths in metres where OSM carries no `width` tag. */
const DEFAULT_WIDTH: Partial<Record<AirportKind, number>> = { runway: 45, taxiway: 23, taxilane: 15 };
/** Default heights in metres where OSM carries neither `height` nor `building:levels`. */
const DEFAULT_HEIGHT: Partial<Record<AirportKind, number>> = { terminal: 18, hangar: 14, building: 9 };

const num = (v: string | undefined) => {
  if (!v) return NaN;
  const n = parseFloat(v.replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};

function height(tags: Record<string, string>, kind: AirportKind): { h: number; minh: number } {
  let h = num(tags.height);
  if (!Number.isFinite(h)) {
    const levels = num(tags['building:levels']);
    h = Number.isFinite(levels) ? levels * 3.5 : (DEFAULT_HEIGHT[kind] ?? 9);
  }
  let minh = num(tags.min_height);
  if (!Number.isFinite(minh)) {
    const minLevels = num(tags['building:min_level']);
    minh = Number.isFinite(minLevels) ? minLevels * 3.5 : 0;
  }
  return { h: Math.max(h, minh + 1), minh };
}

function kindOf(tags: Record<string, string>): AirportKind | null {
  switch (tags.aeroway) {
    case 'runway':
    case 'taxiway':
    case 'taxilane':
    case 'apron':
    case 'terminal':
    case 'hangar':
    case 'helipad':
      return tags.aeroway;
    case 'gate':
      return 'gate';
    case 'parking_position':
      return 'parking';
    case 'navigationaid':
      return 'light';
  }
  return tags.building ? 'building' : null;
}

const isClosed = (g: OsmGeom[]) => g.length >= 4 && g[0].lat === g[g.length - 1].lat && g[0].lon === g[g.length - 1].lon;
const ring = (g: OsmGeom[]) => g.map((p) => [p.lon, p.lat]);

function centroid(g: OsmGeom[]): [number, number] {
  let lat = 0;
  let lon = 0;
  for (const p of g) {
    lat += p.lat;
    lon += p.lon;
  }
  return [lon / g.length, lat / g.length];
}

/** Turn Overpass elements into drawable features. Relations (multipolygons) are skipped. */
export function parseAirport(elements: OsmElement[]): AirportLayout {
  const out: AirportLayout = { polygons: [], lines: [], points: [] };
  for (const el of elements) {
    const tags = el.tags;
    if (!tags) continue;
    const kind = kindOf(tags);
    if (!kind) continue;
    const ref = tags.ref ?? '';
    const name = tags.name ?? '';
    const id = `${el.type[0]}${el.id}`;
    if (el.type === 'node') {
      if (el.lat == null || el.lon == null) continue;
      if (kind === 'gate' || kind === 'parking' || kind === 'light' || kind === 'helipad')
        out.points.push({ type: 'Feature', id, geometry: { type: 'Point', coordinates: [el.lon, el.lat] }, properties: { id, kind, ref, name, light: tags.navigationaid ?? '' } });
      continue;
    }
    const g = el.geometry;
    if (el.type !== 'way' || !g || g.length < 2) continue;
    const closed = isClosed(g);
    const area = closed && (tags.area === 'yes' || kind === 'apron' || kind === 'terminal' || kind === 'hangar' || kind === 'building' || kind === 'helipad');
    if (area) {
      const { h, minh } = height(tags, kind);
      out.polygons.push({ type: 'Feature', id, geometry: { type: 'Polygon', coordinates: [ring(g)] }, properties: { id, kind, ref, name, h, minh } });
    } else if (kind === 'runway' || kind === 'taxiway' || kind === 'taxilane') {
      const w = num(tags.width);
      out.lines.push({
        type: 'Feature',
        id,
        geometry: { type: 'LineString', coordinates: ring(g) },
        properties: { id, kind, ref, name, w: Number.isFinite(w) ? w : (DEFAULT_WIDTH[kind] ?? 20), surface: tags.surface ?? '' },
      });
    } else if (kind === 'gate' || kind === 'parking' || kind === 'helipad') {
      out.points.push({ type: 'Feature', id, geometry: { type: 'Point', coordinates: centroid(g) }, properties: { id, kind, ref, name, light: '' } });
    }
  }
  return out;
}

/** Ground layout in the box: aeroway ways (runways, taxiways, aprons, terminals …) and gates. */
export async function loadAirportLayout(b: Bounds): Promise<AirportLayout> {
  const bbox = `${b.south},${b.west},${b.north},${b.east}`;
  const query = `[out:json][timeout:35];
(
  way["aeroway"~"^(runway|taxiway|taxilane|apron|terminal|hangar|helipad)$"](${bbox});
  way["aeroway"~"^(gate|parking_position)$"](${bbox});
  node["aeroway"~"^(gate|parking_position|helipad)$"](${bbox});
);
out geom qt;`;
  const json = await overpass<{ elements?: OsmElement[] }>(query, 'airport3d', 45000);
  return parseAirport(json.elements ?? []);
}

/** Other buildings inside aerodrome areas (separate request: it is the slow part). */
export async function loadAirportBuildings(b: Bounds): Promise<Feature<Polygon>[]> {
  const bbox = `${b.south},${b.west},${b.north},${b.east}`;
  const query = `[out:json][timeout:35];
nwr["aeroway"="aerodrome"](${bbox});
map_to_area->.a;
way["building"](area.a)(${bbox});
out geom qt;`;
  const json = await overpass<{ elements?: OsmElement[] }>(query, 'airport3d-bld', 45000);
  return parseAirport(json.elements ?? []).polygons;
}

/** Runway, taxiway and approach lights (a big airport maps thousands of nodes – loaded only when zoomed in). */
export async function loadAirportLights(b: Bounds): Promise<Feature<Point>[]> {
  const bbox = `${b.south},${b.west},${b.north},${b.east}`;
  const query = `[out:json][timeout:35];
node["aeroway"="navigationaid"](${bbox});
out qt;`;
  const json = await overpass<{ elements?: OsmElement[] }>(query, 'airport3d-lights', 45000);
  return parseAirport(json.elements ?? []).points;
}

export const emptyFc = <G extends Polygon | LineString | Point>(features: Feature<G>[] = []): FeatureCollection<G> => ({ type: 'FeatureCollection', features });
