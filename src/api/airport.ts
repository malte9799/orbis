import type { Feature, FeatureCollection, LineString, Point, Polygon } from 'geojson';
import { overpass } from './overpass';
import { LIGHT_COLOURS, LIGHT_TYPES, parseAirport, type AirportLayout, type Bounds, type OsmElement } from './airport-parse';

export type { AirportKind, AirportLayout, Bounds } from './airport-parse';

/** Ground layout in the box: runways, taxiways, aprons and gates (buildings come from the base map). */
export async function loadAirportLayout(b: Bounds): Promise<AirportLayout> {
  const bbox = `${b.south},${b.west},${b.north},${b.east}`;
  const query = `[out:json][timeout:35];
(
  way["aeroway"~"^(runway|taxiway|taxilane|apron|helipad)$"](${bbox});
  way["aeroway"~"^(gate|parking_position)$"](${bbox});
  node["aeroway"~"^(gate|parking_position|helipad)$"](${bbox});
);
out geom qt;`;
  const json = await overpass<{ elements?: OsmElement[] }>(query, 'airport3d', 45000);
  return parseAirport(json.elements ?? []);
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

/** An airport with a pre-built layout (scripts/airports.ts → public/data/airports). */
export interface StaticAirport {
  icao: string;
  name: string;
  /** [west, south, east, north] */
  bbox: [number, number, number, number];
}

const STATIC = `${import.meta.env.BASE_URL}data/airports/`;
let staticIndex: { at: number; list: Promise<StaticAirport[]> } | null = null;

/** The airports that ship with a layout; an unreachable index is retried after a minute. */
export function staticAirports(): Promise<StaticAirport[]> {
  if (!staticIndex || (Date.now() - staticIndex.at > 60000 && staticIndex.list === FAILED)) {
    const list = fetch(`${STATIC}index.json`)
      .then((r) => (r.ok ? (r.json() as Promise<{ airports: StaticAirport[] }>) : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => j.airports)
      .catch(() => FAILED);
    staticIndex = { at: Date.now(), list };
  }
  return staticIndex.list;
}
const FAILED: Promise<StaticAirport[]> = Promise.resolve([]);

/** Layout (and lights) of a pre-built airport; the file leaves out empty/default properties. */
export async function loadStaticAirport(a: StaticAirport): Promise<AirportLayout> {
  const res = await fetch(`${STATIC}${a.icao}.json`);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${a.icao}`);
  const j = (await res.json()) as AirportLayout & { lights?: number[]; v?: number };
  for (const f of j.polygons) f.properties = { ref: '', ...f.properties };
  for (const f of j.lines) f.properties = { ref: '', w: 20, ...f.properties };
  for (const f of j.points) f.properties = { ref: '', ...f.properties };
  // lights come as one flat array: [lon, lat, type, colour, …] (v2) or just [lon, lat, …] (older files)
  const lights = j.lights ?? [];
  const step = j.v === 2 ? 4 : 2;
  for (let i = 0; i + step - 1 < lights.length; i += step) {
    const id = `l${a.icao}${i / step}`;
    const lt = step === 4 ? (LIGHT_TYPES[lights[i + 2]] ?? 'other') : 'txe';
    const col = step === 4 ? (LIGHT_COLOURS[lights[i + 3]] ?? 'white') : 'blue';
    j.points.push({ type: 'Feature', id, geometry: { type: 'Point', coordinates: [lights[i], lights[i + 1]] }, properties: { id, kind: 'light', ref: '', lt, col } });
  }
  return j;
}

export const emptyFc = <G extends Polygon | LineString | Point>(features: Feature<G>[] = []): FeatureCollection<G> => ({ type: 'FeatureCollection', features });
