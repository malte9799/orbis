import { store } from '../store';
import type { Feature, FeatureCollection, Geometry, LineString, Point, Polygon, MultiPolygon, Position } from 'geojson';
import { fetchJson } from '../util';
import { uTok } from '../units';
import { snapshotJson } from './data';

/** Kinds of natural events shown on the globe. */
export type EventKind =
  | 'fire'
  | 'storm'
  | 'tornado'
  | 'quake'
  | 'volcano'
  | 'flood'
  | 'drought'
  | 'ice'
  | 'dust'
  | 'landslide'
  | 'heat'
  | 'other';

export interface EventProps {
  kind: EventKind;
  title: string;
  subtitle?: string;
  date?: string;
  source: string;
  url?: string;
  /** colour used for icon background / polygons */
  color: string;
  /** 0..1 importance – drives icon size */
  weight: number;
  description?: string;
  mag?: number;
}

export type EventFeature = Feature<Point, EventProps>;

const KIND_COLOR: Record<EventKind, string> = {
  fire: '#ff5a1f',
  storm: '#6c7bff',
  tornado: '#e8384f',
  quake: '#ffb020',
  volcano: '#c2410c',
  flood: '#1e90ff',
  drought: '#c49a3a',
  ice: '#8fdcff',
  dust: '#d6b07a',
  landslide: '#8b5e3c',
  heat: '#ff3b6b',
  other: '#9aa3b5',
};
export const kindColor = (k: EventKind) => KIND_COLOR[k];

const ALERT_COLOR: Record<string, string> = { green: '#2fbf71', orange: '#ff8c1a', red: '#e8384f' };

function centroid(g: Geometry): Position | null {
  const ring = (coords: Position[]): Position => {
    let x = 0;
    let y = 0;
    for (const c of coords) {
      x += c[0];
      y += c[1];
    }
    return [x / coords.length, y / coords.length];
  };
  switch (g.type) {
    case 'Point':
      return g.coordinates;
    case 'Polygon':
      return ring(g.coordinates[0]);
    case 'MultiPolygon':
      return ring(g.coordinates[0][0]);
    case 'LineString':
      return g.coordinates[Math.floor(g.coordinates.length / 2)];
    default:
      return null;
  }
}

const point = (coords: Position, props: EventProps): EventFeature => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [coords[0], coords[1]] },
  properties: props,
});

// ---------------------------------------------------------------------------
// NASA EONET – Earth Observatory Natural Event Tracker (wildfires, storms, volcanoes, ice …)

const EONET_KIND: Record<string, EventKind> = {
  wildfires: 'fire',
  severeStorms: 'storm',
  volcanoes: 'volcano',
  floods: 'flood',
  drought: 'drought',
  seaLakeIce: 'ice',
  snow: 'ice',
  dustHaze: 'dust',
  landslides: 'landslide',
  tempExtremes: 'heat',
  earthquakes: 'quake',
};

interface EonetEvent {
  id: string;
  title: string;
  description?: string | null;
  link: string;
  categories: { id: string; title: string }[];
  sources: { id: string; url: string }[];
  geometry: {
    date: string;
    type: 'Point' | 'Polygon';
    coordinates: Position | Position[][];
    magnitudeValue?: number | null;
    magnitudeUnit?: string | null;
  }[];
}

export interface EonetResult {
  points: EventFeature[];
  tracks: Feature<LineString, { kind: EventKind; title: string }>[];
}

export async function loadEonet(): Promise<EonetResult> {
  const data = await fetchJson<{ events: EonetEvent[] }>(
    'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=45',
    undefined,
    30000,
  );
  const points: EventFeature[] = [];
  const tracks: EonetResult['tracks'] = [];
  for (const ev of data.events) {
    const kind = EONET_KIND[ev.categories[0]?.id] ?? 'other';
    if (kind === 'quake') continue; // USGS is the better source for quakes
    const geoms = [...ev.geometry].sort((a, b) => a.date.localeCompare(b.date));
    const last = geoms[geoms.length - 1];
    if (!last) continue;
    const pos = centroid({ type: last.type, coordinates: last.coordinates } as Geometry);
    if (!pos) continue;
    const magnitude =
      last.magnitudeValue != null ? `${last.magnitudeValue} ${last.magnitudeUnit ?? ''}`.trim() : undefined;
    let mag = last.magnitudeValue ?? undefined;
    if (mag != null && last.magnitudeUnit === 'kts') mag = Math.round(mag * 1.852); // → km/h
    points.push(
      point(pos, {
        kind,
        title: ev.title,
        subtitle: [ev.categories[0]?.title, kind === 'storm' && mag ? `${uTok('wind', mag)} Wind` : magnitude]
          .filter(Boolean)
          .join(' · '),
        date: last.date,
        source: `NASA EONET${ev.sources[0] ? ` / ${ev.sources[0].id}` : ''}`,
        url: ev.sources[0]?.url ?? ev.link,
        description: ev.description ?? undefined,
        color: KIND_COLOR[kind],
        weight: kind === 'storm' ? Math.min(1, 0.5 + (mag ?? 60) / 400) : kind === 'fire' ? 0.25 : 0.6,
        mag,
      }),
    );
    if (geoms.length > 1 && geoms.every((g) => g.type === 'Point')) {
      tracks.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: unwrapTrack(geoms.map((g) => g.coordinates as Position)) },
        properties: { kind, title: ev.title },
      });
    }
  }
  return { points, tracks };
}

/** Keep tracks continuous when they cross the antimeridian. */
function unwrapTrack(coords: Position[]): Position[] {
  const out: Position[] = [];
  for (const c of coords) {
    let lon = c[0];
    if (out.length) {
      const prev = out[out.length - 1][0];
      while (lon - prev > 180) lon -= 360;
      while (lon - prev < -180) lon += 360;
    }
    out.push([lon, c[1]]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// USGS earthquakes (last 7 days, M2.5+)

export async function loadQuakes(): Promise<EventFeature[]> {
  const data = await fetchJson<
    FeatureCollection<Point, { mag: number; place: string; time: number; url: string; tsunami: number; alert: string | null; title: string }>
  >('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson');
  return data.features
    .filter((f) => f.geometry)
    .map((f) => {
      const p = f.properties;
      const depth = f.geometry.coordinates[2];
      const ageH = (Date.now() - p.time) / 3600000;
      return point(f.geometry.coordinates, {
        kind: 'quake',
        title: `M ${p.mag?.toFixed(1)} – ${p.place ?? 'Unbekannter Ort'}`,
        subtitle: `Tiefe ${depth?.toFixed(0)} km${p.tsunami ? ' · Tsunami-Hinweis' : ''}`,
        date: new Date(p.time).toISOString(),
        source: 'USGS',
        url: p.url,
        color: ageH < 1 ? '#ff2d55' : ageH < 24 ? '#ff8c1a' : '#ffd23f',
        weight: Math.min(1, Math.max(0, (p.mag - 2.5) / 5)),
        mag: p.mag,
      });
    });
}

// ---------------------------------------------------------------------------
// NWS (USA) – tornado & severe storm warnings (storm-based polygons)

const NWS_EVENTS: Record<string, string> = {
  'Tornado Warning': '#ff1f3d',
  'Tornado Watch': '#ffd400',
  'Severe Thunderstorm Warning': '#ff9900',
  'Severe Thunderstorm Watch': '#db7093',
  'Extreme Wind Warning': '#ff8c69',
  'Flash Flood Warning': '#2ecc71',
  'Snow Squall Warning': '#c71585',
};
const NWS_DE: Record<string, string> = {
  'Tornado Warning': 'Tornado-Warnung',
  'Tornado Watch': 'Tornado-Vorwarnung (Watch)',
  'Severe Thunderstorm Warning': 'Warnung vor schwerem Gewitter',
  'Severe Thunderstorm Watch': 'Vorwarnung schweres Gewitter',
  'Extreme Wind Warning': 'Warnung vor Extremwind',
  'Flash Flood Warning': 'Sturzflut-Warnung',
  'Snow Squall Warning': 'Schneesturm-Warnung',
};

export interface NwsResult {
  polygons: Feature<Polygon | MultiPolygon, { color: string; event: string }>[];
  points: EventFeature[];
}

export async function loadNwsSevere(): Promise<NwsResult> {
  const results = await Promise.allSettled(
    Object.keys(NWS_EVENTS).map((event) =>
      fetchJson<
        FeatureCollection<
          Polygon | MultiPolygon | null,
          { event: string; headline?: string; areaDesc?: string; description?: string; onset?: string; expires?: string; ends?: string; '@id'?: string }
        >
      >(`https://api.weather.gov/alerts/active?event=${encodeURIComponent(event)}`, {
        headers: { Accept: 'application/geo+json' },
      }),
    ),
  );
  if (results.every((r) => r.status === 'rejected')) throw new Error('NWS nicht erreichbar');
  const polygons: NwsResult['polygons'] = [];
  const points: EventFeature[] = [];
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const f of r.value.features) {
      if (!f.geometry) continue; // zone-based alerts have no geometry
      const p = f.properties;
      const color = NWS_EVENTS[p.event] ?? '#ff9900';
      polygons.push({ type: 'Feature', geometry: f.geometry, properties: { color, event: p.event } });
      const c = centroid(f.geometry);
      if (!c) continue;
      const isTornado = p.event.startsWith('Tornado');
      points.push(
        point(c, {
          kind: isTornado ? 'tornado' : p.event.includes('Flood') ? 'flood' : 'storm',
          title: NWS_DE[p.event] ?? p.event,
          subtitle: p.areaDesc,
          date: p.onset,
          source: 'National Weather Service (USA)',
          url: p['@id'],
          description: p.description,
          color,
          weight: isTornado ? 0.8 : 0.45,
        }),
      );
    }
  }
  return { polygons, points };
}

/** SPC local storm reports – observed tornadoes today & yesterday (USA). Best effort. */
export async function loadSpcTornadoReports(): Promise<EventFeature[]> {
  const files = ['today_torn.csv', 'yesterday_torn.csv'];
  const out: EventFeature[] = [];
  await Promise.allSettled(
    files.map(async (file, i) => {
      const res = await fetch(`https://www.spc.noaa.gov/climo/reports/${file}`);
      if (!res.ok) return;
      const lines = (await res.text()).trim().split(/\r?\n/).slice(1);
      for (const line of lines) {
        const cols = line.split(',');
        if (cols.length < 7) continue;
        const [time, scale, location, county, state, lat, lon] = cols;
        const la = parseFloat(lat);
        const lo = parseFloat(lon);
        if (Number.isNaN(la) || Number.isNaN(lo)) continue;
        out.push(
          point([lo, la], {
            kind: 'tornado',
            title: `Tornado gemeldet – ${location}, ${state}`,
            subtitle: `${i === 0 ? 'Heute' : 'Gestern'} ${time.slice(0, 2)}:${time.slice(2)} UTC · ${county} County${scale && scale !== 'UNK' ? ` · ${scale}` : ''}`,
            source: 'NOAA Storm Prediction Center',
            url: 'https://www.spc.noaa.gov/climo/reports/',
            description: cols.slice(7).join(',').replace(/^"|"$/g, ''),
            color: '#ff1f3d',
            weight: 0.6,
          }),
        );
      }
    }),
  );
  return out;
}

// ---------------------------------------------------------------------------
// GDACS – Global Disaster Alert and Coordination System

const GDACS_KIND: Record<string, EventKind> = {
  TC: 'storm',
  FL: 'flood',
  VO: 'volcano',
  DR: 'drought',
  WF: 'fire',
};
const GDACS_TYPE_DE: Record<string, string> = {
  TC: 'Tropischer Wirbelsturm',
  FL: 'Überschwemmung',
  VO: 'Vulkanausbruch',
  DR: 'Dürre',
  WF: 'Waldbrand',
};

export async function loadGdacs(): Promise<EventFeature[]> {
  const data = await fetchJson<
    FeatureCollection<
      Geometry,
      {
        eventtype: string;
        name?: string;
        description?: string;
        alertlevel?: string;
        country?: string;
        fromdate?: string;
        todate?: string;
        url?: { report?: string };
        severitydata?: { severitytext?: string };
      }
    >
  >('https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=TC;FL;VO;DR;WF', undefined, 30000);
  const out: EventFeature[] = [];
  for (const f of data.features) {
    if (!f.geometry || f.geometry.type !== 'Point') continue;
    const p = f.properties;
    const kind = GDACS_KIND[p.eventtype];
    if (!kind) continue;
    const level = (p.alertlevel ?? 'green').toLowerCase();
    out.push(
      point(f.geometry.coordinates, {
        kind,
        title: `${GDACS_TYPE_DE[p.eventtype]}${p.name ? ` – ${p.name}` : ''}`,
        subtitle: [p.country, p.severitydata?.severitytext, `Alarmstufe ${level === 'red' ? 'Rot' : level === 'orange' ? 'Orange' : 'Grün'}`]
          .filter(Boolean)
          .join(' · '),
        date: p.fromdate,
        source: 'GDACS',
        url: p.url?.report,
        description: p.description,
        color: ALERT_COLOR[level] ?? KIND_COLOR[kind],
        weight: 0.25, // same small size for all alert levels – the colour shows the level
      }),
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// NASA FIRMS active fire hotspots (requires a free MAP_KEY)

export type FirmsFC = FeatureCollection<Point, { frp: number; conf: string; time: string }>;

export async function loadFirms(mapKey: string, source = 'VIIRS_NOAA20_NRT', days = 1, area = 'world'): Promise<FirmsFC> {
  const res = await fetch(
    `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${encodeURIComponent(mapKey)}/${source}/${area}/${days}`,
  );
  if (!res.ok) throw new Error(`FIRMS HTTP ${res.status}`);
  const [header, ...rows] = (await res.text()).trim().split(/\r?\n/);
  const cols = header.split(',');
  const iLat = cols.indexOf('latitude');
  const iLon = cols.indexOf('longitude');
  const iFrp = cols.indexOf('frp');
  const iConf = cols.indexOf('confidence');
  const iDate = cols.indexOf('acq_date');
  const iTime = cols.indexOf('acq_time');
  if (iLat < 0 || iLon < 0) throw new Error('FIRMS: unerwartetes Format (API-Key gültig?)');
  return {
    type: 'FeatureCollection',
    features: rows.map((r) => {
      const c = r.split(',');
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [parseFloat(c[iLon]), parseFloat(c[iLat])] },
        properties: { frp: parseFloat(c[iFrp]) || 0, conf: c[iConf] ?? '', time: `${c[iDate]} ${c[iTime]}` },
      };
    }),
  };
}

/** Shared worldwide FIRMS snapshot from the data branch (no user key needed). */
export function loadFirmsSnapshot(): Promise<FirmsFC> {
  return snapshotJson<FirmsFC>('firms/world.json');
}

// ---------------------------------------------------------------------------
// RainViewer radar frames

export interface RadarFrames {
  host: string;
  /** `hd`: a forecast step of the Orbis composites (no RainViewer tiles behind it) */
  frames: { time: number; path: string; nowcast: boolean; hd?: boolean }[];
}

/** Steps of the extrapolated radar forecast: up to one hour from now, in the 10-minute grid of the measurements. */
export function radarForecastSteps(lastTime: number, horizonMin = 60): RadarFrames['frames'] {
  const end = Date.now() / 1000 + horizonMin * 60;
  const out: RadarFrames['frames'] = [];
  for (let t = lastTime + 600; t <= end && out.length < 9; t += 600) out.push({ time: t, path: '', nowcast: true });
  return out;
}

/** RainViewer by default; a self-hosted, API-compatible server (LibreWXR) can be set in the settings. */
export const radarHost = () => (store.getKeys().radarHost || 'https://api.rainviewer.com').replace(/\/+$/, '');

export async function loadRadarFrames(): Promise<RadarFrames> {
  const data = await fetchJson<{
    host: string;
    radar: { past: { time: number; path: string }[]; nowcast?: { time: number; path: string }[] };
  }>(`${radarHost()}/public/weather-maps.json`);
  return {
    host: data.host,
    frames: [
      ...data.radar.past.map((f) => ({ ...f, nowcast: false })),
      ...(data.radar.nowcast ?? []).map((f) => ({ ...f, nowcast: true })),
    ],
  };
}
