import type { Feature, FeatureCollection, Point } from 'geojson';
import { fetchJson } from '../util';

// Radio stations from the community database Radio Browser (radio-browser.info, free, public
// domain data). Overview: the most-listened stations worldwide; zoomed in: all stations
// near the map centre. Streams play directly in the built-in player.

interface RbStation {
  stationuuid: string;
  name: string;
  url_resolved: string;
  homepage?: string;
  favicon?: string;
  tags?: string;
  country?: string;
  state?: string;
  language?: string;
  codec?: string;
  bitrate?: number;
  hls?: number;
  geo_lat?: number | null;
  geo_long?: number | null;
  clickcount?: number;
  lastcheckok?: number;
}

const FALLBACK_SERVERS = ['de1.api.radio-browser.info', 'de2.api.radio-browser.info', 'fi1.api.radio-browser.info'];
let server: Promise<string> | null = null;

function apiServer(): Promise<string> {
  server ??= fetchJson<{ name: string }[]>('https://all.api.radio-browser.info/json/servers', undefined, 8000)
    .then((list) => {
      const names = [...new Set(list.map((s) => s.name))];
      return names[Math.floor(Math.random() * names.length)] ?? FALLBACK_SERVERS[0];
    })
    .catch(() => FALLBACK_SERVERS[Math.floor(Math.random() * FALLBACK_SERVERS.length)]);
  return server;
}

async function rb<T>(path: string): Promise<T> {
  const host = await apiServer();
  try {
    return await fetchJson<T>(`https://${host}${path}`, undefined, 20000);
  } catch (e) {
    // try another mirror once
    const other = FALLBACK_SERVERS.find((h) => h !== host)!;
    server = Promise.resolve(other);
    return fetchJson<T>(`https://${other}${path}`, undefined, 20000);
  }
}

function toFeatures(list: RbStation[]): FeatureCollection<Point> {
  const seen = new Set<string>();
  const features: Feature<Point>[] = [];
  for (const s of list) {
    if (s.geo_lat == null || s.geo_long == null || seen.has(s.stationuuid) || s.lastcheckok === 0) continue;
    seen.add(s.stationuuid);
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.geo_long, s.geo_lat] },
      properties: {
        id: s.stationuuid,
        name: s.name.trim(),
        stream: s.url_resolved,
        homepage: s.homepage ?? '',
        favicon: s.favicon ?? '',
        tags: (s.tags ?? '').split(',').slice(0, 4).join(', '),
        place: [s.state, s.country].filter(Boolean).join(', '),
        language: s.language ?? '',
        codec: [s.codec, s.bitrate ? `${s.bitrate} kbit/s` : ''].filter(Boolean).join(' · '),
        hls: s.hls === 1,
        // browsers block http:// audio on https:// pages
        playable: s.url_resolved?.startsWith('https://') ?? false,
        clicks: s.clickcount ?? 0,
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

const FIELDS = 'has_geo_info=true&hidebroken=true&order=clickcount&reverse=true';

/** Most popular stations worldwide (overview). */
export async function loadTopStations(): Promise<FeatureCollection<Point>> {
  return toFeatures(await rb<RbStation[]>(`/json/stations/search?${FIELDS}&limit=4000`));
}

/** Stations around a point. */
export async function loadNearbyStations(lat: number, lon: number, radiusKm: number): Promise<FeatureCollection<Point>> {
  const r = Math.round(Math.min(600, Math.max(10, radiusKm)) * 1000);
  return toFeatures(await rb<RbStation[]>(`/json/stations/search?${FIELDS}&limit=1500&geo_lat=${lat.toFixed(3)}&geo_long=${lon.toFixed(3)}&geo_distance=${r}`));
}

/** Count a click (asked for by Radio Browser) and get the current stream URL. */
export async function stationClick(id: string): Promise<string | null> {
  try {
    const r = await rb<{ url?: string; ok?: boolean }>(`/json/url/${encodeURIComponent(id)}`);
    return r.url ?? null;
  } catch {
    return null;
  }
}
