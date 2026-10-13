import type { Feature, FeatureCollection, Geometry, Point } from 'geojson';
import { fetchJson } from '../util';

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
// Volcanoes – Smithsonian Global Volcanism Program, Holocene volcano list (~1,300).

export async function loadGvpVolcanoes(): Promise<FeatureCollection<Point>> {
  const url =
    'https://webservices.volcano.si.edu/geoserver/GVP-VOTW/ows?service=WFS&version=2.0.0&request=GetFeature&typeName=GVP-VOTW:Smithsonian_VOTW_Holocene_Volcanoes&outputFormat=application%2Fjson';
  const json = await fetchJson<FeatureCollection<Point, Record<string, unknown>>>(url, undefined, 30000);
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
          subtitle: [p.Primary_Volcano_Type, p.Country, p.Elevation != null ? `${p.Elevation} m` : ''].filter(Boolean).join(' · '),
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
              Number.isFinite(acres) ? `${Math.round(acres * 0.404686).toLocaleString('de-DE')} ha` : '',
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
  const feeds = ['https://www.tsunami.gov/events/xml/PAAQAtom.xml', 'https://www.tsunami.gov/events/xml/PHEBAtom.xml'];
  const results = await Promise.allSettled(
    feeds.map(async (u) => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20000);
      try {
        const res = await fetch(u, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return new DOMParser().parseFromString(await res.text(), 'application/xml');
      } finally {
        clearTimeout(timer);
      }
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
  const [bfs, safecast] = await Promise.allSettled([loadBfs(), loadSafecast()]);
  const failed: string[] = [];
  const features: Feature<Point>[] = [];
  if (bfs.status === 'fulfilled') features.push(...bfs.value);
  else failed.push('BfS');
  if (safecast.status === 'fulfilled') features.push(...safecast.value);
  else failed.push('Safecast');
  if (failed.length === 2) throw (bfs as PromiseRejectedResult).reason;
  return { fc: { type: 'FeatureCollection', features }, failed };
}

async function loadBfs(): Promise<Feature<Point>[]> {
  const json = await fetchJson<FeatureCollection<Point, Record<string, unknown>>>(
    'https://www.imis.bfs.de/ogc/opendata/ows?service=WFS&version=1.1.0&request=GetFeature&typeName=opendata:odlinfo_odl_1h_latest&outputFormat=application/json',
    undefined,
    30000,
  );
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
        subtitle: `${v.toLocaleString('de-DE', { maximumFractionDigits: 3 })} µSv/h · Stundenmittel${p.height_above_sea != null ? ` · ${p.height_above_sea} m ü. NN` : ''}`,
        date: p.end_measure ?? '',
        url: `https://odlinfo.bfs.de/ODL/DE/themen/wo-stehen-die-sonden/karte/karte_node.html`,
        source: 'Bundesamt für Strahlenschutz (ODL)',
      });
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
  const list = await fetchJson<SafecastDevice[]>('https://tt.safecast.org/devices', undefined, 30000);
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
