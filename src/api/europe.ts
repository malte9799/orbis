import type { Feature, FeatureCollection, MultiPolygon, Point, Polygon } from 'geojson';
import { fetchJson, fmt } from '../util';
import { uTok } from '../units';
import { omFetch } from './omlimit';
import { aqiLabel, describe, pollenLabel } from '../weather';
import { EUROPE_CITIES, WORLD_CITIES, type City } from './cities';
import type { EventFeature, EventProps } from './events';

// ---------------------------------------------------------------------------
// EMSC – European-Mediterranean Seismological Centre (incl. small quakes in Europe)

/** Bounding box treated as "Europe" – here EMSC replaces USGS (more complete, smaller quakes). */
export const EUROPE_BBOX = { west: -25, south: 27, east: 45, north: 72 };
export const inEurope = (lon: number, lat: number) =>
  lon >= EUROPE_BBOX.west && lon <= EUROPE_BBOX.east && lat >= EUROPE_BBOX.south && lat <= EUROPE_BBOX.north;

export async function loadEmsc(): Promise<EventFeature[]> {
  const start = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 19);
  const q = new URLSearchParams({
    format: 'json',
    minlatitude: String(EUROPE_BBOX.south),
    maxlatitude: String(EUROPE_BBOX.north),
    minlongitude: String(EUROPE_BBOX.west),
    maxlongitude: String(EUROPE_BBOX.east),
    minmagnitude: '1.5',
    starttime: start,
    limit: '2000',
    orderby: 'time',
  });
  const data = await fetchJson<
    FeatureCollection<Point, { mag: number; magtype?: string; time: string; depth?: number; flynn_region?: string; unid?: string }>
  >(`https://www.seismicportal.eu/fdsnws/event/1/query?${q}`, undefined, 30000);
  return data.features
    .filter((f) => f.geometry && f.properties?.mag != null)
    .map((f) => {
      const p = f.properties;
      const t = Date.parse(p.time.endsWith('Z') ? p.time : `${p.time}Z`);
      const ageH = (Date.now() - t) / 3600000;
      const region = (p.flynn_region ?? '').toLowerCase().replace(/(^|[\s,-])\p{L}/gu, (m) => m.toUpperCase());
      const depth = p.depth ?? Math.abs(f.geometry.coordinates[2] ?? 0);
      return {
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [f.geometry.coordinates[0], f.geometry.coordinates[1]] },
        properties: {
          kind: 'quake' as const,
          title: `M ${p.mag.toFixed(1)} – ${region || 'Europa'}`,
          subtitle: `Tiefe ${Math.round(depth)} km${p.magtype ? ` · ${p.magtype}` : ''}`,
          date: new Date(t).toISOString(),
          source: 'EMSC',
          url: p.unid ? `https://www.seismicportal.eu/eventdetails.html?unid=${encodeURIComponent(p.unid)}` : 'https://www.emsc-csem.org/',
          color: ageH < 1 ? '#ff2d55' : ageH < 24 ? '#ff8c1a' : '#ffd23f',
          weight: Math.min(1, Math.max(0, (p.mag - 1.5) / 5)),
          mag: p.mag,
        } satisfies EventProps,
      };
    });
}

// ---------------------------------------------------------------------------
// PEGELONLINE – water levels of German federal waterways (WSV), with high/low water state

interface PegelStation {
  number: string;
  shortname: string;
  longname: string;
  longitude?: number;
  latitude?: number;
  agency?: string;
  water?: { longname: string };
  timeseries?: {
    shortname: string;
    unit: string;
    currentMeasurement?: { timestamp: string; value: number; stateMnwMhw?: string; stateNswHsw?: string; trend?: number };
  }[];
}

const GAUGE_STATE: Record<string, { color: string; label: string; weight: number }> = {
  high: { color: '#e8384f', label: 'Hochwasser (über mittlerem Hochwasser)', weight: 1 },
  low: { color: '#f2a23c', label: 'Niedrigwasser (unter mittlerem Niedrigwasser)', weight: 0.6 },
  normal: { color: '#3d9ad1', label: 'Normal', weight: 0.3 },
};

export async function loadPegel(): Promise<FeatureCollection<Point, EventProps & { state: string }>> {
  const stations = await fetchJson<PegelStation[]>(
    'https://www.pegelonline.wsv.de/webservices/rest-api/v2/stations.json?timeseries=W&includeTimeseries=true&includeCurrentMeasurement=true',
    undefined,
    30000,
  );
  const features: Feature<Point, EventProps & { state: string }>[] = [];
  for (const s of stations) {
    if (s.longitude == null || s.latitude == null) continue;
    const ts = s.timeseries?.find((t) => t.shortname === 'W');
    const m = ts?.currentMeasurement;
    if (!m) continue;
    // HSW = highest navigable water level – the more alarming of the two classifications
    const state = m.stateNswHsw === 'high' ? 'high' : (m.stateMnwMhw ?? 'unknown');
    const st = GAUGE_STATE[state] ?? { color: '#8892a6', label: 'unbekannt', weight: 0.2 };
    const trend = m.trend === 1 ? ' ↑ steigend' : m.trend === -1 ? ' ↓ fallend' : '';
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.longitude, s.latitude] },
      properties: {
        kind: 'flood',
        state,
        title: `Pegel ${titleCase(s.longname)} (${titleCase(s.water?.longname ?? '')})`,
        subtitle: `Wasserstand ${ts!.unit === 'cm' ? uTok('level', m.value) : `${fmt.num(m.value, 0)} ${ts!.unit}`}${trend} · ${st.label}`,
        date: m.timestamp,
        source: `PEGELONLINE (WSV)${s.agency ? ` / ${titleCase(s.agency)}` : ''}`,
        url: `https://www.pegelonline.wsv.de/gast/stammdaten?pegelnr=${encodeURIComponent(s.number)}`,
        color: st.color,
        weight: st.weight,
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

function titleCase(s: string) {
  return s.toLowerCase().replace(/(^|[\s\-(/])\p{L}/gu, (m) => m.toUpperCase());
}

// ---------------------------------------------------------------------------
// DWD – official weather warnings for Germany as clickable polygons (WFS)

const DWD_SEVERITY: Record<string, { color: string; label: string }> = {
  minor: { color: '#ffeb3b', label: 'Wetterwarnung' },
  moderate: { color: '#fb8c00', label: 'Markantes Wetter' },
  severe: { color: '#e53935', label: 'Unwetterwarnung' },
  extreme: { color: '#880e4f', label: 'Extremes Unwetter' },
};

export async function loadDwdWarnings(): Promise<FeatureCollection<Polygon | MultiPolygon, EventProps & { order: number }>> {
  const q = new URLSearchParams({
    service: 'WFS',
    version: '1.0.0',
    request: 'GetFeature',
    typeName: 'dwd:Warnungen_Landkreise',
    outputFormat: 'application/json',
  });
  const data = await fetchJson<FeatureCollection<Polygon | MultiPolygon, Record<string, string | number | null>>>(
    `https://maps.dwd.de/geoserver/dwd/ows?${q}`,
    undefined,
    30000,
  );
  const get = (p: Record<string, unknown>, k: string) => (p[k] ?? p[k.toLowerCase()] ?? '') as string;
  const order = ['minor', 'moderate', 'severe', 'extreme'];
  const features = data.features
    .filter((f) => f.geometry)
    .map((f) => {
      const p = f.properties ?? {};
      const sev = get(p, 'SEVERITY').toLowerCase();
      const s = DWD_SEVERITY[sev] ?? DWD_SEVERITY.minor;
      return {
        ...f,
        properties: {
          kind: 'other' as const,
          title: get(p, 'HEADLINE') || get(p, 'EVENT') || s.label,
          subtitle: [get(p, 'AREADESC') || get(p, 'NAME'), s.label].filter(Boolean).join(' · '),
          date: get(p, 'ONSET') || undefined,
          description: [get(p, 'DESCRIPTION'), get(p, 'INSTRUCTION'), get(p, 'EXPIRES') ? `Gültig bis ${fmt.dateTime(get(p, 'EXPIRES'))}` : '']
            .filter(Boolean)
            .join('\n\n'),
          source: 'Deutscher Wetterdienst',
          url: 'https://www.dwd.de/DE/wetter/warnungen/warnWetter_node.html',
          color: s.color,
          weight: (order.indexOf(sev) + 1) / 4,
          order: order.indexOf(sev),
        },
      };
    })
    // draw the most severe warnings on top
    .sort((a, b) => a.properties.order - b.properties.order);
  return { type: 'FeatureCollection', features };
}

// ---------------------------------------------------------------------------
// City weather labels & air quality (Open-Meteo, multi-location requests)

export interface CityWeather {
  name: string;
  lat: number;
  lon: number;
  rank: number;
  temp: number;
  code: number;
  isDay: boolean;
  wind: number;
}

async function multi<T>(base: string, cities: City[], params: Record<string, string>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < cities.length; i += 100) {
    const chunk = cities.slice(i, i + 100);
    const q = new URLSearchParams({
      latitude: chunk.map((c) => c[1]).join(','),
      longitude: chunk.map((c) => c[2]).join(','),
      timezone: 'GMT',
      ...params,
    });
    const r = await omFetch<T | T[]>(`${base}?${q}`, chunk.length, true);
    out.push(...(Array.isArray(r) ? r : [r]));
  }
  return out;
}

export async function loadCityWeather(): Promise<CityWeather[]> {
  const cities = [...EUROPE_CITIES, ...WORLD_CITIES];
  const rows = await multi<{ current: { temperature_2m: number; weather_code: number; is_day: number; wind_speed_10m: number } }>(
    'https://api.open-meteo.com/v1/forecast',
    cities,
    { current: 'temperature_2m,weather_code,is_day,wind_speed_10m' },
  );
  return rows.map((r, i) => ({
    name: cities[i][0],
    lat: cities[i][1],
    lon: cities[i][2],
    rank: cities[i][3],
    temp: r.current.temperature_2m,
    code: r.current.weather_code,
    isDay: r.current.is_day === 1,
    wind: r.current.wind_speed_10m,
  }));
}

export const cityDescription = (c: CityWeather) => describe(c.code);

export async function loadCityAirQuality(): Promise<FeatureCollection<Point, EventProps & { aqi: number }>> {
  const cities = EUROPE_CITIES;
  const rows = await multi<{
    current: {
      european_aqi: number | null;
      pm2_5: number | null;
      pm10: number | null;
      ozone: number | null;
      nitrogen_dioxide: number | null;
      birch_pollen: number | null;
      grass_pollen: number | null;
      alder_pollen: number | null;
      ragweed_pollen: number | null;
    };
  }>('https://air-quality-api.open-meteo.com/v1/air-quality', cities, {
    current: 'european_aqi,pm2_5,pm10,ozone,nitrogen_dioxide,birch_pollen,grass_pollen,alder_pollen,ragweed_pollen',
  });
  const features: Feature<Point, EventProps & { aqi: number }>[] = [];
  rows.forEach((r, i) => {
    const c = r.current;
    if (c.european_aqi == null) return;
    const lvl = aqiLabel(c.european_aqi);
    const pollen = (
      [
        ['Birke', c.birch_pollen],
        ['Gräser', c.grass_pollen],
        ['Erle', c.alder_pollen],
        ['Ambrosia', c.ragweed_pollen],
      ] as [string, number | null][]
    )
      .filter(([, v]) => v != null && v >= 1)
      .map(([n, v]) => `${n}: ${pollenLabel(v)}`)
      .join(', ');
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [cities[i][2], cities[i][1]] },
      properties: {
        kind: 'dust',
        aqi: Math.round(c.european_aqi),
        title: `Luftqualität ${cities[i][0]}: ${lvl.label}`,
        subtitle: `EAQI ${Math.round(c.european_aqi)} · PM2,5 ${fmt.num(c.pm2_5, 0)} · PM10 ${fmt.num(c.pm10, 0)} · O₃ ${fmt.num(c.ozone, 0)} · NO₂ ${fmt.num(c.nitrogen_dioxide, 0)} µg/m³`,
        description: pollen ? `Pollenflug – ${pollen}` : 'Derzeit kein nennenswerter Pollenflug.',
        source: 'Open-Meteo / Copernicus CAMS',
        url: 'https://atmosphere.copernicus.eu/',
        color: lvl.color,
        weight: Math.min(1, c.european_aqi / 100),
      },
    });
  });
  return { type: 'FeatureCollection', features };
}
