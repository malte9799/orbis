import type { Feature, FeatureCollection, Point } from 'geojson';
import { store } from '../store';
import { fetchJson } from '../util';

// Cameras: public live webcams and licence-plate readers (ALPR) mapped in OpenStreetMap.

export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];

type OsmElement = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };

async function overpass(query: string): Promise<OsmElement[]> {
  let lastErr: unknown;
  for (const ep of OVERPASS) {
    try {
      const data = await fetchJson<{ elements: OsmElement[] }>(ep, { method: 'POST', body: new URLSearchParams({ data: query }) }, 30000);
      return data.elements;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

const bboxStr = (b: Bounds) => `${b.south.toFixed(4)},${b.west.toFixed(4)},${b.north.toFixed(4)},${b.east.toFixed(4)}`;
const point = (lon: number, lat: number, properties: Record<string, unknown>): Feature<Point> => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [lon, lat] },
  properties,
});

// ---------------------------------------------------------------------------
// Webcams
//
// • Fintraffic Digitraffic: ~800 road weather cameras in Finland, open data (CC BY 4.0),
//   still images refreshed about every 10 minutes.
// • OpenStreetMap: webcams mapped with a link (webcam=*, contact:webcam=*, surveillance=webcam).
// • Windy Webcams (optional free API key): tens of thousands of webcams worldwide.

export interface Webcam {
  id: string;
  title: string;
  subtitle?: string;
  /** current still image */
  image?: string;
  /** page with the live stream / more images */
  url?: string;
  source: string;
  updated?: string;
}

let digitrafficCache: Promise<FeatureCollection<Point>> | null = null;

/** Finnish road weather cameras (all of them, ~800 stations). */
export function loadDigitrafficCams(): Promise<FeatureCollection<Point>> {
  digitrafficCache ??= fetchJson<{
    features: { id: string; geometry: { coordinates: number[] }; properties: { id: string; name: string; collectionStatus?: string; presets?: { id: string; inCollection?: boolean }[]; dataUpdatedTime?: string } }[];
  }>('https://tie.digitraffic.fi/api/weathercam/v1/stations', undefined, 25000)
    .then((json) => ({
      type: 'FeatureCollection' as const,
      features: json.features
        .filter((f) => f.properties.collectionStatus !== 'REMOVED_PERMANENTLY' && f.properties.presets?.some((p) => p.inCollection !== false))
        .map((f) => {
          const preset = f.properties.presets!.find((p) => p.inCollection !== false)!;
          const cam: Webcam = {
            id: `fi-${f.properties.id}`,
            title: f.properties.name.replace(/_/g, ' '),
            subtitle: 'Straßenwetterkamera Finnland',
            image: `https://weathercam.digitraffic.fi/${preset.id}.jpg`,
            url: `https://liikennetilanne.fintraffic.fi/kartta/?lang=en&checkedLayers=weatherCamera&cameraId=${f.properties.id}`,
            source: 'Fintraffic Digitraffic (CC BY 4.0)',
          };
          return point(f.geometry.coordinates[0], f.geometry.coordinates[1], { ...cam, kind: 'road' });
        }),
    }))
    .catch((e) => {
      digitrafficCache = null;
      throw e;
    });
  return digitrafficCache;
}

/** Webcams mapped in OpenStreetMap inside the bounds (needs a zoomed-in view). */
export async function loadOsmWebcams(b: Bounds): Promise<FeatureCollection<Point>> {
  const bb = bboxStr(b);
  const els = await overpass(
    `[out:json][timeout:25];(nwr["webcam"](${bb});nwr["contact:webcam"](${bb});nwr["surveillance"="webcam"](${bb}););out center tags 1500;`,
  );
  const features: Feature<Point>[] = [];
  for (const el of els) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    const t = el.tags ?? {};
    const link = t.webcam ?? t['contact:webcam'] ?? t.url ?? t.website ?? t['contact:website'];
    if (lat == null || lon == null || !link || !/^https?:\/\//.test(link)) continue;
    const cam: Webcam = {
      id: `osm-${el.type}-${el.id}`,
      title: t.name ?? t.description ?? 'Webcam',
      subtitle: [t.operator, t['camera:type'] === 'panning' ? 'Schwenkkamera' : ''].filter(Boolean).join(' · ') || 'Webcam (OpenStreetMap)',
      url: link,
      source: 'OpenStreetMap',
    };
    features.push(point(lon, lat, { ...cam, kind: 'osm' }));
  }
  return { type: 'FeatureCollection', features };
}

interface WindyCam {
  webcamId: number;
  title: string;
  lastUpdatedOn?: string;
  location?: { latitude: number; longitude: number; city?: string; country?: string };
  images?: { current?: { preview?: string; thumbnail?: string } };
  player?: { day?: string; live?: string };
  urls?: { detail?: string };
}

export const hasWindyKey = () => !!store.getKeys().windy;

/** Windy webcams around a point (radius ≤ 250 km). Image URLs expire after ~10 min. */
export async function loadWindyWebcams(lat: number, lon: number, radiusKm: number): Promise<FeatureCollection<Point>> {
  const key = store.getKeys().windy;
  if (!key) return { type: 'FeatureCollection', features: [] };
  const r = Math.max(5, Math.min(250, Math.round(radiusKm)));
  const json = await fetchJson<{ webcams: WindyCam[] }>(
    `https://api.windy.com/webcams/api/v3/webcams?nearby=${lat.toFixed(3)},${lon.toFixed(3)},${r}&limit=50&include=images,location,player,urls&lang=de`,
    { headers: { 'x-windy-api-key': key } },
    15000,
  );
  return {
    type: 'FeatureCollection',
    features: json.webcams
      .filter((w) => w.location)
      .map((w) =>
        point(w.location!.longitude, w.location!.latitude, {
          id: `windy-${w.webcamId}`,
          title: w.title,
          subtitle: [w.location!.city, w.location!.country].filter(Boolean).join(', '),
          image: w.images?.current?.preview ?? w.images?.current?.thumbnail,
          url: w.urls?.detail ?? `https://www.windy.com/webcams/${w.webcamId}`,
          source: 'Windy.com Webcams',
          updated: w.lastUpdatedOn,
          kind: 'windy',
        } satisfies Webcam & { kind: string }),
      ),
  };
}

// ---------------------------------------------------------------------------
// Licence plate readers (ALPR) as mapped by the DeFlock community in OpenStreetMap
// (surveillance:type=ALPR). Overview for the USA/Canada from the deflock-data vector tiles
// (hourly OSM extract), details live from Overpass when zoomed in – works worldwide.

export const ALPR_TILES_US = 'https://tiles.dontgetflocked.com/cameras-us-hourly.json';
export const ALPR_TILES_CA = 'https://tiles.dontgetflocked.com/cameras-ca-hourly.json';
export const ALPR_SOURCE_LAYER = 'cameras';

export async function loadAlpr(b: Bounds): Promise<FeatureCollection<Point>> {
  const bb = bboxStr(b);
  const els = await overpass(`[out:json][timeout:25];nwr["surveillance:type"="ALPR"](${bb});out center tags 5000;`);
  const features: Feature<Point>[] = [];
  for (const el of els) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;
    const t = el.tags ?? {};
    const brand = t.manufacturer ?? t.brand ?? t['manufacturer:wikidata'] ?? '';
    const flock = /flock/i.test(brand) || t['manufacturer:wikidata'] === 'Q108485435';
    const dir = parseFloat((t['camera:direction'] ?? t.direction ?? '').split(';')[0]);
    features.push(
      point(lon, lat, {
        title: flock ? 'Flock-Kamera (ALPR)' : 'Kennzeichenerfassung (ALPR)',
        subtitle: [brand, t.operator].filter(Boolean).join(' · '),
        flock,
        dir: Number.isFinite(dir) ? dir : -1,
        mount: t['camera:mount'] ?? '',
        operator: t.operator ?? '',
        brand,
        url: `https://www.openstreetmap.org/${el.type}/${el.id}`,
        deflock: `https://maps.deflock.org/?lat=${lat.toFixed(5)}&lng=${lon.toFixed(5)}&zoom=17`,
      }),
    );
  }
  return { type: 'FeatureCollection', features };
}
