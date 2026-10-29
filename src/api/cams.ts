import type { Feature, FeatureCollection, Point } from 'geojson';
import { store } from '../store';
import { fetchJson } from '../util';
import { overpass } from './overpass';

// Cameras: public live webcams and licence-plate readers (ALPR) mapped in OpenStreetMap.

export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

type OsmElement = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };

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
  const { elements: els } = await overpass<{ elements: OsmElement[] }>(
    `[out:json][timeout:25];(nwr["webcam"](${bb});nwr["contact:webcam"](${bb});nwr["surveillance"="webcam"](${bb}););out center tags 1500;`,
    'webcams',
    30000,
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
    const dir = parseFloat((t['camera:direction'] ?? t.direction ?? '').split(';')[0]);
    features.push(point(lon, lat, { ...cam, kind: 'osm', dir: Number.isFinite(dir) ? dir : -1 }));
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
  const { elements: els } = await overpass<{ elements: OsmElement[] }>(`[out:json][timeout:25];nwr["surveillance:type"="ALPR"](${bb});out center tags 5000;`, 'alpr', 30000);
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
        zone: t['surveillance:zone'] ?? '',
        since: t.start_date ?? '',
        ref: t.ref ?? '',
        brand,
        url: `https://www.openstreetmap.org/${el.type}/${el.id}`,
        deflock: `https://maps.deflock.org/?lat=${lat.toFixed(5)}&lng=${lon.toFixed(5)}&zoom=17`,
      }),
    );
  }
  return { type: 'FeatureCollection', features };
}

// ---------------------------------------------------------------------------
// General surveillance cameras (CCTV) as mapped in OpenStreetMap: man_made=surveillance with
// surveillance:type=camera|guard. Plate readers (ALPR) and webcams with a public link are
// separate layers and are left out here. Live from Overpass when zoomed in; dense cities
// have thousands of them, so the result is capped.

export const CCTV_LIMIT = 4000;

export async function loadCctv(b: Bounds): Promise<FeatureCollection<Point>> {
  const bb = bboxStr(b);
  const { elements: els } = await overpass<{ elements: OsmElement[] }>(
    `[out:json][timeout:25];(node["man_made"="surveillance"]["surveillance:type"!="ALPR"](${bb});node["man_made"="surveillance"][!"surveillance:type"](${bb}););out tags center ${CCTV_LIMIT};`,
    'cctv',
    30000,
  );
  const features: Feature<Point>[] = [];
  for (const el of els) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;
    const t = el.tags ?? {};
    if (t.webcam || t['contact:webcam']) continue;
    const dir = parseFloat((t['camera:direction'] ?? t.direction ?? '').split(';')[0]);
    features.push(
      point(lon, lat, {
        title: t['surveillance:type'] === 'guard' ? 'Wachpersonal / Sicherheitsdienst' : 'Überwachungskamera',
        subtitle: [t['camera:type'], t.operator].filter(Boolean).join(' · '),
        dir: Number.isFinite(dir) ? dir : -1,
        kind: t.surveillance ?? '',
        ctype: t['camera:type'] ?? '',
        mount: t['camera:mount'] ?? '',
        operator: t.operator ?? '',
        since: t.start_date ?? '',
        ref: t.ref ?? '',
        url: `https://www.openstreetmap.org/${el.type}/${el.id}`,
      }),
    );
  }
  return { type: 'FeatureCollection', features };
}

// ---------------------------------------------------------------------------
// Speed and red-light cameras as mapped in OpenStreetMap: nodes with
// highway=speed_camera plus type=enforcement relations (the zone a device
// governs – a monitored stretch or an intersection). Locations live from
// Overpass when zoomed in; coverage depends on the OSM community. A map of
// locations, not a warning system – in Germany using one while driving is
// illegal (§ 23 StVO).

const speedcamCache = new Map<string, { at: number; fc: FeatureCollection<Point> }>();

export async function loadSpeedcams(b: Bounds): Promise<FeatureCollection<Point>> {
  const bb = bboxStr(b);
  const hit = speedcamCache.get(bb);
  if (hit && Date.now() - hit.at < 10 * 60000) return hit.fc;
  // `rel` statt `nwr`: type=enforcement gibt es nur als Relation – nwr würde alle Knoten und Wege danach durchsuchen (viel langsamer)
  const { elements: els } = await overpass<{ elements: OsmElement[] }>(
    `[out:json][timeout:25];(node["highway"="speed_camera"](${bb});rel["type"="enforcement"](${bb}););out center tags 4000;`,
    'speedcams',
    30000,
  );
  const features: Feature<Point>[] = [];
  const nodePts: [number, number][] = [];
  for (const el of els) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const t = el.tags ?? {};
    const dir = parseFloat(String(t.direction ?? t['camera:direction'] ?? '').split(';')[0]);
    const props: Record<string, unknown> = {
      kind: 'cam',
      title: 'Ortsfester Blitzer',
      subtitle: 'Geschwindigkeit',
      dir: Number.isFinite(dir) ? dir : -1,
      speed: t.maxspeed ?? '',
      operator: t.operator ?? '',
      ref: t.ref ?? '',
      url: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    };
    // enforcement relations complement the plain camera nodes: average-speed
    // sections (Abschnittskontrolle) and red-light cameras; a section centred on
    // a mapped camera node is a duplicate and gets dropped (rough 300 m check)
    if (el.type !== 'node' && t.enforcement) {
      if (t.enforcement === 'maxspeed' && nodePts.some(([x, y]) => Math.abs(y - lat) < 0.003 && Math.abs(x - lon) * Math.cos((lat * Math.PI) / 180) < 0.003)) continue;
      props.kind = t.enforcement === 'traffic_signals' ? 'signals' : 'section';
      props.title = t.enforcement === 'traffic_signals' ? 'Rotlicht-Blitzer' : 'Abschnittskontrolle';
      props.subtitle = t.enforcement === 'traffic_signals' ? 'Geschwindigkeit & Ampel' : 'Durchschnittsgeschwindigkeit';
      if (t.maxspeed) props.speed = t.maxspeed;
    }
    if (el.type === 'node') nodePts.push([lon, lat]);
    features.push(point(lon, lat, props));
  }
  const fc: FeatureCollection<Point> = { type: 'FeatureCollection', features };
  speedcamCache.set(bb, { at: Date.now(), fc });
  return fc;
}
