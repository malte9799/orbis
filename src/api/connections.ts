import { fetchJson } from '../util';
import { modeStyle } from './transit';
import { dbDepartures, dbNearbyStops, dbPlan, dbSearchStops } from './dbrest';

// Connection search and departure boards. Two sources, both without key:
// • DB data (dbrest.ts, real-time delays like the DB Navigator) – tried first
// • Transitous (community-run MOTIS, v5 API; Europe and beyond) – fallback and for stops DB does not know:
//   /api/v1/geocode stop search, /api/v5/plan connections A → B, /api/v5/stoptimes departures at one stop

const BASE = 'https://api.transitous.org/api';

export interface Stop {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** city / area the stop lies in */
  area?: string;
  /** which source the id belongs to (default: Transitous) */
  src?: 'db' | 'motis';
}

export interface Leg {
  mode: string;
  /** line name, e.g. "ICE 1601" or "S 5"; empty on foot legs */
  line: string;
  headsign: string;
  from: string;
  to: string;
  track?: string;
  toTrack?: string;
  dep: number;
  arr: number;
  /** scheduled times (equal to dep/arr without real-time data) */
  schedDep: number;
  schedArr: number;
  /** minutes later than scheduled, null without real-time data */
  delayMin: number | null;
  arrDelayMin: number | null;
  cancelled: boolean;
  /** stops between start and end */
  via: { name: string; time: number; delayMin: number | null }[];
  /** walking distance in meters, foot legs only */
  walkM?: number;
}

/** where timetable data came from: DB (real-time delays like the DB Navigator) or Transitous */
export type Source = 'db' | 'motis';

export interface Itinerary {
  dep: number;
  arr: number;
  transfers: number;
  legs: Leg[];
  src?: Source;
}

export interface Departure {
  mode: string;
  line: string;
  headsign: string;
  track?: string;
  /** actual (real-time) departure */
  time: number;
  delayMin: number | null;
  cancelled: boolean;
  src?: Source;
}

// ---- wire format (only the fields used here) -------------------------------

interface PlaceDto {
  name?: string;
  departure?: string;
  scheduledDeparture?: string;
  arrival?: string;
  scheduledArrival?: string;
  track?: string;
  scheduledTrack?: string;
  cancelled?: boolean;
}

interface LegDto {
  mode: string;
  from: PlaceDto;
  to: PlaceDto;
  startTime: string;
  endTime: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  realTime?: boolean;
  headsign?: string;
  routeShortName?: string;
  displayName?: string;
  cancelled?: boolean;
  distance?: number;
  intermediateStops?: PlaceDto[];
}

interface ItineraryDto {
  startTime: string;
  endTime: string;
  transfers: number;
  legs: LegDto[];
}

interface StopTimeDto {
  place: PlaceDto;
  mode: string;
  realTime?: boolean;
  headsign?: string;
  routeShortName?: string;
  displayName?: string;
  cancelled?: boolean;
}

interface GeocodeDto {
  type: string;
  id: string;
  name: string;
  lat: number;
  lon: number;
  areas?: { name: string; default?: boolean; adminLevel?: number }[];
}

// ---- parsing ---------------------------------------------------------------

const ms = (iso?: string) => (iso ? Date.parse(iso) : NaN);
const delayOf = (actual?: string, scheduled?: string, realTime?: boolean): number | null => {
  if (!realTime) return null;
  const a = ms(actual);
  const s = ms(scheduled);
  return Number.isFinite(a) && Number.isFinite(s) ? Math.round((a - s) / 60000) : null;
};

export function parseStops(list: GeocodeDto[]): Stop[] {
  return list
    .filter((m) => m.type === 'STOP')
    .map((m) => {
      const areas = m.areas ?? [];
      const area = (areas.find((a) => a.default) ?? areas.filter((a) => a.adminLevel != null).sort((a, b) => (b.adminLevel ?? 0) - (a.adminLevel ?? 0))[0])?.name;
      return { id: m.id, name: m.name, lat: m.lat, lon: m.lon, area, src: 'motis' as const };
    });
}

export function parseItineraries(list: ItineraryDto[]): Itinerary[] {
  return list.map((it) => ({
    src: 'motis' as const,
    dep: ms(it.startTime),
    arr: ms(it.endTime),
    transfers: it.transfers,
    legs: it.legs.map((l): Leg => {
      const foot = l.mode === 'WALK' || l.mode === 'BIKE' || l.mode === 'CAR' || l.mode === 'RENTAL';
      return {
        mode: l.mode,
        line: foot ? '' : (l.displayName ?? l.routeShortName ?? '').trim(),
        headsign: (l.headsign ?? '').trim(),
        from: l.from.name ?? '',
        to: l.to.name ?? '',
        track: l.from.track ?? l.from.scheduledTrack,
        toTrack: l.to.track ?? l.to.scheduledTrack,
        dep: ms(l.startTime),
        arr: ms(l.endTime),
        schedDep: ms(l.scheduledStartTime ?? l.from.scheduledDeparture ?? l.startTime),
        schedArr: ms(l.scheduledEndTime ?? l.to.scheduledArrival ?? l.endTime),
        delayMin: delayOf(l.startTime, l.scheduledStartTime ?? l.from.scheduledDeparture, l.realTime),
        arrDelayMin: delayOf(l.endTime, l.scheduledEndTime ?? l.to.scheduledArrival, l.realTime),
        cancelled: !!l.cancelled,
        via: (l.intermediateStops ?? [])
          .filter((s) => s.name)
          .map((s) => ({ name: s.name!, time: ms(s.arrival ?? s.departure), delayMin: delayOf(s.arrival ?? s.departure, s.scheduledArrival ?? s.scheduledDeparture, l.realTime) })),
        walkM: foot && l.distance != null ? Math.round(l.distance) : undefined,
      };
    }),
  }));
}

export function parseDepartures(list: StopTimeDto[]): Departure[] {
  return list
    .map((s) => ({
      src: 'motis' as const,
      mode: s.mode,
      line: (s.displayName ?? s.routeShortName ?? '').trim(),
      headsign: (s.headsign ?? '').trim(),
      track: s.place.track ?? s.place.scheduledTrack,
      time: ms(s.place.departure ?? s.place.arrival),
      delayMin: delayOf(s.place.departure ?? s.place.arrival, s.place.scheduledDeparture ?? s.place.scheduledArrival, s.realTime),
      cancelled: !!s.cancelled || !!s.place.cancelled,
    }))
    .filter((d) => Number.isFinite(d.time));
}

// ---- requests --------------------------------------------------------------

async function motisSearchStops(text: string): Promise<Stop[]> {
  const q = new URLSearchParams({ text, type: 'STOP', language: 'de' });
  return parseStops(await fetchJson<GeocodeDto[]>(`${BASE}/v1/geocode?${q}`));
}

/** Stops around a position, nearest first. */
async function motisNearbyStops(lat: number, lon: number): Promise<Stop[]> {
  const q = new URLSearchParams({ place: `${lat.toFixed(5)},${lon.toFixed(5)}`, type: 'STOP', language: 'de' });
  return parseStops(await fetchJson<GeocodeDto[]>(`${BASE}/v1/reverse-geocode?${q}`));
}

export interface PlanOptions {
  /** departure time, or arrival time with arriveBy */
  time: number;
  arriveBy: boolean;
  /** upper bound on transfers, undefined = no limit */
  maxTransfers?: number;
  /** allowed transit modes (MOTIS names), undefined = all */
  modes?: string[];
  /** extra minutes planned for every transfer */
  extraTransferMin?: number;
  /** longest walk to the first / from the last stop in minutes */
  maxWalkMin?: number;
  /** step-free routing */
  wheelchair?: boolean;
}

/** Mode groups of the filter; the MOTIS modes each one stands for. */
export const MODE_GROUPS: { id: string; label: string; modes: string[] }[] = [
  { id: 'fern', label: 'Fernverkehr', modes: ['HIGHSPEED_RAIL', 'LONG_DISTANCE', 'NIGHT_RAIL'] },
  { id: 'regio', label: 'Regionalverkehr', modes: ['REGIONAL_FAST_RAIL', 'REGIONAL_RAIL'] },
  { id: 'sbahn', label: 'S-Bahn', modes: ['SUBURBAN'] },
  { id: 'ubahn', label: 'U-Bahn', modes: ['SUBWAY'] },
  { id: 'tram', label: 'Straßenbahn', modes: ['TRAM'] },
  { id: 'bus', label: 'Bus', modes: ['BUS'] },
  { id: 'fernbus', label: 'Fernbus', modes: ['COACH'] },
  { id: 'faehre', label: 'Fähre', modes: ['FERRY'] },
];

export interface PlanResult {
  list: Itinerary[];
  /** cursors for the earlier / later connections */
  prev?: string;
  next?: string;
}

/** Connections from → to; with `cursor` (a previous result's prev/next) the page before / after it. */
async function motisPlan(from: Stop, to: Stop, o: PlanOptions, cursor?: string): Promise<PlanResult> {
  // ids of the other source are not known here: use the position
  const place = (s: Stop) => (s.src === 'db' ? `${s.lat},${s.lon}` : s.id);
  const q = new URLSearchParams({
    fromPlace: place(from),
    toPlace: place(to),
    time: new Date(o.time).toISOString(),
    arriveBy: String(o.arriveBy),
    numItineraries: '6',
    language: 'de',
  });
  if (o.maxTransfers != null) q.set('maxTransfers', String(o.maxTransfers));
  if (o.modes && o.modes.length) q.set('transitModes', o.modes.join(','));
  if (o.extraTransferMin) q.set('additionalTransferTime', String(o.extraTransferMin));
  if (o.maxWalkMin != null) {
    q.set('maxPreTransitTime', String(o.maxWalkMin * 60));
    q.set('maxPostTransitTime', String(o.maxWalkMin * 60));
  }
  if (o.wheelchair) q.set('pedestrianProfile', 'WHEELCHAIR');
  if (cursor) q.set('pageCursor', cursor);
  const r = await fetchJson<{ itineraries?: ItineraryDto[]; previousPageCursor?: string; nextPageCursor?: string }>(`${BASE}/v5/plan?${q}`, undefined, 30000);
  return { list: parseItineraries(r.itineraries ?? []), prev: r.previousPageCursor, next: r.nextPageCursor };
}

/** The next `n` departures at a stop, starting at `from` (default: now). */
async function motisDepartures(stopId: string, n: number, from: number): Promise<Departure[]> {
  const q = new URLSearchParams({ stopId, n: String(n), time: new Date(from).toISOString(), language: 'de' });
  const r = await fetchJson<{ stopTimes?: StopTimeDto[] }>(`${BASE}/v5/stoptimes?${q}`, undefined, 20000);
  return parseDepartures(r.stopTimes ?? []);
}

// ---- public API: DB first, Transitous as fallback --------------------------

/** Stop search: DB stops (Germany, real-time delays); Transitous when DB finds nothing or fails. */
export async function searchStops(text: string): Promise<Stop[]> {
  try {
    const r = await dbSearchStops(text);
    if (r.length) return r;
  } catch {
    /* DB service down or throttled */
  }
  return motisSearchStops(text);
}

export async function nearbyStops(lat: number, lon: number): Promise<Stop[]> {
  try {
    const r = await dbNearbyStops(lat, lon);
    if (r.length) return r;
  } catch {
    /* fall through */
  }
  return motisNearbyStops(lat, lon);
}

const upgraded = new Map<string, Stop>();
const km = (a: Stop, b: Stop) => Math.hypot((a.lon - b.lon) * Math.cos((a.lat * Math.PI) / 180), a.lat - b.lat) * 111.3;

/**
 * Stops saved before the DB source existed carry no source and would keep using Transitous (no real-time
 * delays for many trains): look them up at DB by name and position. Falls back to Transitous when DB does
 * not know the stop or is unreachable (that is not remembered, the next call tries again).
 */
export async function ensureSource<T extends Stop>(s: T): Promise<T> {
  if (s.src) return s;
  const hit = upgraded.get(s.id);
  if (hit) return { ...s, id: hit.id, src: hit.src };
  try {
    const best = (await dbSearchStops(s.name))
      .map((x) => ({ x, d: km(x, s) }))
      .filter((c) => c.d < 1.5)
      .sort((a, b) => a.d - b.d)[0];
    const r: Stop = best ? { ...s, id: best.x.id, src: 'db' } : { ...s, src: 'motis' };
    upgraded.set(s.id, r);
    return { ...s, id: r.id, src: r.src };
  } catch {
    return { ...s, src: 'motis' };
  }
}

const prefixed = (src: string, c?: string) => (c ? `${src}|${c}` : undefined);

/** A cursor continues with the source it came from; a fresh search tries DB first for two DB stops. */
export async function planConnections(fromStop: Stop, toStop: Stop, o: PlanOptions, cursor?: string): Promise<PlanResult> {
  const [from, to] = await Promise.all([ensureSource(fromStop), ensureSource(toStop)]);
  const [src, raw] = cursor ? [cursor.slice(0, cursor.indexOf('|')), cursor.slice(cursor.indexOf('|') + 1)] : ['', undefined];
  const useDb = cursor ? src === 'db' : from.src === 'db' && to.src === 'db';
  if (useDb) {
    try {
      const r = await dbPlan(from, to, o, raw);
      if (r.list.length || cursor) return { list: r.list, prev: prefixed('db', r.prev), next: prefixed('db', r.next) };
    } catch (e) {
      if (cursor) throw e;
    }
  }
  const r = await motisPlan(from, to, o, cursor ? raw : undefined);
  return { list: r.list, prev: prefixed('motis', r.prev), next: prefixed('motis', r.next) };
}

/** A connection without its real-time information: planned times only (used while better data is still loading). */
export function plain(it: Itinerary): Itinerary {
  return {
    ...it,
    dep: it.legs[0]?.schedDep ?? it.dep,
    arr: it.legs[it.legs.length - 1]?.schedArr ?? it.arr,
    legs: it.legs.map((l) => ({ ...l, dep: l.schedDep, arr: l.schedArr, delayMin: null, arrDelayMin: null, via: l.via.map((v) => ({ ...v, delayMin: null })) })),
  };
}

/** Same ride in the DB and the Transitous answer: first ride and its planned times. */
export const stableKey = (it: Itinerary): string => {
  const ride = it.legs.find((l) => l.mode !== 'WALK') ?? it.legs[0];
  return `${ride?.line ?? ''}|${ride ? Math.round(ride.schedDep / 60000) : ''}`;
};

/**
 * Fresh search that does not make the user wait for the slow DB service: for two DB stops both sources are asked
 * at once. When Transitous answers first, `onPartial` gets its connections (planned times, no delays) right away and
 * the returned promise resolves with the DB result later (or with Transitous when DB has nothing).
 */
export async function planProgressive(fromStop: Stop, toStop: Stop, o: PlanOptions, onPartial: (r: PlanResult) => void): Promise<PlanResult> {
  const [from, to] = await Promise.all([ensureSource(fromStop), ensureSource(toStop)]);
  if (from.src !== 'db' || to.src !== 'db') return planConnections(from, to, o);
  const dbP = dbPlan(from, to, o)
    .then((r): PlanResult | null => (r.list.length ? { list: r.list, prev: prefixed('db', r.prev), next: prefixed('db', r.next) } : null))
    .catch(() => null);
  const moP = motisPlan(from, to, o)
    .then((r): PlanResult | null => (r.list.length ? { list: r.list, prev: prefixed('motis', r.prev), next: prefixed('motis', r.next) } : null))
    .catch(() => null);
  const [first, r1] = await Promise.race([dbP.then((r) => ['db', r] as const), moP.then((r) => ['motis', r] as const)]);
  if (first === 'db' && r1) return r1;
  if (first === 'motis' && r1) {
    onPartial({ ...r1, list: r1.list.map(plain), prev: undefined, next: undefined });
    return (await dbP) ?? r1;
  }
  // the quicker one had nothing: the other one decides
  const other = await (first === 'db' ? moP : dbP);
  if (other) return other;
  return { list: [] };
}

/** The next `n` departures at a stop, starting at `from` (default: now). */
export async function departures(given: Pick<Stop, 'id' | 'name' | 'lat' | 'lon' | 'src'>, n = 25, from = Date.now()): Promise<Departure[]> {
  const stop = await ensureSource(given);
  if (stop.src === 'db') {
    try {
      const r = await dbDepartures(stop.id, n, from);
      if (r.length) return r;
    } catch {
      /* fall back to Transitous with the nearest stop of its own */
    }
    const near = (await motisNearbyStops(stop.lat, stop.lon))[0];
    return near ? motisDepartures(near.id, n, from) : [];
  }
  return motisDepartures(stop.id, n, from);
}

/** short note under results: which source answered */
export const sourceTxt = (src?: Source) => (src === 'db' ? 'Quelle: DB (Echtzeit)' : src === 'motis' ? 'Quelle: Transitous – für manche Züge ohne Echtzeit-Verspätungen' : '');

// ---- helpers for the view --------------------------------------------------

/** "23 min" / "1 h 05 min" */
export function durationTxt(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}

/** "in 5 min", "jetzt" – for the departure board */
export function inTxt(t: number, now = Date.now()): string {
  const m = Math.round((t - now) / 60000);
  return m <= 0 ? 'jetzt' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
}

export const legColor = (l: { mode: string }) => (l.mode === 'WALK' ? '#8a93a8' : modeStyle(l.mode).color);
