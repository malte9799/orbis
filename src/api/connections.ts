import { fetchJson } from '../util';
import { fmtLocale } from '../i18n';
import { modeStyle } from './transit';

// Connection search and departure boards – Transitous (community-run MOTIS, v5 API, no key needed):
// /api/v1/geocode stop search, /api/v5/plan connections A → B, /api/v5/stoptimes departures at one stop.
// Real-time delays of rail come from the DB timetable data through our worker (dbdelays.ts) and are merged in later.

const BASE = 'https://api.transitous.org/api';

/** Transitous/MOTIS language code (two-letter) for stop names, leg texts and the like */
const apiLang = () => (fmtLocale().startsWith('de') ? 'de' : 'en');

export interface Stop {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** city / area the stop lies in */
  area?: string;
  /** older saved stops may carry the id of a DB source that is not used any more (see toMotis) */
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
  /** the platform differs from the planned one (a platform change) */
  trackChanged?: boolean;
  toTrackChanged?: boolean;
  /** operator and booking requirement (on-demand buses: "COMPULSORY" = has to be booked) */
  agency?: string;
  reservation?: string;
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
  /** set when the delays of this leg come from the DB timetable data (otherwise from Transitous) */
  delaySrc?: DelaySource;
  /** walking distance in meters, foot legs only */
  walkM?: number;
}

/** where the real-time delays of a connection come from: DB timetable data (merged in later) or Transitous itself */
export type DelaySource = 'db';

export interface Itinerary {
  dep: number;
  arr: number;
  transfers: number;
  legs: Leg[];
  /** set when DB real-time data was merged in */
  delaySrc?: DelaySource;
}

export interface Departure {
  mode: string;
  line: string;
  headsign: string;
  track?: string;
  trackChanged?: boolean;
  /** actual (real-time) departure */
  time: number;
  delayMin: number | null;
  cancelled: boolean;
  /** planned departure */
  sched: number;
  delaySrc?: DelaySource;
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
  agencyName?: string;
  reservation?: string;
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
      return { id: m.id, name: m.name, lat: m.lat, lon: m.lon, area };
    });
}

export function parseItineraries(list: ItineraryDto[]): Itinerary[] {
  return list.map((it) => ({
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
        agency: l.agencyName,
        reservation: l.reservation,
        trackChanged: changedTrack(l.from),
        toTrackChanged: changedTrack(l.to),
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

/** Transitous gives the current and the planned platform: they differ on a platform change */
const changedTrack = (p: { track?: string; scheduledTrack?: string }) => !!p.track && !!p.scheduledTrack && p.track !== p.scheduledTrack;

export function parseDepartures(list: StopTimeDto[]): Departure[] {
  return list
    .map((s) => ({
      mode: s.mode,
      line: (s.displayName ?? s.routeShortName ?? '').trim(),
      headsign: (s.headsign ?? '').trim(),
      track: s.place.track ?? s.place.scheduledTrack,
      trackChanged: changedTrack(s.place),
      time: ms(s.place.departure ?? s.place.arrival),
      sched: ms(s.place.scheduledDeparture ?? s.place.scheduledArrival ?? s.place.departure ?? s.place.arrival),
      delayMin: delayOf(s.place.departure ?? s.place.arrival, s.place.scheduledDeparture ?? s.place.scheduledArrival, s.realTime),
      cancelled: !!s.cancelled || !!s.place.cancelled,
    }))
    .filter((d) => Number.isFinite(d.time));
}

// ---- requests --------------------------------------------------------------

export async function searchStops(text: string): Promise<Stop[]> {
  const q = new URLSearchParams({ text, type: 'STOP', language: apiLang() });
  return parseStops(await fetchJson<GeocodeDto[]>(`${BASE}/v1/geocode?${q}`, undefined, 12000));
}

/** Stops around a position, nearest first. */
export async function nearbyStops(lat: number, lon: number): Promise<Stop[]> {
  const q = new URLSearchParams({ place: `${lat.toFixed(5)},${lon.toFixed(5)}`, type: 'STOP', language: apiLang() });
  return parseStops(await fetchJson<GeocodeDto[]>(`${BASE}/v1/reverse-geocode?${q}`, undefined, 12000));
}

const km = (a: Stop, b: Stop) => Math.hypot((a.lon - b.lon) * Math.cos((a.lat * Math.PI) / 180), a.lat - b.lat) * 111.3;
const moved = new Map<string, Promise<Stop>>();

/**
 * Stops saved while a DB source was in use carry its id, which Transitous does not know: look them up by
 * name and position. Everything else is returned as it is.
 */
export function toMotis<T extends Stop>(s: T): Promise<T> {
  if (s.src !== 'db') return Promise.resolve(s);
  let p = moved.get(s.id);
  if (!p) {
    p = searchStops(s.name)
      .then((list) => list.map((x) => ({ x, d: km(x, s) })).filter((c) => c.d < 1.5).sort((a, b) => a.d - b.d)[0])
      .then((best): Stop => ({ ...s, id: best ? best.x.id : s.id, src: best ? 'motis' : 'db' }));
    moved.set(s.id, p);
    p.catch(() => moved.delete(s.id));
  }
  return p.then((r) => ({ ...s, id: r.id, src: r.src }));
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
  { id: 'bus', label: 'Bus', modes: ['BUS', 'ODM', 'FLEX'] },
  { id: 'fernbus', label: 'Fernbus', modes: ['COACH'] },
  { id: 'faehre', label: 'Fähre', modes: ['FERRY'] },
];

export interface PlanResult {
  list: Itinerary[];
  /** cursors for the earlier / later connections */
  prev?: string;
  next?: string;
  /** how long the answering source took (ms) */
  ms?: number;
}

/** Connections from → to; with `cursor` (a previous result's prev/next) the page before / after it. */
export async function planConnections(fromStop: Stop, toStop: Stop, o: PlanOptions, cursor?: string): Promise<PlanResult> {
  const [from, to] = await Promise.all([toMotis(fromStop), toMotis(toStop)]);
  const place = (s: Stop) => (s.src === 'db' ? `${s.lat},${s.lon}` : s.id);
  const q = new URLSearchParams({
    fromPlace: place(from),
    toPlace: place(to),
    time: new Date(o.time).toISOString(),
    arriveBy: String(o.arriveBy),
    numItineraries: '6',
    language: apiLang(),
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
  const t0 = performance.now();
  const r = await fetchJson<{ itineraries?: ItineraryDto[]; previousPageCursor?: string; nextPageCursor?: string }>(`${BASE}/v5/plan?${q}`, undefined, 30000);
  return { list: parseItineraries(r.itineraries ?? []), prev: r.previousPageCursor, next: r.nextPageCursor, ms: Math.round(performance.now() - t0) };
}

/** The next `n` departures at a stop, starting at `from` (default: now). */
export async function departures(given: Pick<Stop, 'id' | 'name' | 'lat' | 'lon' | 'src'>, n = 25, from = Date.now()): Promise<Departure[]> {
  const stop = await toMotis(given as Stop);
  const q = new URLSearchParams({ stopId: stop.id, n: String(n), time: new Date(from).toISOString(), language: apiLang() });
  const r = await fetchJson<{ stopTimes?: StopTimeDto[] }>(`${BASE}/v5/stoptimes?${q}`, undefined, 20000);
  return parseDepartures(r.stopTimes ?? []);
}

/** Same ride before and after real-time data was merged in: first ride and its planned time. */
export const stableKey = (it: Itinerary): string => {
  const ride = it.legs.find((l) => l.mode !== 'WALK') ?? it.legs[0];
  return `${ride?.line ?? ''}|${ride ? Math.round(ride.schedDep / 60000) : ''}`;
};

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

/** short note under results: where the times come from (`delaySrc` db: rail delays from the DB timetable data) */
export const sourceTxt = (delaySrc?: DelaySource, ms?: number) => {
  const t = ms != null ? ` · ${(ms / 1000).toFixed(1).replace('.', ',')} s` : '';
  return delaySrc === 'db' ? `Fahrplan: Transitous · Verspätungen Bahn: DB (Echtzeit)${t}` : `Fahrplan: Transitous – Verspätungen nur, wenn der Betreiber sie meldet${t}`;
};
