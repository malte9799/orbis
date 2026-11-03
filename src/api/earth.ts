import type { Feature, FeatureCollection, Geometry, Point } from 'geojson';
import { fetchJson } from '../util';
import { uTok } from '../units';
import { fetchText, mirrorJson, snapshotJson, snapshotText } from './data';

// Earth & environment layers. All sources are free and keyless.

const point = (lon: number, lat: number, properties: Record<string, unknown>): Feature<Point> => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [lon, lat] },
  properties,
});

// ---------------------------------------------------------------------------
// Aurora – NOAA SWPC OVATION model: probability of visible aurora for the next 30–90 min
// on a 1° grid, plus the current planetary Kp index.

export interface AuroraResult {
  fc: FeatureCollection<Point>;
  forecastTime: string;
  kp: number | null;
}

export async function loadAurora(): Promise<AuroraResult> {
  const [ovation, kp] = await Promise.all([
    mirrorJson('space/swpc/ovation_aurora_latest.json', () =>
      fetchJson<{ 'Forecast Time': string; coordinates: [number, number, number][] }>('https://services.swpc.noaa.gov/json/ovation_aurora_latest.json', undefined, 25000),
    ),
    mirrorJson('space/swpc/noaa-planetary-k-index.json', () =>
      fetchJson<(string | number)[][] | { Kp?: number; kp_index?: number }[]>('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json'),
    ).catch(() => null),
  ]);
  const features: Feature<Point>[] = [];
  for (const [lon, lat, v] of ovation.coordinates) {
    if (v < 3) continue;
    features.push(point(lon > 180 ? lon - 360 : lon, lat, { v }));
  }
  let kpNow: number | null = null;
  if (Array.isArray(kp) && kp.length > 1) {
    const last = kp[kp.length - 1] as unknown;
    // array form: [time_tag, Kp, a_running, station_count] with a header row; object form: { Kp }
    kpNow = Array.isArray(last) ? parseFloat(String(last[1])) : Number((last as { Kp?: number; kp_index?: number }).Kp ?? (last as { kp_index?: number }).kp_index);
    if (!Number.isFinite(kpNow)) kpNow = null;
  }
  return { fc: { type: 'FeatureCollection', features }, forecastTime: ovation['Forecast Time'], kp: kpNow };
}

// ---------------------------------------------------------------------------
// Space weather – NOAA SWPC solar wind (DSCOVR/ACE) and GOES X-ray flux, shown with the aurora layer.

export interface SpaceWeather {
  windKmS: number | null;
  bz: number | null;
  xray: string | null;
}

const xrayClass = (flux: number) => {
  const c = flux >= 1e-4 ? 'X' : flux >= 1e-5 ? 'M' : flux >= 1e-6 ? 'C' : flux >= 1e-7 ? 'B' : 'A';
  const base = { X: 1e-4, M: 1e-5, C: 1e-6, B: 1e-7, A: 1e-8 }[c]!;
  return `${c}${(flux / base).toFixed(1)}`;
};

const SWPC = 'https://services.swpc.noaa.gov';
const num = (v: unknown) => (v == null || v === '' ? NaN : Number(v));

/** Newest RTSW row of the active spacecraft (rows are unordered across sources); falls back to the newest row overall. */
export function pickRtsw<T extends object>(rows: unknown, field: keyof T): (T & { time_tag?: string; active?: boolean }) | null {
  if (!Array.isArray(rows)) return null;
  const ok = (rows as (T & { time_tag?: string; active?: boolean })[]).filter((r) => r && Number.isFinite(num((r as Record<keyof T, unknown>)[field])) && num((r as Record<keyof T, unknown>)[field]) > -9990);
  const pool = ok.some((r) => r.active) ? ok.filter((r) => r.active) : ok;
  return pool.reduce<(T & { time_tag?: string; active?: boolean }) | null>((best, r) => (!best || String(r.time_tag) > String(best.time_tag) ? r : best), null);
}

// The tiny summary endpoints (~60 B, integer-rounded) are preferred; the 1-minute RTSW feeds (MBs) only serve as fallback.
export async function loadSpaceWeather(): Promise<SpaceWeather> {
  const [spd, mg, xr] = await Promise.allSettled([
    fetchJson<{ proton_speed?: number }[]>(`${SWPC}/products/summary/solar-wind-speed.json`),
    fetchJson<{ bz_gsm?: number }[]>(`${SWPC}/products/summary/solar-wind-mag-field.json`),
    mirrorJson('space/swpc/xrays-1-day.json', () => fetchJson<{ flux?: number; energy?: string }[]>(`${SWPC}/json/goes/primary/xrays-1-day.json`)),
  ]);
  let speed = spd.status === 'fulfilled' && Array.isArray(spd.value) ? num(spd.value[0]?.proton_speed) : NaN;
  let bz = mg.status === 'fulfilled' && Array.isArray(mg.value) ? num(mg.value[0]?.bz_gsm) : NaN;
  if (!Number.isFinite(speed)) {
    const w = await fetchJson<unknown>(`${SWPC}/json/rtsw/rtsw_wind_1m.json`, undefined, 25000).catch(() => null);
    speed = num(pickRtsw<{ proton_speed?: number }>(w, 'proton_speed')?.proton_speed);
  }
  if (!Number.isFinite(bz)) {
    const m = await fetchJson<unknown>(`${SWPC}/json/rtsw/rtsw_mag_1m.json`, undefined, 25000).catch(() => null);
    bz = num(pickRtsw<{ bz_gsm?: number }>(m, 'bz_gsm')?.bz_gsm);
  }
  let xray: string | null = null;
  if (xr.status === 'fulfilled') {
    const long = xr.value.filter((x) => x.energy === '0.1-0.8nm' && Number(x.flux) > 0);
    if (long.length) xray = xrayClass(Number(long[long.length - 1].flux));
  }
  return { windKmS: Number.isFinite(speed) ? speed : null, bz: Number.isFinite(bz) ? bz : null, xray };
}

// ---------------------------------------------------------------------------
// Volcanoes – Smithsonian Global Volcanism Program, Holocene volcano list (~1,300).

export async function loadGvpVolcanoes(): Promise<FeatureCollection<Point>> {
  const url =
    'https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows?service=WFS&version=2.0.0&request=GetFeature&typeName=GVP-VOTW:Smithsonian_VOTW_Holocene_Volcanoes&outputFormat=application%2Fjson';
  const json = await snapshotJson('volcanoes.json', () => fetchJson<FeatureCollection<Point, Record<string, unknown>>>(url, undefined, 30000));
  const year = new Date().getUTCFullYear();
  return {
    type: 'FeatureCollection',
    features: json.features
      .filter((f) => f.geometry?.type === 'Point')
      .map((f) => {
        const p = f.properties ?? {};
        const last = Number(p.Last_Eruption_Year ?? p.LastEruptionYear);
        const recent = Number.isFinite(last) && last >= year - 1;
        const historic = Number.isFinite(last) && last >= 1900;
        const vn = p.Volcano_Number ?? p.VolcanoNumber;
        return point(f.geometry.coordinates[0], f.geometry.coordinates[1], {
          title: p.Volcano_Name ?? p.VolcanoName ?? 'Vulkan',
          subtitle: [p.Primary_Volcano_Type, p.Country, p.Elevation != null ? uTok('height', Number(p.Elevation)) : ''].filter(Boolean).join(' · '),
          description: Number.isFinite(last) ? `Letzter bekannter Ausbruch: ${last < 0 ? `${-last} v. Chr.` : last}` : 'Kein Ausbruch seit 1500 belegt',
          state: recent ? 'recent' : historic ? 'historic' : 'old',
          color: recent ? '#ff3d00' : historic ? '#ff9800' : '#9e8f80',
          url: vn != null ? `https://volcano.si.edu/volcano.cfm?vn=${encodeURIComponent(String(vn))}` : 'https://volcano.si.edu/',
          source: 'Smithsonian GVP',
        });
      }),
  };
}

// ---------------------------------------------------------------------------
// Wildfire perimeters (USA) – NIFC WFIGS current interagency perimeters (ArcGIS, public).

export async function loadFirePerimeters(): Promise<FeatureCollection<Geometry>> {
  const q = new URLSearchParams({
    where: '1=1',
    outFields: 'poly_IncidentName,poly_GISAcres,attr_PercentContained,attr_FireDiscoveryDateTime,attr_IncidentSize,attr_POOState',
    f: 'geojson',
    geometryPrecision: '4',
    maxAllowableOffset: '0.002',
  });
  const json = await fetchJson<FeatureCollection<Geometry, Record<string, unknown>>>(
    `https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters_Current/FeatureServer/0/query?${q}`,
    undefined,
    30000,
  );
  return {
    type: 'FeatureCollection',
    features: json.features
      .filter((f) => f.geometry)
      .map((f) => {
        const p = f.properties ?? {};
        const acres = Number(p.poly_GISAcres ?? p.attr_IncidentSize);
        const contained = p.attr_PercentContained;
        const disc = Number(p.attr_FireDiscoveryDateTime);
        return {
          type: 'Feature' as const,
          geometry: f.geometry,
          properties: {
            title: `${String(p.poly_IncidentName ?? 'Waldbrand').trim()} Fire`,
            subtitle: [
              Number.isFinite(acres) ? uTok('acres', acres, 0) : '',
              contained != null ? `${contained} % eingedämmt` : '',
              String(p.attr_POOState ?? '').replace('US-', ''),
            ]
              .filter(Boolean)
              .join(' · '),
            date: Number.isFinite(disc) ? new Date(disc).toISOString() : '',
            source: 'NIFC WFIGS',
            url: 'https://data-nifc.opendata.arcgis.com/',
          },
        };
      }),
  };
}

// ---------------------------------------------------------------------------
// Tsunami messages – NOAA National / Pacific Tsunami Warning Centers (Atom feeds).

export async function loadTsunami(): Promise<FeatureCollection<Point>> {
  const feeds = ['PAAQ', 'PHEB'];
  const results = await Promise.allSettled(
    feeds.map(async (f) => {
      const xml = await snapshotText(`tsunami/${f}.xml`, () => fetchText(`https://www.tsunami.gov/events/xml/${f}Atom.xml`));
      return new DOMParser().parseFromString(xml, 'application/xml');
    }),
  );
  if (results.every((r) => r.status === 'rejected')) throw (results[0] as PromiseRejectedResult).reason;
  const features: Feature<Point>[] = [];
  const seen = new Set<string>();
  const cutoff = Date.now() - 7 * 86400000;
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const entry of Array.from(r.value.getElementsByTagName('entry'))) {
      const txt = (name: string) => entry.getElementsByTagNameNS('*', name)[0]?.textContent?.trim() ?? '';
      const lat = parseFloat(txt('lat'));
      const lon = parseFloat(txt('long'));
      const updated = txt('updated');
      const title = txt('title');
      const id = txt('id') || `${title}${updated}`;
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || seen.has(id) || Date.parse(updated) < cutoff) continue;
      seen.add(id);
      const summary = txt('summary').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      const level = /warning/i.test(summary) ? 'warning' : /advisory/i.test(summary) ? 'advisory' : /watch/i.test(summary) ? 'watch' : 'info';
      const link = entry.getElementsByTagName('link')[0]?.getAttribute('href') ?? 'https://www.tsunami.gov/';
      features.push(
        point(lon, lat, {
          title: title || 'Tsunami-Meldung',
          subtitle: { warning: 'Tsunami-Warnung', advisory: 'Tsunami-Hinweis', watch: 'Tsunami-Vorwarnung', info: 'Information (keine Gefahr)' }[level],
          description: summary,
          date: updated,
          level,
          color: { warning: '#d50000', advisory: '#ff9100', watch: '#ffd600', info: '#4fc3f7' }[level],
          url: link,
          source: 'NOAA Tsunami Warning Centers',
        }),
      );
    }
  }
  return { type: 'FeatureCollection', features };
}

// ---------------------------------------------------------------------------
// Radioactivity – ambient dose rate in µSv/h:
// • BfS ODL measuring network (~1,700 probes in Germany, hourly, Datenlizenz DE 2.0)
// • STUK Finland via FMI open data (~250 stations, 10-min mean, CC BY 4.0)
// • Health Canada Fixed Point Surveillance Network (~80 stations, Open Government Licence – Canada)
// • Safecast real-time sensors worldwide (CC0)

/** Colour for an ambient dose rate (µSv/h). */
export function doseColor(v: number) {
  return v < 0.1 ? '#2ecc71' : v < 0.15 ? '#a3d93b' : v < 0.25 ? '#f1c40f' : v < 0.5 ? '#ff9800' : v < 1 ? '#f4511e' : '#c2185b';
}

export async function loadRadiation(): Promise<{ fc: FeatureCollection<Point>; failed: string[] }> {
  const [bfs, fi, ca, safecast] = await Promise.allSettled([loadBfs(), loadStuk(), loadHc(), loadSafecast()]);
  const failed: string[] = [];
  const features: Feature<Point>[] = [];
  if (bfs.status === 'fulfilled') features.push(...bfs.value);
  else failed.push('BfS');
  if (fi.status === 'fulfilled') features.push(...fi.value);
  else failed.push('STUK (FI)');
  if (ca.status === 'fulfilled') features.push(...ca.value);
  else failed.push('Health Canada');
  if (safecast.status === 'fulfilled') features.push(...safecast.value);
  else failed.push('Safecast');
  if (failed.length === 4) throw (bfs as PromiseRejectedResult).reason;
  return { fc: { type: 'FeatureCollection', features }, failed };
}

type RawFc = FeatureCollection<Point, Record<string, unknown>>;

/** Live BfS ODL download (also used by scripts/fetch-data.ts for the data-branch snapshot). */
export function fetchBfsRaw() {
  return fetchJson<RawFc>(
    'https://www.imis.bfs.de/ogc/opendata/ows?service=WFS&version=1.1.0&request=GetFeature&typeName=opendata:odlinfo_odl_1h_latest&outputFormat=application/json',
    undefined,
    30000,
  );
}

async function loadBfs(): Promise<Feature<Point>[]> {
  const json = await snapshotJson('bfs-odl.json', fetchBfsRaw);
  return json.features
    .filter((f) => f.geometry && Number.isFinite(Number(f.properties?.value)))
    .map((f) => {
      const p = f.properties!;
      const v = Number(p.value);
      return point(f.geometry.coordinates[0], f.geometry.coordinates[1], {
        v,
        color: doseColor(v),
        label: v.toFixed(2),
        title: `ODL-Messstelle ${p.name ?? ''}`.trim(),
        subtitle: `${v.toLocaleString('de-DE', { maximumFractionDigits: 3 })} µSv/h · Stundenmittel${p.height_above_sea != null ? ` · ${uTok('height', Number(p.height_above_sea))} ü. NN` : ''}`,
        date: p.end_measure ?? '',
        url: `https://odlinfo.bfs.de/ODL/DE/themen/wo-stehen-die-sonden/karte/karte_node.html`,
        source: 'Bundesamt für Strahlenschutz (ODL)',
      });
    });
}

/** Compact snapshot record of one national-network station: [name, lon, lat, dose rate µSv/h, unix seconds]. */
export type RadiationStation = [name: string, lon: number, lat: number, usvh: number, time: number];

const STUK_URL = 'https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=GetFeature&storedquery_id=stuk::observations::external-radiation::latest::multipointcoverage';
const HC_URL = 'https://maps-cartes.services.geo.ca/server_serveur/rest/services/HC/fpsn_en/MapServer/1/query?where=1%3D1&outFields=*&f=geojson&outSR=4326';
const STALE_MS = 48 * 3600000;
const r4 = (n: number) => Math.round(n * 1e4) / 1e4;
const unXml = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

/**
 * Parses the STUK external-radiation multipointcoverage (FMI open data WFS, Finland, ~250 stations): station names
 * and positions come from the gml:Point members, the 10-min average dose rate (DR_PT10M_avg, µSv/h) from the tuple
 * list, the observation time from the positions. Regex based on purpose – works in the browser and in Node (no DOMParser).
 * Stations without a value or older than 48 h are dropped.
 */
export function parseStukXml(xml: string, now = Date.now()): RadiationStation[] {
  const fields = [...xml.matchAll(/<swe:field\s+name="([^"]+)"/g)].map((m) => m[1]);
  const col = fields.indexOf('DR_PT10M_avg');
  const tuples = /<gml:doubleOrNilReasonTupleList>([\s\S]*?)<\/gml:doubleOrNilReasonTupleList>/.exec(xml)?.[1];
  const positions = /<gmlcov:positions>([\s\S]*?)<\/gmlcov:positions>/.exec(xml)?.[1];
  if (col < 0 || !tuples || !positions) return [];
  const rows = (t: string) => t.split('\n').map((l) => l.trim().split(/\s+/)).filter((c) => c[0]);
  const vals = rows(tuples);
  const pos = rows(positions); // lat lon [alt] unix-seconds
  const names = [...xml.matchAll(/<gml:Point\s+gml:id="point-[^"]*"[^>]*>\s*<gml:name>([^<]*)<\/gml:name>/g)].map((m) => unXml(m[1].trim()));
  const out: RadiationStation[] = [];
  for (let i = 0; i < Math.min(vals.length, pos.length); i++) {
    const v = Number(vals[i][col]);
    const lat = Number(pos[i][0]);
    const lon = Number(pos[i][1]);
    const t = Number(pos[i][pos[i].length - 1]);
    if (!Number.isFinite(v) || v <= 0 || !Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(t) || now - t * 1000 > STALE_MS) continue;
    out.push([names[i] ?? '', r4(lon), r4(lat), v, t]);
  }
  return out;
}

/** Live STUK download (Finland, via FMI; CORS enabled). Also used by the orbis-data collector for the stuk-fi.json snapshot. */
export async function fetchStukStations(): Promise<RadiationStation[]> {
  const list = parseStukXml(await fetchText(STUK_URL, 30000));
  if (!list.length) throw new Error('STUK: no stations in response');
  return list;
}

/**
 * Packs the Health Canada Fixed Point Surveillance Network layer (GeoJSON, nSv/h) into snapshot records in µSv/h.
 * The station name is the layer's location_name without the trailing "_lat_lon". Readings older than 48 h are dropped.
 */
export function packHcStations(fc: FeatureCollection<Geometry, Record<string, unknown>>, now = Date.now()): RadiationStation[] {
  const out: RadiationStation[] = [];
  for (const f of fc.features ?? []) {
    const p = f.properties ?? {};
    const v = Number(p.latest_value_nSvHr) / 1000;
    const t = Number(p.time);
    if (f.geometry?.type !== 'Point' || !Number.isFinite(v) || v <= 0 || !Number.isFinite(t) || now - t > STALE_MS) continue;
    const [lon, lat] = f.geometry.coordinates;
    out.push([String(p.location_name ?? '').replace(/_-?\d+\.\d+_-?\d+\.\d+$/, ''), r4(lon), r4(lat), Math.round(v * 1e4) / 1e4, Math.round(t / 1000)]);
  }
  return out;
}

/** Live Health Canada download (CORS enabled). Also used by the orbis-data collector for the hc-ca.json snapshot. */
export async function fetchHcStations(): Promise<RadiationStation[]> {
  const list = packHcStations(await fetchJson<RawFc>(HC_URL, undefined, 30000));
  if (!list.length) throw new Error('Health Canada: no current stations');
  return list;
}

function stationFeatures(list: RadiationStation[], o: { what: string; country: string; url: string; source: string }): Feature<Point>[] {
  return list.map(([name, lon, lat, v, t]) =>
    point(lon, lat, {
      v,
      color: doseColor(v),
      label: v.toFixed(2),
      title: `${o.what} ${name}`.trim(),
      subtitle: `${v.toLocaleString('de-DE', { maximumFractionDigits: 3 })} µSv/h · ${o.country}`,
      date: new Date(t * 1000).toISOString(),
      url: o.url,
      source: o.source,
    }),
  );
}

async function loadStuk() {
  return stationFeatures(await snapshotJson('stuk-fi.json', fetchStukStations), {
    what: 'Messstelle',
    country: 'Finnland · 10-Min-Mittel',
    url: 'https://www.stuk.fi/en',
    source: 'Säteilyturvakeskus STUK / Ilmatieteen laitos (FMI), CC BY 4.0',
  });
}

async function loadHc() {
  return stationFeatures(await snapshotJson('hc-ca.json', fetchHcStations), {
    what: 'Messstelle',
    country: 'Kanada',
    url: 'https://maps-cartes.services.geo.ca/server_serveur/rest/services/HC/fpsn_en/MapServer',
    source: 'Health Canada (Fixed Point Surveillance Network), Open Government Licence – Canada',
  });
}

interface SafecastDevice {
  device_urn?: string;
  device?: number;
  when_captured?: string;
  loc_lat?: number;
  loc_lon?: number;
  loc_name?: string;
  loc_country?: string;
  lnd_7318u?: number;
  lnd_7318c?: number;
  lnd_7128ec?: number;
  lnd_712u?: number;
}

async function loadSafecast(): Promise<Feature<Point>[]> {
  const list = await snapshotJson('safecast.json', () => fetchJson<SafecastDevice[]>('https://tt.safecast.org/devices', undefined, 30000));
  const cutoff = Date.now() - 3 * 86400000;
  const out: Feature<Point>[] = [];
  for (const d of list) {
    if (d.loc_lat == null || d.loc_lon == null || !d.when_captured || Date.parse(d.when_captured) < cutoff) continue;
    // counts per minute → µSv/h with the tube's conversion factor
    const usv = d.lnd_7318u != null ? d.lnd_7318u / 334 : d.lnd_7318c != null ? d.lnd_7318c / 334 : d.lnd_7128ec != null ? d.lnd_7128ec / 108 : d.lnd_712u != null ? d.lnd_712u / 108 : NaN;
    if (!Number.isFinite(usv) || usv <= 0 || usv > 100) continue;
    out.push(
      point(d.loc_lon, d.loc_lat, {
        v: usv,
        color: doseColor(usv),
        label: usv.toFixed(2),
        title: `Safecast-Sensor ${d.loc_name ?? d.device_urn ?? ''}`.trim(),
        subtitle: `${usv.toLocaleString('de-DE', { maximumFractionDigits: 3 })} µSv/h${d.loc_country ? ` · ${d.loc_country}` : ''}`,
        date: d.when_captured,
        url: 'https://map.safecast.org/',
        source: 'Safecast (CC0)',
      }),
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// Tropical cyclones – NOAA National Hurricane Center / Central Pacific Hurricane Center (Atlantic,
// eastern and central North Pacific): official forecast points, track and cone of the latest
// advisory plus the past track, from NOAA's tropical weather summary MapServer (CORS enabled).
// The cone is the uncertainty of the centre's track, not the storm's size.

const NHC_MAP = 'https://mapservices.weather.noaa.gov/tropical/rest/services/tropical/NHC_tropical_weather_summary/MapServer';

/** Saffir-Simpson class of a hurricane from its sustained wind in knots. */
export const saffirSimpson = (kt: number) => (kt >= 137 ? 5 : kt >= 113 ? 4 : kt >= 96 ? 3 : kt >= 83 ? 2 : kt >= 64 ? 1 : 0);

export async function loadCyclones(): Promise<FeatureCollection<Geometry>> {
  // part → MapServer layer: forecast points, forecast track, cone, past points, past track
  const parts: [string, number][] = [['point', 5], ['fcst', 6], ['cone', 7], ['pastpt', 10], ['past', 11]];
  const results = await Promise.all(
    parts.map(([part, layer]) =>
      mirrorJson(`cyclones/nhc-${part}.geojson`, () =>
        fetchJson<FeatureCollection<Geometry, Record<string, unknown>>>(`${NHC_MAP}/${layer}/query?where=1%3D1&outFields=*&f=geojson`, undefined, 30000),
      ).then((fc) =>
        fc.features.filter((f) => f.geometry).map((f): Feature<Geometry, Record<string, unknown>> => ({ ...f, properties: { ...f.properties, part } })),
      ),
    ),
  );
  const features = results.flat();
  // the storm's current position (tau 0) is the reference longitude; everything of the same storm is
  // unwrapped around it, so tracks crossing the date line do not jump across the map
  const ref = new Map<string, number>();
  for (const f of features) if (f.properties.part === 'point' && Number(f.properties.tau) === 0 && f.geometry.type === 'Point') ref.set(String(f.properties.binnumber), f.geometry.coordinates[0]);
  const near = (lon: number, to: number) => lon + 360 * Math.round((to - lon) / 360);
  const unwrap = (ring: number[][], start: number) => {
    let prev = start;
    return ring.map(([x, y]) => {
      const nx = near(x, prev);
      prev = nx;
      return [nx, y];
    });
  };
  for (const f of features) {
    const r = ref.get(String(f.properties.binnumber));
    if (r == null) continue;
    const g = f.geometry;
    if (g.type === 'Point') g.coordinates = [near(g.coordinates[0], r), g.coordinates[1]];
    else if (g.type === 'LineString') g.coordinates = unwrap(g.coordinates, r);
    else if (g.type === 'MultiLineString') g.coordinates = g.coordinates.map((l) => unwrap(l, r));
    else if (g.type === 'Polygon') g.coordinates = g.coordinates.map((l) => unwrap(l, r));
    else if (g.type === 'MultiPolygon') g.coordinates = g.coordinates.map((p) => p.map((l) => unwrap(l, r)));
  }
  for (const f of features) {
    const p = f.properties;
    if (p.part === 'point') p.cat = p.dvlbl === 'H' || p.dvlbl === 'M' ? saffirSimpson(Number(p.maxwind)) : 0;
  }
  return { type: 'FeatureCollection', features };
}

// ---------------------------------------------------------------------------
// Air quality health index (AQHI) – Environment and Climate Change Canada, MSC GeoMet OGC API:
// the latest hourly observation of ~120 stations in Canada (Open Government Licence – Canada).

export async function loadAqhi(): Promise<FeatureCollection<Point>> {
  const fc = await fetchJson<FeatureCollection<Point, { location_name_en?: string; location_name_fr?: string; aqhi?: number; observation_datetime?: string; observation_datetime_text_en?: string }>>(
    'https://api.weather.gc.ca/collections/aqhi-observations-realtime/items?f=json&latest=true&limit=500',
    undefined,
    30000,
  );
  return {
    type: 'FeatureCollection',
    features: fc.features
      .filter((f) => f.geometry && Number.isFinite(f.properties.aqhi))
      .map((f) => point(f.geometry.coordinates[0], f.geometry.coordinates[1], { name: f.properties.location_name_en ?? '', aqhi: Number(f.properties.aqhi), date: f.properties.observation_datetime ?? '' })),
  };
}
