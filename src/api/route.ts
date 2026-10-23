import { fetchJson } from '../util';
import { viaProxy } from './proxy';

// Route of a flight (origin → destination airport) by its callsign. adsbdb.com is a free,
// community-maintained database: a callsign maps to the usual route, not to the actual flight plan,
// and some callsigns are unknown.

export interface RouteAirport {
  icao: string;
  iata: string;
  name: string;
  city: string;
  country: string;
  lon: number;
  lat: number;
}

export interface FlightRoute {
  origin: RouteAirport;
  destination: RouteAirport;
}

interface AdsbdbAirport {
  icao_code?: string;
  iata_code?: string;
  name?: string;
  municipality?: string;
  country_name?: string;
  latitude?: number;
  longitude?: number;
}

const TTL_FOUND = 6 * 3600_000;
const TTL_FAILED = 2 * 60_000;

const cache = new Map<string, { at: number; ttl: number; route: FlightRoute | null }>();
const pending = new Map<string, Promise<FlightRoute | null>>();

const airport = (a: AdsbdbAirport | undefined): RouteAirport | null =>
  a && typeof a.latitude === 'number' && typeof a.longitude === 'number'
    ? { icao: a.icao_code ?? '', iata: a.iata_code ?? '', name: a.name ?? '', city: a.municipality ?? '', country: a.country_name ?? '', lon: a.longitude, lat: a.latitude }
    : null;

/** Cached route of a callsign (null: unknown). Never rejects. */
export function loadRoute(callsign: string): Promise<FlightRoute | null> {
  const cs = callsign.trim().toUpperCase();
  if (!/^[A-Z0-9]{3,8}$/.test(cs)) return Promise.resolve(null);
  const hit = cache.get(cs);
  if (hit && Date.now() - hit.at < hit.ttl) return Promise.resolve(hit.route);
  let p = pending.get(cs);
  if (!p) {
    p = fetchJson<{ response?: { flightroute?: { origin?: AdsbdbAirport; destination?: AdsbdbAirport } } | string }>(viaProxy(`https://api.adsbdb.com/v0/callsign/${cs}`), undefined, 8000)
      .then((j) => {
        const fr = typeof j.response === 'object' ? j.response?.flightroute : undefined;
        const origin = airport(fr?.origin);
        const destination = airport(fr?.destination);
        const route = origin && destination ? { origin, destination } : null;
        // "unknown callsign" is an answer, too – remember it for the same time as a hit
        cache.set(cs, { at: Date.now(), ttl: TTL_FOUND, route });
        return route;
      })
      .catch(() => {
        cache.set(cs, { at: Date.now(), ttl: TTL_FAILED, route: null });
        return null;
      })
      .finally(() => pending.delete(cs));
    pending.set(cs, p);
  }
  return p;
}

const haversine = (aLon: number, aLat: number, bLon: number, bLat: number) => {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLon - aLon) / 2) ** 2;
  return 2 * 6371009 * Math.asin(Math.min(1, Math.sqrt(h)));
};

/**
 * Does the aircraft fly roughly along this route? The same callsign is used for different routes
 * over time, so a route far away from the aircraft is discarded (detour at most ~25 % + 100 km).
 */
export function plausible(route: FlightRoute, lon: number, lat: number): boolean {
  const { origin: o, destination: d } = route;
  return haversine(o.lon, o.lat, lon, lat) + haversine(lon, lat, d.lon, d.lat) <= haversine(o.lon, o.lat, d.lon, d.lat) * 1.25 + 100_000;
}

/** Already loaded route (undefined: not asked yet / still loading). */
export const cachedRoute = (callsign: string): FlightRoute | null | undefined => cache.get(callsign.trim().toUpperCase())?.route;
