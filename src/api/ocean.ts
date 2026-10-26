import type { Feature, FeatureCollection, Point } from 'geojson';
import { fetchJson, rampColor } from '../util';
import { pressureTxt, speedTxt, tempTxt, windTxt } from '../units';
import { fetchText } from './data';
import { omFetch } from './omlimit';
import { viaProxy } from './proxy';

// Ocean layers: NOAA NDBC buoys, NOAA CO-OPS tide gauges and an Open-Meteo wave grid.
// NDBC and CO-OPS are fetched through the shared data proxy (CORS + caching).

const point = (lon: number, lat: number, properties: Record<string, unknown>): Feature<Point> => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [lon, lat] },
  properties,
});

const rgb = (c: [number, number, number]) => `rgb(${c.map((x) => Math.round(x)).join(',')})`;

const WAVE_STOPS: [number, string][] = [
  [0, '#4fc3f7'],
  [1, '#26c6da'],
  [2, '#66bb6a'],
  [3.5, '#ffee58'],
  [5, '#ffa726'],
  [7, '#ef5350'],
  [10, '#ab47bc'],
];
export const waveColor = (h: number) => rgb(rampColor(WAVE_STOPS, h));

const MS_TO_KMH = 3.6;
const MS_TO_KN = 1.943844;
const compass = (deg: number) => ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8];

// ---------------------------------------------------------------------------
// NOAA NDBC – latest observation of every buoy / coastal station (≤ 2 h old).

export async function loadBuoys(): Promise<FeatureCollection<Point>> {
  const text = await fetchText(viaProxy('https://www.ndbc.noaa.gov/data/latest_obs/latest_obs.txt'), 30000);
  const features: Feature<Point>[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    const c = line.trim().split(/\s+/);
    if (c.length < 21) continue;
    const num = (i: number) => {
      const v = parseFloat(c[i]);
      return c[i] === 'MM' || !Number.isFinite(v) ? null : v;
    };
    const [stn, lat, lon] = [c[0], num(1), num(2)];
    if (lat == null || lon == null) continue;
    const wdir = num(8);
    const wspd = num(9);
    const gst = num(10);
    const wvht = num(11);
    const dpd = num(12);
    const pres = num(15);
    const atmp = num(17);
    const wtmp = num(18);
    if (wspd == null && wvht == null && atmp == null && wtmp == null && pres == null) continue;
    const rows = [
      wvht != null && `Wellenhöhe ${wvht.toLocaleString('de-DE')} m${dpd != null ? ` (Periode ${dpd} s)` : ''}`,
      wspd != null && `Wind ${windTxt(wspd * MS_TO_KMH)}${wdir != null ? ` aus ${compass(wdir)}` : ''}${gst != null ? `, Böen ${windTxt(gst * MS_TO_KMH)}` : ''}`,
      pres != null && `Luftdruck ${pressureTxt(pres)}`,
      atmp != null && `Luft ${tempTxt(atmp)}`,
      wtmp != null && `Wasser ${tempTxt(wtmp)}`,
    ].filter(Boolean);
    const time = new Date(Date.UTC(+c[3], +c[4] - 1, +c[5], +c[6], +c[7]));
    features.push(
      point(lon, lat, {
        title: `Messboje ${stn}`,
        subtitle: rows.join(' · '),
        date: time.toISOString(),
        color: wvht != null ? waveColor(wvht) : '#90a4ae',
        label: wvht != null ? wvht.toLocaleString('de-DE', { maximumFractionDigits: 1 }) : wspd != null ? String(Math.round(wspd * MS_TO_KN)) : '',
        wave: wvht ?? -1,
        source: 'NOAA National Data Buoy Center',
        url: `https://www.ndbc.noaa.gov/station_page.php?station=${encodeURIComponent(stn)}`,
      }),
    );
  }
  if (!features.length) throw new Error('NDBC: keine Daten');
  return { type: 'FeatureCollection', features };
}

// ---------------------------------------------------------------------------
// NOAA CO-OPS – tide gauges (USA). The list is loaded once, the current water level on click.

export async function loadTideStations(): Promise<FeatureCollection<Point>> {
  const json = await fetchJson<{ stations: { id: string; name: string; state?: string; lat: number; lng: number }[] }>(
    viaProxy('https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=waterlevels'),
    undefined,
    30000,
  );
  return {
    type: 'FeatureCollection',
    features: json.stations
      .filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))
      .map((s) =>
        point(s.lng, s.lat, {
          id: s.id,
          title: `Pegel ${s.name}${s.state ? `, ${s.state}` : ''}`,
          subtitle: `Station ${s.id}`,
          source: 'NOAA CO-OPS',
          url: `https://tidesandcurrents.noaa.gov/stationhome.html?id=${s.id}`,
        }),
      ),
  };
}

/** Latest measured water level and the next high/low tide of a gauge. */
export async function loadTideDetails(id: string): Promise<{ level?: { v: number; t: string }; next: { t: string; v: number; type: 'H' | 'L' }[] }> {
  const base = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?station=${encodeURIComponent(id)}&units=metric&time_zone=gmt&format=json&datum=MLLW&application=orbis`;
  const [level, hilo] = await Promise.allSettled([
    // Great Lakes gauges have no MLLW datum (and no predictions) – they use IGLD
    fetchJson<{ data?: { t: string; v: string }[] }>(viaProxy(`${base}&product=water_level&date=latest`)).catch(() =>
      fetchJson<{ data?: { t: string; v: string }[] }>(viaProxy(`${base.replace('datum=MLLW', 'datum=IGLD')}&product=water_level&date=latest`)),
    ),
    fetchJson<{ predictions?: { t: string; v: string; type: 'H' | 'L' }[] }>(viaProxy(`${base}&product=predictions&interval=hilo&range=48&begin_date=${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`)),
  ]);
  const lv = level.status === 'fulfilled' ? level.value.data?.[0] : undefined;
  const now = Date.now();
  const next =
    hilo.status === 'fulfilled'
      ? (hilo.value.predictions ?? [])
          .map((p) => ({ t: new Date(`${p.t.replace(' ', 'T')}:00Z`).toISOString(), v: parseFloat(p.v), type: p.type }))
          .filter((p) => new Date(p.t).getTime() > now)
          .slice(0, 4)
      : [];
  if (!lv && !next.length) throw new Error('keine Daten');
  return { level: lv ? { v: parseFloat(lv.v), t: new Date(`${lv.t.replace(' ', 'T')}:00Z`).toISOString() } : undefined, next };
}

// ---------------------------------------------------------------------------
// Open-Meteo Marine – current waves and surface current on a grid over the viewport.

export interface WaveView {
  west: number;
  south: number;
  east: number;
  north: number;
  zoom: number;
}

const STEPS = [0.25, 0.5, 1, 2, 5, 10, 20];

export async function loadWaves(v: WaveView): Promise<{ fc: FeatureCollection<Point>; step: number }> {
  const west = Math.max(-180, v.west);
  const east = Math.min(180, v.east);
  const south = Math.max(-78, v.south);
  const north = Math.min(78, v.north);
  // coarsest grid with at most ~90 points, snapped to whole degrees so panning re-uses the cache
  const step = STEPS.find((s) => (Math.ceil((east - west) / s) + 1) * (Math.ceil((north - south) / s) + 1) <= 90) ?? 20;
  const lats: number[] = [];
  const lons: number[] = [];
  for (let la = Math.ceil(south / step) * step; la <= north; la += step) {
    for (let lo = Math.ceil(west / step) * step; lo <= east; lo += step) {
      lats.push(+la.toFixed(2));
      lons.push(+lo.toFixed(2));
    }
  }
  if (!lats.length) return { fc: { type: 'FeatureCollection', features: [] }, step };
  const q = new URLSearchParams({
    latitude: lats.join(','),
    longitude: lons.join(','),
    current: 'wave_height,wave_direction,wave_period,swell_wave_height,ocean_current_velocity,ocean_current_direction',
    wind_speed_unit: 'kmh',
    timezone: 'GMT',
  });
  type Row = { current?: Record<string, number | string | null> };
  const json = await omFetch<Row | Row[]>(`https://marine-api.open-meteo.com/v1/marine?${q}`, lats.length, true);
  const rows = Array.isArray(json) ? json : [json];
  const features: Feature<Point>[] = [];
  rows.forEach((r, i) => {
    const c = r.current;
    const h = c?.wave_height;
    if (typeof h !== 'number') return; // land
    const dir = typeof c?.wave_direction === 'number' ? c.wave_direction : null;
    const per = typeof c?.wave_period === 'number' ? c.wave_period : null;
    const swell = typeof c?.swell_wave_height === 'number' ? c.swell_wave_height : null;
    const cv = typeof c?.ocean_current_velocity === 'number' ? c.ocean_current_velocity : null;
    const cd = typeof c?.ocean_current_direction === 'number' ? c.ocean_current_direction : null;
    features.push(
      point(lons[i], lats[i], {
        title: 'Seegang',
        subtitle: [
          `Wellenhöhe ${h.toLocaleString('de-DE')} m${dir != null ? ` aus ${compass(dir)}` : ''}`,
          per != null && `Periode ${per} s`,
          swell != null && `Dünung ${swell.toLocaleString('de-DE')} m`,
          cv != null && `Strömung ${speedTxt(cv, 1)}${cd != null ? ` nach ${compass(cd)}` : ''}`,
        ]
          .filter(Boolean)
          .join(' · '),
        date: typeof c?.time === 'string' ? `${c.time}:00Z` : undefined,
        color: waveColor(h),
        label: h.toLocaleString('de-DE', { maximumFractionDigits: 1 }),
        wave: h,
        source: 'Open-Meteo Marine (CC BY 4.0)',
        url: 'https://open-meteo.com/en/docs/marine-weather-api',
      }),
    );
  });
  return { fc: { type: 'FeatureCollection', features }, step };
}

// ---------------------------------------------------------------------------
// Open-Meteo Flood (GloFAS) – river discharge. Query points snap to the nearest modelled
// river, so a grid over the viewport yields river points (duplicates are merged).

const RIVER_STOPS: [number, string][] = [
  [10, '#90caf9'],
  [100, '#42a5f5'],
  [1000, '#1e88e5'],
  [5000, '#7e57c2'],
  [20000, '#d81b60'],
];

export async function loadRivers(v: WaveView): Promise<{ fc: FeatureCollection<Point>; step: number }> {
  const west = Math.max(-180, v.west);
  const east = Math.min(180, v.east);
  const south = Math.max(-60, v.south);
  const north = Math.min(80, v.north);
  const step = STEPS.find((s) => (Math.ceil((east - west) / s) + 1) * (Math.ceil((north - south) / s) + 1) <= 90) ?? 20;
  const lats: number[] = [];
  const lons: number[] = [];
  for (let la = Math.ceil(south / step) * step; la <= north; la += step) {
    for (let lo = Math.ceil(west / step) * step; lo <= east; lo += step) {
      lats.push(+la.toFixed(2));
      lons.push(+lo.toFixed(2));
    }
  }
  if (!lats.length) return { fc: { type: 'FeatureCollection', features: [] }, step };
  const q = new URLSearchParams({ latitude: lats.join(','), longitude: lons.join(','), daily: 'river_discharge', forecast_days: '7', timezone: 'GMT' });
  type Row = { latitude: number; longitude: number; daily?: { time: string[]; river_discharge: (number | null)[] } };
  const json = await omFetch<Row | Row[]>(`https://flood-api.open-meteo.com/v1/flood?${q}`, lats.length, true);
  const seen = new Set<string>();
  const features: Feature<Point>[] = [];
  for (const r of Array.isArray(json) ? json : [json]) {
    const d = r.daily?.river_discharge;
    const now = d?.[0];
    if (!d || typeof now !== 'number' || now < 1) continue;
    const key = `${r.latitude.toFixed(3)},${r.longitude.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const peak = Math.max(...d.filter((x): x is number => typeof x === 'number'));
    const change = (peak - now) / now;
    const trend = change > 0.25 ? 'steigend ↑' : change < -0.25 ? 'fallend ↓' : 'gleichbleibend →';
    const fmtQ = (x: number) => Math.round(x).toLocaleString('de-DE');
    features.push(
      point(r.longitude, r.latitude, {
        title: 'Flussabfluss',
        subtitle: `${fmtQ(now)} m³/s heute · ${trend} · Höchstwert in 7 Tagen ${fmtQ(peak)} m³/s`,
        date: r.daily!.time[0],
        color: rgb(rampColor(RIVER_STOPS, now)),
        label: now >= 1000 ? `${(now / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })}k` : fmtQ(now),
        q: now,
        source: 'Open-Meteo Flood / GloFAS (CC BY 4.0)',
        url: 'https://open-meteo.com/en/docs/flood-api',
      }),
    );
  }
  return { fc: { type: 'FeatureCollection', features }, step };
}
