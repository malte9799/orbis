import type { Feature, Point } from 'geojson';
import { overpass } from './overpass';

// Estimated viewing direction for road cameras whose feed gives none (Finland, Iceland, many others):
// the camera stands at the road it watches, so the heading of the nearest road segment is the best
// available guess. One Overpass query for a batch of cameras, results cached per camera.

/** a camera further than this from any road gets no estimate */
const MAX_DIST_M = 40;
const BATCH = 40;
const ROADS = 'motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|motorway_link|trunk_link|primary_link|secondary_link|tertiary_link';

/** camera id → heading in degrees, or null when no road was found nearby */
const cache = new Map<string, number | null>();

interface Way {
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
}

export const camKey = (f: Feature<Point>) => String(f.properties?.id ?? f.geometry.coordinates.join(','));
export const needsEstimate = (f: Feature<Point>) => !(Number(f.properties?.dir ?? -1) >= 0) && !cache.has(camKey(f));

/** Look up headings for up to BATCH cameras; resolves with the cameras that got one. */
export async function estimateHeadings(cams: Feature<Point>[]): Promise<Map<Feature<Point>, number>> {
  const todo = cams.filter(needsEstimate).slice(0, BATCH);
  const out = new Map<Feature<Point>, number>();
  if (!todo.length) return out;
  const around = todo.map((f) => `way["highway"~"^(${ROADS})$"](around:${MAX_DIST_M},${f.geometry.coordinates[1].toFixed(6)},${f.geometry.coordinates[0].toFixed(6)});`).join('');
  const { elements } = await overpass<{ elements: Way[] }>(`[out:json][timeout:25];(${around});out geom tags;`, 'webcam-dir', 60000);
  const ways = elements.filter((w) => w.geometry && w.geometry.length > 1);
  for (const f of todo) {
    const [lon, lat] = f.geometry.coordinates;
    const h = nearestHeading(lon, lat, ways);
    cache.set(camKey(f), h ?? null);
    if (h != null) out.set(f, h);
  }
  return out;
}

/** Heading of the road segment nearest to the point; one-way roads keep their direction of travel,
 * otherwise the axis is folded to 0–180° (which side the camera faces cannot be known). */
function nearestHeading(lon: number, lat: number, ways: Way[]): number | null {
  const kx = Math.cos((lat * Math.PI) / 180) * 111320;
  const ky = 110540;
  let best = Infinity;
  let heading: number | null = null;
  for (const w of ways) {
    const g = w.geometry!;
    const oneway = w.tags?.oneway === 'yes' || w.tags?.oneway === '1' || w.tags?.junction === 'roundabout' ? 1 : w.tags?.oneway === '-1' ? -1 : 0;
    for (let i = 0; i < g.length - 1; i++) {
      const ax = (g[i].lon - lon) * kx;
      const ay = (g[i].lat - lat) * ky;
      const bx = (g[i + 1].lon - lon) * kx;
      const by = (g[i + 1].lat - lat) * ky;
      const dx = bx - ax;
      const dy = by - ay;
      const len2 = dx * dx + dy * dy;
      if (len2 < 1) continue;
      const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
      const d = Math.hypot(ax + t * dx, ay + t * dy);
      if (d >= best) continue;
      best = d;
      let deg = (Math.atan2(dx, dy) * 180) / Math.PI;
      if (oneway === -1) deg += 180;
      deg = ((deg % 360) + 360) % 360;
      heading = oneway ? deg : deg % 180;
    }
  }
  return best <= MAX_DIST_M && heading != null ? Math.round(heading) : null;
}
