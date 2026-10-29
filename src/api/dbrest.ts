import { fetchJson } from '../util';
import type { Departure, Itinerary, Leg, PlanOptions, PlanResult, Stop } from './connections';

// DB timetable data (incl. real-time delays like the DB Navigator) via the community-run
// db-rest API (https://v6.db.transport.rest, hafas-client format, no key needed). It is a free,
// rate-limited service without guarantees – callers fall back to Transitous when it fails.

const BASE = 'https://v6.db.transport.rest';

// ---- wire format (only the fields used here) -------------------------------

interface DbStop {
  type?: string;
  id?: string;
  name?: string;
  location?: { latitude: number; longitude: number };
  latitude?: number;
  longitude?: number;
}

interface DbStopover {
  stop?: DbStop;
  arrival?: string | null;
  plannedArrival?: string | null;
  arrivalDelay?: number | null;
  departure?: string | null;
  plannedDeparture?: string | null;
  departureDelay?: number | null;
}

interface DbLine {
  name?: string;
  product?: string;
}

interface DbLeg {
  origin?: DbStop;
  destination?: DbStop;
  departure?: string | null;
  plannedDeparture?: string | null;
  departureDelay?: number | null;
  arrival?: string | null;
  plannedArrival?: string | null;
  arrivalDelay?: number | null;
  departurePlatform?: string | null;
  plannedDeparturePlatform?: string | null;
  arrivalPlatform?: string | null;
  plannedArrivalPlatform?: string | null;
  line?: DbLine;
  direction?: string;
  walking?: boolean;
  transfer?: boolean;
  distance?: number | null;
  cancelled?: boolean;
  stopovers?: DbStopover[];
}

interface DbJourney {
  legs: DbLeg[];
}

interface DbDeparture {
  when?: string | null;
  plannedWhen?: string | null;
  delay?: number | null;
  platform?: string | null;
  plannedPlatform?: string | null;
  line?: DbLine;
  direction?: string;
  cancelled?: boolean;
}

// ---- parsing ---------------------------------------------------------------

/** hafas-client product → MOTIS mode name (colors and labels live there) */
const PRODUCT_MODE: Record<string, string> = {
  nationalExpress: 'HIGHSPEED_RAIL',
  national: 'LONG_DISTANCE',
  regionalExpress: 'REGIONAL_FAST_RAIL',
  regional: 'REGIONAL_RAIL',
  suburban: 'SUBURBAN',
  subway: 'SUBWAY',
  tram: 'TRAM',
  bus: 'BUS',
  ferry: 'FERRY',
  taxi: 'BUS',
};

/** MOTIS mode → hafas-client product that has to be on */
const MODE_PRODUCT: Record<string, string> = {
  HIGHSPEED_RAIL: 'nationalExpress',
  LONG_DISTANCE: 'national',
  NIGHT_RAIL: 'national',
  REGIONAL_FAST_RAIL: 'regionalExpress',
  REGIONAL_RAIL: 'regional',
  SUBURBAN: 'suburban',
  SUBWAY: 'subway',
  TRAM: 'tram',
  BUS: 'bus',
  COACH: 'bus',
  FERRY: 'ferry',
};

const modeOf = (l?: DbLine) => PRODUCT_MODE[l?.product ?? ''] ?? 'BUS';
const ms = (iso?: string | null) => (iso ? Date.parse(iso) : NaN);
/** seconds → minutes; null when the API has no real-time value */
const minOf = (sec?: number | null): number | null => (typeof sec === 'number' ? Math.round(sec / 60) : null);

export function parseDbStops(list: DbStop[]): Stop[] {
  return list
    .filter((s) => s.type === 'stop' && s.id && s.name)
    .map((s) => ({
      id: s.id!,
      name: s.name!,
      lat: s.location?.latitude ?? s.latitude ?? NaN,
      lon: s.location?.longitude ?? s.longitude ?? NaN,
      src: 'db' as const,
    }))
    .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lon));
}

export function parseDbJourneys(list: DbJourney[]): Itinerary[] {
  return list
    .map((j): Itinerary | null => {
      // `transfer` legs are the changes between two rides: the view shows them as "Umstieg"
      const legs = j.legs.filter((l) => !l.transfer).map(
        (l): Leg => {
          const foot = !!l.walking;
          const dep = ms(l.departure ?? l.plannedDeparture);
          const arr = ms(l.arrival ?? l.plannedArrival);
          return {
            mode: foot ? 'WALK' : modeOf(l.line),
            line: foot ? '' : (l.line?.name ?? '').trim(),
            headsign: (l.direction ?? '').trim(),
            from: l.origin?.name ?? '',
            to: l.destination?.name ?? '',
            track: l.departurePlatform ?? l.plannedDeparturePlatform ?? undefined,
            toTrack: l.arrivalPlatform ?? l.plannedArrivalPlatform ?? undefined,
            dep,
            arr,
            schedDep: ms(l.plannedDeparture ?? l.departure),
            schedArr: ms(l.plannedArrival ?? l.arrival),
            delayMin: foot ? null : minOf(l.departureDelay),
            arrDelayMin: foot ? null : minOf(l.arrivalDelay),
            cancelled: !!l.cancelled,
            via: (l.stopovers ?? [])
              .slice(1, -1)
              .filter((s) => s.stop?.name)
              .map((s) => ({ name: s.stop!.name!, time: ms(s.arrival ?? s.departure ?? s.plannedArrival ?? s.plannedDeparture), delayMin: minOf(s.arrivalDelay ?? s.departureDelay) })),
            walkM: foot && l.distance != null ? Math.round(l.distance) : undefined,
          };
        },
      );
      if (!legs.length) return null;
      return { dep: legs[0].dep, arr: legs[legs.length - 1].arr, transfers: Math.max(0, legs.filter((l) => l.mode !== 'WALK').length - 1), legs };
    })
    .filter((j): j is Itinerary => !!j);
}

export function parseDbDepartures(list: DbDeparture[]): Departure[] {
  return list
    .map((d) => ({
      mode: modeOf(d.line),
      line: (d.line?.name ?? '').trim(),
      headsign: (d.direction ?? '').trim(),
      track: d.platform ?? d.plannedPlatform ?? undefined,
      time: ms(d.when ?? d.plannedWhen),
      delayMin: minOf(d.delay),
      cancelled: !!d.cancelled,
    }))
    .filter((d) => Number.isFinite(d.time));
}

// ---- requests --------------------------------------------------------------

export async function dbSearchStops(text: string): Promise<Stop[]> {
  const q = new URLSearchParams({ query: text, results: '8', stops: 'true', addresses: 'false', poi: 'false', language: 'de' });
  return parseDbStops(await fetchJson<DbStop[]>(`${BASE}/locations?${q}`, undefined, 12000));
}

export async function dbNearbyStops(lat: number, lon: number): Promise<Stop[]> {
  const q = new URLSearchParams({ latitude: lat.toFixed(5), longitude: lon.toFixed(5), results: '8', distance: '2000', stops: 'true', poi: 'false', language: 'de' });
  return parseDbStops(await fetchJson<DbStop[]>(`${BASE}/locations/nearby?${q}`, undefined, 12000));
}

/** `cursor` is a previous result's prev/next (earlierRef / laterRef) */
export async function dbPlan(from: Stop, to: Stop, o: PlanOptions, cursor?: string): Promise<PlanResult> {
  const q = new URLSearchParams({ from: from.id, to: to.id, results: '6', stopovers: 'true', language: 'de', polylines: 'false', remarks: 'false' });
  q.set(o.arriveBy ? 'arrival' : 'departure', new Date(o.time).toISOString());
  if (o.maxTransfers != null) q.set('transfers', String(o.maxTransfers));
  if (o.extraTransferMin) q.set('transferTime', String(o.extraTransferMin));
  if (o.wheelchair) q.set('accessibility', 'complete');
  if (o.modes?.length) {
    const on = new Set(o.modes.map((m) => MODE_PRODUCT[m]).filter(Boolean));
    for (const p of new Set(Object.values(MODE_PRODUCT))) q.set(p, String(on.has(p)));
  }
  if (cursor) q.set(cursor.startsWith('e:') ? 'earlierThan' : 'laterThan', cursor.slice(2));
  const r = await fetchJson<{ journeys?: DbJourney[]; earlierRef?: string; laterRef?: string }>(`${BASE}/journeys?${q}`, undefined, 30000);
  return { list: parseDbJourneys(r.journeys ?? []), prev: r.earlierRef ? `e:${r.earlierRef}` : undefined, next: r.laterRef ? `l:${r.laterRef}` : undefined };
}

export async function dbDepartures(stopId: string, n: number, from: number): Promise<Departure[]> {
  const q = new URLSearchParams({ when: new Date(from).toISOString(), results: String(n), duration: '180', language: 'de', remarks: 'false' });
  const r = await fetchJson<{ departures?: DbDeparture[] }>(`${BASE}/stops/${encodeURIComponent(stopId)}/departures?${q}`, undefined, 15000);
  return parseDbDepartures(r.departures ?? []);
}
