import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import { fetchJson, fetchJsonEtag, pruneEtagCache } from '../util';
import { viaProxy } from './proxy';

// Public transport and rail – live positions.
// • Transitous (community-run MOTIS, timetables + realtime for Germany and many other countries):
//   trip segments with stop-to-stop polylines; current positions are interpolated from the
//   (real-time) departure and arrival times, exactly like transitous.org does.
// • Amtraker: GPS positions of Amtrak trains (USA).
// Germany-specific: Autobahn traffic reports and NINA public warnings.

export interface Bounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

// ---------------------------------------------------------------------------
// Transitous

export type TransitMode =
  | 'HIGHSPEED_RAIL'
  | 'LONG_DISTANCE'
  | 'NIGHT_RAIL'
  | 'REGIONAL_FAST_RAIL'
  | 'REGIONAL_RAIL'
  | 'RAIL'
  | 'SUBURBAN'
  | 'SUBWAY'
  | 'METRO'
  | 'TRAM'
  | 'BUS'
  | 'COACH'
  | 'FERRY'
  | string;

export const RAIL_MODES = new Set(['HIGHSPEED_RAIL', 'LONG_DISTANCE', 'NIGHT_RAIL', 'REGIONAL_FAST_RAIL', 'REGIONAL_RAIL', 'RAIL', 'SUBURBAN']);

export const MODE_STYLE: Record<string, { label: string; color: string }> = {
  HIGHSPEED_RAIL: { label: 'Hochgeschwindigkeitszug', color: '#ef5350' },
  LONG_DISTANCE: { label: 'Fernzug', color: '#ff7043' },
  NIGHT_RAIL: { label: 'Nachtzug', color: '#7e57c2' },
  REGIONAL_FAST_RAIL: { label: 'Regionalexpress', color: '#66bb6a' },
  REGIONAL_RAIL: { label: 'Regionalzug', color: '#9ccc65' },
  RAIL: { label: 'Zug', color: '#9ccc65' },
  SUBURBAN: { label: 'S-Bahn', color: '#26a69a' },
  SUBWAY: { label: 'U-Bahn', color: '#42a5f5' },
  METRO: { label: 'Metro', color: '#42a5f5' },
  TRAM: { label: 'Straßenbahn', color: '#ec407a' },
  BUS: { label: 'Bus', color: '#ab47bc' },
  COACH: { label: 'Fernbus', color: '#8d6e63' },
  FERRY: { label: 'Fähre', color: '#29b6f6' },
};
export const modeStyle = (m: string) => MODE_STYLE[m] ?? { label: 'ÖPNV', color: '#bdbdbd' };

export interface Segment {
  id: string;
  name: string;
  mode: TransitMode;
  from: string;
  to: string;
  dep: number;
  arr: number;
  delayMin: number | null;
  realTime: boolean;
  coords: [number, number][];
  /** cumulative length along coords (degrees, cos-corrected) */
  cum: number[];
}

/** Google encoded polyline → [lon, lat][] */
export function decodePolyline(str: string, precision = 5): [number, number][] {
  const f = 10 ** precision;
  const out: [number, number][] = [];
  let i = 0;
  let lat = 0;
  let lon = 0;
  while (i < str.length) {
    for (const which of [0, 1]) {
      let shift = 0;
      let result = 0;
      let b: number;
      do {
        b = str.charCodeAt(i++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20 && i < str.length);
      const d = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 0) lat += d;
      else lon += d;
    }
    out.push([lon / f, lat / f]);
  }
  return out;
}

interface TripSegmentDto {
  trips: { tripId: string; displayName?: string; routeShortName?: string }[];
  mode: string;
  from: { name: string };
  to: { name: string };
  departure: string;
  arrival: string;
  scheduledDeparture: string;
  realTime: boolean;
  polyline: string;
}

/**
 * Trip segments running inside the bounds during [start, end]. The server thins out minor
 * modes by zoom level by itself.
 */
export async function loadSegments(b: Bounds, zoom: number, start: number, end: number): Promise<Segment[]> {
  const q = new URLSearchParams({
    min: `${b.south.toFixed(4)},${b.east.toFixed(4)}`,
    max: `${b.north.toFixed(4)},${b.west.toFixed(4)}`,
    startTime: new Date(start).toISOString(),
    endTime: new Date(end).toISOString(),
    zoom: String(Math.round(zoom)),
    precision: '5',
  });
  const list = await fetchJson<TripSegmentDto[]>(`https://api.transitous.org/api/v5/map/trips?${q}`, undefined, 25000);
  const out: Segment[] = [];
  for (const s of list) {
    const coords = decodePolyline(s.polyline, 5);
    if (coords.length < 2) continue;
    const cum = [0];
    for (let k = 1; k < coords.length; k++) {
      const [x0, y0] = coords[k - 1];
      const [x1, y1] = coords[k];
      const c = Math.cos((y0 * Math.PI) / 180);
      cum.push(cum[k - 1] + Math.hypot((x1 - x0) * c, y1 - y0));
    }
    const t = s.trips[0];
    const dep = Date.parse(s.departure);
    out.push({
      id: t?.tripId ?? `${s.from.name}-${s.departure}`,
      name: (t?.displayName ?? t?.routeShortName ?? '').trim(),
      mode: s.mode,
      from: s.from.name,
      to: s.to.name,
      dep,
      arr: Date.parse(s.arrival),
      delayMin: s.realTime ? Math.round((dep - Date.parse(s.scheduledDeparture)) / 60000) : null,
      realTime: s.realTime,
      coords,
      cum,
    });
  }
  return out;
}

/** Interpolated vehicle positions at time t (one per trip). */
export function positionsAt(segs: Segment[], t: number, filter: (mode: string) => boolean): FeatureCollection<Point> {
  const seen = new Set<string>();
  const features: Feature<Point>[] = [];
  for (const s of segs) {
    if (t < s.dep || t > s.arr || seen.has(s.id) || !filter(s.mode)) continue;
    seen.add(s.id);
    const frac = s.arr > s.dep ? (t - s.dep) / (s.arr - s.dep) : 0;
    const target = frac * s.cum[s.cum.length - 1];
    let k = 1;
    while (k < s.cum.length - 1 && s.cum[k] < target) k++;
    const seg = s.cum[k] - s.cum[k - 1] || 1;
    const f = Math.min(1, Math.max(0, (target - s.cum[k - 1]) / seg));
    const [x0, y0] = s.coords[k - 1];
    const [x1, y1] = s.coords[k];
    const bearing = (Math.atan2((x1 - x0) * Math.cos((y0 * Math.PI) / 180), y1 - y0) * 180) / Math.PI;
    const st = modeStyle(s.mode);
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [x0 + (x1 - x0) * f, y0 + (y1 - y0) * f] },
      properties: {
        src: 'transitous',
        id: s.id,
        name: s.name || st.label,
        mode: s.mode,
        color: st.color,
        rail: RAIL_MODES.has(s.mode),
        from: s.from,
        to: s.to,
        dep: s.dep,
        arr: s.arr,
        delay: s.delayMin ?? -999,
        realTime: s.realTime,
        bearing,
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

// ---------------------------------------------------------------------------
// Amtrak (USA) – GPS via Amtraker

const COMPASS: Record<string, number> = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };

export async function loadAmtrak(): Promise<Feature<Point>[]> {
  const json = await fetchJson<Record<string, { routeName: string; trainNum: string | number; lat: number; lon: number; heading?: string; velocity?: number; origName?: string; destName?: string; trainState?: string; trainTimely?: string }[]>>(
    'https://api-v3.amtraker.com/v3/trains',
    undefined,
    20000,
  );
  const out: Feature<Point>[] = [];
  for (const list of Object.values(json)) {
    for (const t of list) {
      if (t.lat == null || t.lon == null || (t.trainState && t.trainState !== 'Active')) continue;
      out.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [t.lon, t.lat] },
        properties: {
          src: 'amtrak',
          name: `${t.routeName} ${t.trainNum}`,
          mode: 'LONG_DISTANCE',
          color: '#1e88e5',
          rail: true,
          from: t.origName ?? '',
          to: t.destName ?? '',
          speed: t.velocity != null ? Math.round(t.velocity * 1.609) : null,
          timely: t.trainTimely ?? '',
          bearing: COMPASS[t.heading ?? ''] ?? 0,
        },
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Autobahn GmbH: traffic reports, closures and roadworks on German motorways (keyless).
//
// The API has no spatial query (no bbox/area filter): report locations are only known
// after each road's full answer arrives, so every road × kind must be fetched at least
// once. To keep that bearable the answers are cached in the browser (Cache Storage,
// across page loads) and revalidated via the API's ETag support: unchanged roads reply
// with an empty 304, so only roads with actual changes transfer data again. Reports
// also surface progressively via the `onProgress` callback as roads finish loading.

export type AutobahnKind = 'warning' | 'closure' | 'roadworks';

const AB = 'https://verkehr.autobahn.de/o/autobahn';
const AB_CACHE = 'autobahn-reports-v1';

export interface AutobahnProgress {
  points: Feature<Point>[];
  lines: Feature<LineString>[];
}

interface AbItem {
  identifier: string;
  title?: string;
  subtitle?: string;
  description?: string[];
  coordinate?: { lat: string | number; long: string | number };
  geometry?: { type: string; coordinates: number[][] };
  startTimestamp?: string;
  delayTimeValue?: string;
  abnormalTrafficType?: string;
  averageSpeed?: string;
  isBlocked?: string | boolean;
}

async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const out: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        try {
          out[i] = { status: 'fulfilled', value: await fn(items[i]) };
        } catch (e) {
          out[i] = { status: 'rejected', reason: e };
        }
      }
    }),
  );
  return out;
}

export async function loadAutobahn(onProgress?: (p: AutobahnProgress) => void): Promise<{ points: FeatureCollection<Point>; lines: FeatureCollection<LineString> }> {
  const { roads } = await fetchJsonEtag<{ roads: string[] }>(`${AB}/`, AB_CACHE);
  const names = [...new Set(roads.map((r) => r.trim()))];
  const kinds: AutobahnKind[] = ['warning', 'closure', 'roadworks'];
  const jobs: [string, AutobahnKind][] = names.flatMap((road) => kinds.map((kind) => [road, kind] as [string, AutobahnKind]));
  const points: Feature<Point>[] = [];
  const lines: Feature<LineString>[] = [];
  const seen = new Set<string>();
  let dirty = false;
  let flushAt = 0;
  /** Throttled: surface finished roads to the map while the sweep is still running. */
  const flush = (force = false) => {
    if (!onProgress || !dirty) return;
    const t = Date.now();
    if (!force && t < flushAt) return;
    flushAt = t + 500;
    dirty = false;
    onProgress({ points: [...points], lines: [...lines] });
  };
  const addItems = (road: string, kind: string, items: AbItem[]) => {
    for (const it of items) {
      if (seen.has(it.identifier)) continue;
      seen.add(it.identifier);
      const lat = Number(it.coordinate?.lat);
      const lon = Number(it.coordinate?.long);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const jam = kind === 'warning' && /stau|stockend|traffic/i.test(`${it.title} ${it.abnormalTrafficType ?? ''} ${(it.description ?? []).join(' ')}`);
      const sub = kind === 'roadworks' ? 'Baustelle' : kind === 'closure' ? 'Sperrung' : jam ? 'Stau' : 'Verkehrsmeldung';
      const color = kind === 'closure' ? '#d32f2f' : kind === 'roadworks' ? '#ffa000' : jam ? '#e53935' : '#fdd835';
      const props = {
        kind: jam ? 'jam' : kind,
        title: `${road}: ${(it.title ?? sub).replace(/^\s*A\d+\s*\|\s*/, '')}`,
        subtitle: [sub, it.subtitle, it.delayTimeValue ? `+${it.delayTimeValue} min` : '', it.averageSpeed ? `Ø ${it.averageSpeed} km/h` : ''].filter(Boolean).join(' · '),
        description: (it.description ?? []).filter(Boolean).join('\n'),
        date: it.startTimestamp ?? '',
        color,
        source: 'Autobahn GmbH des Bundes',
        url: 'https://www.autobahn.de/verkehrsmeldungen',
      };
      points.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: props });
      if (it.geometry?.type === 'LineString' && it.geometry.coordinates.length > 1 && kind !== 'roadworks') {
        lines.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: it.geometry.coordinates }, properties: props });
      }
      dirty = true;
    }
    flush();
  };
  const results = await pool(jobs, 12, ([road, kind]) => fetchJsonEtag<Record<string, AbItem[]>>(`${AB}/${encodeURIComponent(road)}/services/${kind}`, AB_CACHE).then((value) => addItems(road, kind, value[kind] ?? [])));
  if (results.every((r) => r.status === 'rejected')) throw (results[0] as PromiseRejectedResult).reason;
  flush(true);
  if (names.length) pruneEtagCache(AB_CACHE, [`${AB}/`, ...jobs.map(([road, kind]) => `${AB}/${encodeURIComponent(road)}/services/${kind}`)]);
  return { points: { type: 'FeatureCollection', features: points }, lines: { type: 'FeatureCollection', features: lines } };
}

// ---------------------------------------------------------------------------
// NINA – warnings of the German federal warning system (BBK): MoWaS, KATWARN, BIWAPP,
// flood portal (LHP) and police. DWD weather warnings have their own layer. The API sends
// no CORS headers, so requests go through the data proxy.

const NINA = 'https://warnung.bund.de/api31';
const NINA_SOURCES = ['mowas', 'katwarn', 'biwapp', 'lhp', 'police'];
const SEVERITY_COLOR: Record<string, string> = { Extreme: '#880e4f', Severe: '#e53935', Moderate: '#fb8c00', Minor: '#fdd835' };
const SOURCE_LABEL: Record<string, string> = { mowas: 'MoWaS', katwarn: 'KATWARN', biwapp: 'BIWAPP', lhp: 'Hochwasserportal', police: 'Polizei' };

export async function loadNina(): Promise<FeatureCollection> {
  const lists = await Promise.allSettled(
    NINA_SOURCES.map((src) =>
      fetchJson<{ id: string; severity?: string; startDate?: string; i18nTitle?: Record<string, string> }[]>(viaProxy(`${NINA}/${src}/mapData.json`), undefined, 20000).then((l) => l.map((w) => ({ ...w, src }))),
    ),
  );
  if (lists.every((l) => l.status === 'rejected')) throw (lists[0] as PromiseRejectedResult).reason;
  const all = lists.flatMap((l) => (l.status === 'fulfilled' ? l.value : []));
  const geo = await pool(all, 6, (w) => fetchJson<FeatureCollection>(viaProxy(`${NINA}/warnings/${encodeURIComponent(w.id)}.geojson`), undefined, 20000));
  const features: Feature[] = [];
  geo.forEach((g, i) => {
    if (g.status !== 'fulfilled') return;
    const w = all[i];
    for (const f of g.value.features ?? []) {
      if (!f.geometry) continue;
      features.push({
        type: 'Feature',
        geometry: f.geometry,
        properties: {
          id: w.id,
          title: w.i18nTitle?.de ?? w.i18nTitle?.en ?? 'Warnung',
          subtitle: `${SOURCE_LABEL[w.src] ?? w.src}${w.severity ? ` · ${{ Extreme: 'extrem', Severe: 'schwer', Moderate: 'mittel', Minor: 'gering' }[w.severity] ?? w.severity}` : ''}`,
          date: w.startDate ?? '',
          color: SEVERITY_COLOR[w.severity ?? ''] ?? '#fb8c00',
          source: `NINA / BBK (${SOURCE_LABEL[w.src] ?? w.src})`,
          url: `https://warnung.bund.de/meldungen/${encodeURIComponent(w.id)}`,
        },
      });
    }
  });
  return { type: 'FeatureCollection', features };
}

/** Full text of a NINA warning (for the popup). */
export async function loadNinaDetails(id: string): Promise<string> {
  const j = await fetchJson<{ info?: { description?: string; instruction?: string; headline?: string }[] }>(`${NINA}/warnings/${encodeURIComponent(id)}.json`, undefined, 15000);
  const info = j.info?.[0];
  return [info?.description, info?.instruction].filter(Boolean).join('\n\n').replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ').trim();
}
