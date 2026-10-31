import type { Feature, FeatureCollection, LineString, Polygon } from 'geojson';
import { overpass } from './overpass';
import type { Bounds } from './networks';

// Road markings from OpenStreetMap (Overpass): zebra crossings, marked crossings, explicit
// line markings (road_marking) and no-overtaking lines (overtaking), plus traffic islands.
// Coverage depends on mapping density – best in central Europe. Road-side lane/edge lines not
// tagged in OSM are derived from the road classes in the vector tiles (see layers/defs/roadmark).

type El = {
  type: string;
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
};

const ZEBRA = /zebra|bar/;

/** What kind of marking: which map layer draws it. */
export type MarkKind = 'zebra' | 'cross' | 'marking' | 'over' | 'island';

export async function loadRoadMarkings(b: Bounds): Promise<FeatureCollection<LineString | Polygon>> {
  const bb = `${b.south.toFixed(4)},${b.west.toFixed(4)},${b.north.toFixed(4)},${b.east.toFixed(4)}`;
  const { elements: els } = await overpass<{ elements: El[] }>(
    // `out body` keeps the way geometry; areas come as closed ways and are converted to polygons
    `[out:json][timeout:40];(way["crossing"~"^(zebra|marked|lines|dash|dash_left|dash_right|dots|bar)$"](${bb});way["crossing:markings"](${bb});way["road_marking"](${bb});way["highway"]["overtaking"~"^(no|reverse|opposite)$"](${bb});way["traffic_island"](${bb});area["traffic_island"](${bb}););out body 8000;`,
    'roadmark',
  );
  const features: Feature<LineString | Polygon>[] = [];
  for (const el of els) {
    const t = el.tags ?? {};
    if (!el.geometry || el.geometry.length < 2) continue;
    const coords = el.geometry.map((p) => [p.lon, p.lat] as [number, number]);
    const closed = coords.length >= 4 && coords[0][0] === coords.at(-1)![0] && coords[0][1] === coords.at(-1)![1];
    let kind: MarkKind;
    let dash = false;
    let title = '';
    if (ZEBRA.test(t['crossing:markings'] ?? t.crossing ?? '')) {
      kind = 'zebra';
      title = 'Zebrastreifen';
    } else if (t.crossing || t['crossing:markings']) {
      kind = 'cross';
      dash = true;
      title = 'Markierte Querungsanlage';
    } else if (t.road_marking) {
      kind = 'marking';
      dash = /dash|broken/i.test(t['road_marking:stroke'] ?? t.road_marking);
      title = 'Bodenmarkierung';
    } else if (t.overtaking) {
      kind = 'over';
      title = 'Überholverbot';
    } else {
      kind = 'island';
      title = 'Verkehrsinsel';
    }
    features.push({
      type: 'Feature',
      geometry: closed && kind === 'island' ? { type: 'Polygon', coordinates: [coords] } : { type: 'LineString', coordinates: coords },
      properties: { kind, dash, title, marking: t.road_marking ?? '', url: `https://www.openstreetmap.org/${el.type}/${el.id}` },
    });
  }
  return { type: 'FeatureCollection', features };
}
