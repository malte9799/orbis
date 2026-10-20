import { fetchJson } from '../util';
import type { Place } from '../store';

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

/**
 * Name of the device's own position (Open-Meteo has no reverse geocoding) – BigDataCloud's free
 * client endpoint, no key. Its fair-use policy allows only the device's current location obtained
 * via geolocation: never pass other coordinates here, use {@link reverseGeocodePoint} instead.
 */
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

/**
 * Name of any point on the map – OpenStreetMap Nominatim (ODbL). Usage policy: at most one request
 * per second and no bulk lookups, which a single click per user easily meets.
 */
export async function reverseGeocodePoint(lat: number, lon: number): Promise<Place> {
  try {
    const q = new URLSearchParams({ format: 'jsonv2', lat: String(lat), lon: String(lon), zoom: '10', 'accept-language': 'de' });
    const r = await fetchJson<{
      name?: string;
      address?: { city?: string; town?: string; village?: string; municipality?: string; county?: string; state?: string; country?: string; country_code?: string };
    }>(`https://nominatim.openstreetmap.org/reverse?${q}`, undefined, 8000);
    const a = r.address ?? {};
    return {
      name: a.city || a.town || a.village || a.municipality || r.name || a.county || 'Ausgewählter Ort',
      lat,
      lon,
      region: a.state,
      country: a.country,
      countryCode: a.country_code?.toUpperCase(),
    };
  } catch {
    return { name: 'Ausgewählter Ort', lat, lon };
  }
}
