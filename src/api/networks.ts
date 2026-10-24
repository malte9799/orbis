import type { Feature, FeatureCollection, MultiLineString, Point } from 'geojson';
import { overpass } from './overpass';

// Public transport network from OpenStreetMap route relations (Overpass): bus, trolleybus,
// tram, subway, light rail and ferry lines with their line number and colour, plus stops.

export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export const ROUTE_STYLE: Record<string, { label: string; color: string; order: number }> = {
  subway: { label: 'U-Bahn', color: '#1e88e5', order: 5 },
  light_rail: { label: 'Stadtbahn', color: '#00897b', order: 4 },
  tram: { label: 'Straßenbahn', color: '#d81b60', order: 3 },
  trolleybus: { label: 'O-Bus', color: '#8e24aa', order: 2 },
  bus: { label: 'Bus', color: '#7e57c2', order: 1 },
  ferry: { label: 'Fähre', color: '#039be5', order: 0 },
};

type El = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  members?: { type: string; role: string; geometry?: { lat: number; lon: number }[] }[];
};

const validColor = (c?: string) => (c && /^#?[0-9a-f]{3}([0-9a-f]{3})?$/i.test(c) ? (c.startsWith('#') ? c : `#${c}`) : undefined);

/** Lines and stops inside the bounds (use from city zoom – results can be large). */
export async function loadTransitNetwork(b: Bounds): Promise<{ lines: FeatureCollection<MultiLineString>; stops: FeatureCollection<Point> }> {
  const bb = `${b.south.toFixed(4)},${b.west.toFixed(4)},${b.north.toFixed(4)},${b.east.toFixed(4)}`;
  const { elements: els } = await overpass<{ elements: El[] }>(
    // `out tags` prints no coordinates and `out geom tags` drops the relation members, so both
    // parts would come back without geometry – `out body` (+ `geom` for the ways) is required.
    `[out:json][timeout:35];(relation["type"="route"]["route"~"^(bus|trolleybus|tram|subway|light_rail|ferry)$"](${bb});)->.r;.r out body geom;node(r.r:"stop")(${bb});out body 4000;`,
    'busnet',
  );
  const lines: Feature<MultiLineString>[] = [];
  const stops: Feature<Point>[] = [];
  const seenStops = new Set<string>();
  for (const el of els) {
    const t = el.tags ?? {};
    if (el.type === 'relation') {
      const mode = t.route;
      const st = ROUTE_STYLE[mode] ?? ROUTE_STYLE.bus;
      const coords = (el.members ?? [])
        .filter((m) => m.type === 'way' && m.geometry && m.geometry.length > 1 && !/platform/.test(m.role))
        .map((m) => m.geometry!.map((p) => [p.lon, p.lat]));
      if (!coords.length) continue;
      lines.push({
        type: 'Feature',
        geometry: { type: 'MultiLineString', coordinates: coords },
        properties: {
          ref: t.ref ?? '',
          name: t.name ?? '',
          mode,
          modeLabel: st.label,
          color: validColor(t.colour) ?? st.color,
          order: st.order,
          from: t.from ?? '',
          to: t.to ?? '',
          operator: t.operator ?? t.network ?? '',
          url: `https://www.openstreetmap.org/relation/${el.id}`,
        },
      });
    } else if (el.type === 'node' && el.lat != null && el.lon != null) {
      const name = t.name ?? '';
      // one marker per stop name and rough position (both directions share a name)
      const key = `${name}|${el.lat.toFixed(3)}|${el.lon.toFixed(3)}`;
      if (seenStops.has(key)) continue;
      seenStops.add(key);
      stops.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [el.lon, el.lat] }, properties: { name, url: `https://www.openstreetmap.org/node/${el.id}` } });
    }
  }
  lines.sort((a, z) => a.properties!.order - z.properties!.order);
  return { lines: { type: 'FeatureCollection', features: lines }, stops: { type: 'FeatureCollection', features: stops } };
}
