import type { Feature, FeatureCollection, Point } from 'geojson';
import { fetchJson } from '../util';
import { BIKE_SYSTEMS, type BikeSystem } from './bikesystems';

// Bike-sharing stations from the operators' open GBFS feeds (keyless, CORS enabled): station list
// (name, position, capacity) plus live availability. The station list rarely changes and is kept
// for 12 h; the availability is loaded fresh each time.

/** Urban Sharing and Entur ask clients to identify themselves (both allow the header via CORS). */
function headersFor(url: string): HeadersInit | undefined {
  if (url.includes('gbfs.urbansharing.com')) return { 'Client-Identifier': 'malte9799-orbis' };
  if (url.includes('api.entur.io')) return { 'ET-Client-Name': 'malte9799-orbis' };
  return undefined;
}

/** one point per system, for the overview when zoomed out */
export function bikeSystemPoints(): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: BIKE_SYSTEMS.map(([id, city, provider, lat, lon]) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: { id, city, provider } })),
  };
}

/** systems whose service area touches the view */
export function bikeSystemsInView(b: { west: number; south: number; east: number; north: number }): BikeSystem[] {
  return BIKE_SYSTEMS.filter(([, , , lat, lon, km]) => {
    const dLat = km / 111.32;
    const dLon = km / (111.32 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
    return lon + dLon > b.west && lon - dLon < b.east && lat + dLat > b.south && lat - dLat < b.north;
  });
}

interface InfoStation {
  station_id: string;
  name?: string | { text: string }[];
  lat: number;
  lon: number;
  capacity?: number;
}
interface StatusStation {
  station_id: string;
  num_bikes_available?: number;
  num_ebikes_available?: number;
  vehicle_types_available?: { vehicle_type_id: string; count: number }[];
  num_docks_available?: number;
  is_installed?: boolean | number;
  is_renting?: boolean | number;
  last_reported?: number | string;
}

const infoCache = new Map<string, { at: number; stations: InfoStation[] }>();

/** GBFS 3 names are localised lists, GBFS 2 plain strings */
const text = (v: InfoStation['name']) => (Array.isArray(v) ? (v[0]?.text ?? '') : (v ?? ''));

export async function loadBikeStations([id, city, provider, , , , info]: BikeSystem): Promise<Feature<Point>[]> {
  const headers = headersFor(info);
  const cached = infoCache.get(id);
  const infoJob =
    cached && Date.now() - cached.at < 12 * 3600 * 1000
      ? Promise.resolve(cached.stations)
      : fetchJson<{ data: { stations: InfoStation[] } }>(info, { headers }, 25000).then((j) => {
          infoCache.set(id, { at: Date.now(), stations: j.data.stations });
          return j.data.stations;
        });
  const [stations, status] = await Promise.all([infoJob, fetchJson<{ data: { stations: StatusStation[] } }>(info.replace('station_information', 'station_status'), { headers }, 25000)]);
  const byId = new Map(status.data.stations.map((s) => [String(s.station_id), s]));
  const features: Feature<Point>[] = [];
  for (const s of stations) {
    if (!Number.isFinite(s.lat) || !Number.isFinite(s.lon) || (s.lat === 0 && s.lon === 0)) continue;
    const st = byId.get(String(s.station_id));
    const off = !st || st.is_installed === false || st.is_installed === 0 || st.is_renting === false || st.is_renting === 0;
    const bikes = st?.num_bikes_available ?? 0;
    // e-bikes: only when the operator reports them separately (num_ebikes_available)
    const ebikes = st?.num_ebikes_available ?? null;
    const reported = st?.last_reported;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
      properties: {
        name: text(s.name) || 'Station',
        sys: `${provider} · ${city}`,
        bikes,
        ebikes,
        docks: st?.num_docks_available ?? null,
        capacity: s.capacity ?? null,
        off,
        // retired stations report placeholder times like 86400 (1970) – no date then
        updated: reported == null ? '' : typeof reported === 'number' ? (reported > 946684800 ? new Date(reported * 1000).toISOString() : '') : reported,
      },
    });
  }
  return features;
}
