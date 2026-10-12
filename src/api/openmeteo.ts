import { fetchJson } from '../util';
import type { Place } from '../store';
import { store } from '../store';

// Open-Meteo: free, no API key, CORS enabled. https://open-meteo.com/

export interface Forecast {
  latitude: number;
  longitude: number;
  timezone: string;
  utc_offset_seconds: number;
  elevation: number;
  current: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    apparent_temperature: number;
    is_day: number;
    precipitation: number;
    weather_code: number;
    cloud_cover: number;
    pressure_msl: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    wind_gusts_10m: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    apparent_temperature: number[];
    precipitation_probability: (number | null)[];
    precipitation: number[];
    weather_code: number[];
    wind_speed_10m: number[];
    wind_gusts_10m: number[];
    is_day: number[];
    uv_index: (number | null)[];
    visibility: (number | null)[];
    dew_point_2m: number[];
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    sunrise: string[];
    sunset: string[];
    precipitation_sum: number[];
    precipitation_probability_max: (number | null)[];
    wind_speed_10m_max: number[];
    wind_gusts_10m_max: number[];
    wind_direction_10m_dominant: number[];
    uv_index_max: (number | null)[];
  };
}

const CURRENT = [
  'temperature_2m',
  'relative_humidity_2m',
  'apparent_temperature',
  'is_day',
  'precipitation',
  'weather_code',
  'cloud_cover',
  'pressure_msl',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
];
const HOURLY = [
  'temperature_2m',
  'apparent_temperature',
  'precipitation_probability',
  'precipitation',
  'weather_code',
  'wind_speed_10m',
  'wind_gusts_10m',
  'is_day',
  'uv_index',
  'visibility',
  'dew_point_2m',
];
const DAILY = [
  'weather_code',
  'temperature_2m_max',
  'temperature_2m_min',
  'sunrise',
  'sunset',
  'precipitation_sum',
  'precipitation_probability_max',
  'wind_speed_10m_max',
  'wind_gusts_10m_max',
  'wind_direction_10m_dominant',
  'uv_index_max',
];

export function getForecast(lat: number, lon: number): Promise<Forecast> {
  const q = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    current: CURRENT.join(','),
    hourly: HOURLY.join(','),
    daily: DAILY.join(','),
    timezone: 'auto',
    forecast_days: '14',
    wind_speed_unit: 'kmh',
  });
  return fetchJson<Forecast>(`https://api.open-meteo.com/v1/forecast?${q}`);
}

export interface PointNow {
  current: Forecast['current'];
  timezone: string;
  elevation: number;
}

export function getCurrent(lat: number, lon: number): Promise<PointNow> {
  const q = new URLSearchParams({
    latitude: lat.toFixed(3),
    longitude: lon.toFixed(3),
    current: CURRENT.join(','),
    timezone: 'auto',
  });
  return fetchJson<PointNow>(`https://api.open-meteo.com/v1/forecast?${q}`);
}

export interface AirQuality {
  current: {
    european_aqi: number | null;
    us_aqi: number | null;
    pm10: number | null;
    pm2_5: number | null;
    ozone: number | null;
    nitrogen_dioxide: number | null;
    alder_pollen: number | null;
    birch_pollen: number | null;
    grass_pollen: number | null;
    mugwort_pollen: number | null;
    ragweed_pollen: number | null;
  };
}

export function getAirQuality(lat: number, lon: number): Promise<AirQuality> {
  const q = new URLSearchParams({
    latitude: lat.toFixed(3),
    longitude: lon.toFixed(3),
    current:
      'european_aqi,us_aqi,pm10,pm2_5,ozone,nitrogen_dioxide,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,ragweed_pollen',
    timezone: 'auto',
  });
  return fetchJson<AirQuality>(`https://air-quality-api.open-meteo.com/v1/air-quality?${q}`);
}

interface GeoResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  country_code?: string;
  admin1?: string;
  admin2?: string;
  population?: number;
}

export async function searchPlaces(name: string): Promise<Place[]> {
  const q = new URLSearchParams({ name, count: '8', language: 'de', format: 'json' });
  const data = await fetchJson<{ results?: GeoResult[] }>(`https://geocoding-api.open-meteo.com/v1/search?${q}`);
  return (data.results ?? []).map((r) => ({
    name: r.name,
    lat: r.latitude,
    lon: r.longitude,
    region: r.admin1,
    country: r.country,
    countryCode: r.country_code,
  }));
}

/** Reverse geocoding (Open-Meteo has none) – BigDataCloud's free client endpoint, no key. */
export async function reverseGeocode(lat: number, lon: number): Promise<Place> {
  try {
    const q = new URLSearchParams({ latitude: String(lat), longitude: String(lon), localityLanguage: 'de' });
    const r = await fetchJson<{
      city?: string;
      locality?: string;
      principalSubdivision?: string;
      countryName?: string;
      countryCode?: string;
    }>(`https://api.bigdatacloud.net/data/reverse-geocode-client?${q}`, undefined, 8000);
    return {
      name: r.city || r.locality || 'Mein Standort',
      lat,
      lon,
      region: r.principalSubdivision,
      country: r.countryName,
      countryCode: r.countryCode,
    };
  } catch {
    return { name: 'Mein Standort', lat, lon };
  }
}

// ---------------------------------------------------------------------------
// Global coarse grid for the globe overlays (temperature, clouds, wind, pressure).

export interface Grid {
  lats: number[]; // north → south
  lons: number[]; // west → east
  temp: Float32Array;
  cloud: Float32Array;
  precip: Float32Array;
  pressure: Float32Array;
  u: Float32Array; // m/s eastward
  v: Float32Array; // m/s northward
  time: string;
}

const GRID_STEP = 10;

/**
 * Fetches current conditions for a 10° grid (612 points) in a few batched multi-location
 * requests. Cached for 45 minutes – model data only changes hourly.
 */
export async function getGlobalGrid(): Promise<Grid> {
  const cached = store.cacheGet<Omit<Grid, 'temp' | 'cloud' | 'precip' | 'pressure' | 'u' | 'v'> & Record<string, number[]>>(
    'grid',
    45 * 60 * 1000,
  );
  if (cached) return hydrate(cached);

  const lats: number[] = [];
  const lons: number[] = [];
  for (let lat = 80; lat >= -80; lat -= GRID_STEP) lats.push(lat);
  for (let lon = -180; lon < 180; lon += GRID_STEP) lons.push(lon);

  const points: [number, number][] = [];
  for (const lat of lats) for (const lon of lons) points.push([lat, lon]);

  const BATCH = 160;
  type Row = {
    current: {
      time: string;
      temperature_2m: number;
      cloud_cover: number;
      precipitation: number;
      pressure_msl: number;
      wind_speed_10m: number;
      wind_direction_10m: number;
    };
  };
  const rows: Row[] = [];
  for (let i = 0; i < points.length; i += BATCH) {
    const chunk = points.slice(i, i + BATCH);
    const q = new URLSearchParams({
      latitude: chunk.map((p) => p[0]).join(','),
      longitude: chunk.map((p) => p[1]).join(','),
      current: 'temperature_2m,cloud_cover,precipitation,pressure_msl,wind_speed_10m,wind_direction_10m',
      wind_speed_unit: 'ms',
      timezone: 'GMT',
    });
    const res = await fetchJson<Row | Row[]>(`https://api.open-meteo.com/v1/forecast?${q}`, undefined, 30000);
    rows.push(...(Array.isArray(res) ? res : [res]));
  }

  const n = points.length;
  const g: Grid = {
    lats,
    lons,
    temp: new Float32Array(n),
    cloud: new Float32Array(n),
    precip: new Float32Array(n),
    pressure: new Float32Array(n),
    u: new Float32Array(n),
    v: new Float32Array(n),
    time: rows[0]?.current.time ?? '',
  };
  rows.forEach((r, i) => {
    const c = r.current;
    g.temp[i] = c.temperature_2m;
    g.cloud[i] = c.cloud_cover;
    g.precip[i] = c.precipitation;
    g.pressure[i] = c.pressure_msl;
    // Meteorological direction = where the wind comes FROM.
    const rad = (c.wind_direction_10m * Math.PI) / 180;
    g.u[i] = -c.wind_speed_10m * Math.sin(rad);
    g.v[i] = -c.wind_speed_10m * Math.cos(rad);
  });

  store.cacheSet('grid', {
    lats,
    lons,
    time: g.time,
    temp: Array.from(g.temp),
    cloud: Array.from(g.cloud),
    precip: Array.from(g.precip),
    pressure: Array.from(g.pressure),
    u: Array.from(g.u),
    v: Array.from(g.v),
  });
  return g;
}

function hydrate(c: Record<string, unknown>): Grid {
  const f = (k: string) => Float32Array.from(c[k] as number[]);
  return {
    lats: c.lats as number[],
    lons: c.lons as number[],
    time: c.time as string,
    temp: f('temp'),
    cloud: f('cloud'),
    precip: f('precip'),
    pressure: f('pressure'),
    u: f('u'),
    v: f('v'),
  };
}

/** Bilinear sample of a grid field; longitude wraps, latitude is clamped. */
export function sampleGrid(g: Grid, field: Float32Array, lat: number, lon: number): number {
  const nLon = g.lons.length;
  const nLat = g.lats.length;
  let x = (lon - g.lons[0]) / GRID_STEP;
  x = ((x % nLon) + nLon) % nLon;
  let y = (g.lats[0] - lat) / GRID_STEP;
  y = Math.max(0, Math.min(nLat - 1, y));
  const x0 = Math.floor(x);
  const x1 = (x0 + 1) % nLon;
  const y0 = Math.floor(y);
  const y1 = Math.min(nLat - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;
  const a = field[y0 * nLon + x0];
  const b = field[y0 * nLon + x1];
  const c = field[y1 * nLon + x0];
  const d = field[y1 * nLon + x1];
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}
