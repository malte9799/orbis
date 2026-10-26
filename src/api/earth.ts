import type { Feature, FeatureCollection, Geometry, Point } from 'geojson';
import { fetchJson } from '../util';
import { uTok } from '../units';
import { fetchText, snapshotJson, snapshotText } from './data';

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
    fetchJson<{ 'Forecast Time': string; coordinates: [number, number, number][] }>('https://services.swpc.noaa.gov/json/ovation_aurora_latest.json', undefined, 25000),
    fetchJson<(string | number)[][] | { Kp?: number; kp_index?: number }[]>('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json').catch(() => null),
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

export async function loadSpaceWeather(): Promise<SpaceWeather> {
  const last = (rows: unknown) => (Array.isArray(rows) && rows.length > 1 ? (rows[rows.length - 1] as unknown[]) : null);
  const [plasma, mag, xr] = await Promise.allSettled([
    fetchJson<unknown>('https://services.swpc.noaa.gov/products/solar-wind/plasma-2-hour.json'),
    fetchJson<unknown>('https://services.swpc.noaa.gov/products/solar-wind/mag-2-hour.json'),
    fetchJson<{ flux?: number; energy?: string }[]>('https://services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json'),
  ]);
  const pRow = plasma.status === 'fulfilled' ? last(plasma.value) : null;
  const mRow = mag.status === 'fulfilled' ? last(mag.value) : null;
  const speed = pRow ? parseFloat(String(pRow[2])) : NaN;
  const bz = mRow ? parseFloat(String(mRow[3])) : NaN;
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
// • Safecast real-time sensors worldwide (CC0)

/** Colour for an ambient dose rate (µSv/h). */
export function doseColor(v: number) {
  return v < 0.1 ? '#2ecc71' : v < 0.15 ? '#a3d93b' : v < 0.25 ? '#f1c40f' : v < 0.5 ? '#ff9800' : v < 1 ? '#f4511e' : '#c2185b';
}

export async function loadRadiation(): Promise<{ fc: FeatureCollection<Point>; failed: string[] }> {
  const [bfs, eurdep, safecast] = await Promise.allSettled([loadBfs(), loadEurdep(), loadSafecast()]);
  const failed: string[] = [];
  const features: Feature<Point>[] = [];
  if (bfs.status === 'fulfilled') features.push(...bfs.value);
  else failed.push('BfS');
  // EURDEP contains the German probes too – skip them when the BfS network loaded
  if (eurdep.status === 'fulfilled') features.push(...eurdep.value.filter((f) => bfs.status !== 'fulfilled' || !String(f.properties?.sid).startsWith('DE')));
  else failed.push('EURDEP');
  if (safecast.status === 'fulfilled') features.push(...safecast.value);
  else failed.push('Safecast');
  if (failed.length === 3) throw (bfs as PromiseRejectedResult).reason;
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

/**
 * Live EURDEP download – European Radiological Data Exchange Platform (~3,500 probes in 40+ countries),
 * via BfS. Also used by scripts/fetch-data.ts for the data-branch snapshot.
 */
export async function fetchEurdepRaw(): Promise<Feature<Point, Record<string, unknown>>[]> {
  // the server caps every page at 1,000 features regardless of `count`; each probe is stored once per
  // averaging period, so request only the 6 h series (all probes report it) to keep the paging short
  const base =
    'https://www.imis.bfs.de/ogc/opendata/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=opendata:eurdep_latestValue&outputFormat=application/json&sortBy=id&count=1000&cql_filter=' +
    encodeURIComponent('analyzed_range_in_h=6');
  const best = new Map<string, Feature<Point, Record<string, unknown>>>();
  for (let start = 0; start < 20000; start += 1000) {
    const page = await fetchJson<RawFc>(`${base}&startIndex=${start}`, undefined, 40000).catch((e) => {
      if (start === 0) throw e;
      return { type: 'FeatureCollection' as const, features: [] };
    });
    // keep the most recent value per probe, trimmed to the fields we use
    for (const f of page.features) {
      const p = f.properties ?? {};
      const id = String(p.id ?? '');
      const prev = best.get(id);
      if (f.geometry && (!prev || String(p.end_measure ?? '') > String(prev.properties.end_measure ?? ''))) {
        best.set(id, { type: 'Feature', geometry: f.geometry, properties: { id: p.id, name: p.name, value: p.value, unit: p.unit, end_measure: p.end_measure } });
      }
    }
    if (page.features.length < 1000) break;
  }
  return [...best.values()];
}

async function loadEurdep(): Promise<Feature<Point>[]> {
  const raw = await snapshotJson('eurdep.json', fetchEurdepRaw);
  const out: Feature<Point>[] = [];
  for (const f of raw) {
    const p = f.properties;
    if (!f.geometry) continue;
    let v = Number(p.value);
    const unit = String(p.unit ?? 'µSv/h');
    if (/nsv/i.test(unit)) v /= 1000;
    if (!Number.isFinite(v) || v <= 0) continue;
    out.push(
      point(f.geometry.coordinates[0], f.geometry.coordinates[1], {
        sid: p.id,
        v,
        color: doseColor(v),
        label: v.toFixed(2),
        title: `Messstelle ${String(p.name ?? p.id)}`,
        subtitle: `${v.toLocaleString('de-DE', { maximumFractionDigits: 3 })} µSv/h · ${String(p.id).slice(0, 2)}`,
        date: p.end_measure ?? '',
        url: 'https://remap.jrc.ec.europa.eu/Advanced.aspx',
        source: 'EURDEP (EU-Kommission, JRC) via BfS',
      }),
    );
  }
  return out;
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
