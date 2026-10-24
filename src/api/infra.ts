import type { Feature, FeatureCollection, Geometry, Point } from 'geojson';
import { store } from '../store';
import { fetchJson, fmt } from '../util';
import { snapshotJson } from './data';
import { overpass } from './overpass';

// ---------------------------------------------------------------------------
// Shipping lanes – "Global Shipping Lanes" by P. Benden (CC BY 4.0), static GeoJSON on GitHub

export async function loadShippingLanes(): Promise<FeatureCollection> {
  const data = await fetchJson<FeatureCollection<Geometry, { Type?: string }>>(
    'https://raw.githubusercontent.com/newzealandpaul/Shipping-Lanes/main/data/Shipping_Lanes_v1.geojson',
    undefined,
    40000,
  );
  data.features.forEach((f) => {
    f.properties = { type: (f.properties?.Type ?? 'Minor').toLowerCase() } as never;
  });
  return data;
}

// ---------------------------------------------------------------------------
// Submarine telecom cables – OpenStreetMap (ODbL). The worldwide Overpass query is too heavy for
// every browser, so the data workflow stores it daily in the data branch (scripts/fetch-data.ts).

export const loadCables = () => snapshotJson<FeatureCollection>('osm-cables/cables.json', undefined, 40000);

// ---------------------------------------------------------------------------
// Internet exchange points – PeeringDB (free, open API); located via their facilities

export async function loadIxps(): Promise<FeatureCollection<Point>> {
  const cached = store.cacheGet<FeatureCollection<Point>>('ixp', 24 * 3600 * 1000);
  if (cached) return cached;
  const base = 'https://www.peeringdb.com/api';
  const [ix, ixfac, fac] = await Promise.all([
    fetchJson<{ data: { id: number; name: string; name_long?: string; city?: string; country?: string; website?: string; net_count?: number }[] }>(
      `${base}/ix?fields=id,name,name_long,city,country,website,net_count`,
      undefined,
      40000,
    ),
    fetchJson<{ data: { ix_id: number; fac_id: number }[] }>(`${base}/ixfac?fields=ix_id,fac_id`, undefined, 40000),
    fetchJson<{ data: { id: number; latitude: number | null; longitude: number | null }[] }>(
      `${base}/fac?fields=id,latitude,longitude`,
      undefined,
      40000,
    ),
  ]);
  const facPos = new Map<number, [number, number]>();
  for (const f of fac.data) if (f.latitude != null && f.longitude != null) facPos.set(f.id, [f.longitude, f.latitude]);
  const ixPos = new Map<number, [number, number][]>();
  for (const l of ixfac.data) {
    const p = facPos.get(l.fac_id);
    if (!p) continue;
    const list = ixPos.get(l.ix_id) ?? [];
    list.push(p);
    ixPos.set(l.ix_id, list);
  }
  const features: Feature<Point>[] = [];
  for (const x of ix.data) {
    const ps = ixPos.get(x.id);
    if (!ps?.length) continue;
    const lon = ps.reduce((s, p) => s + p[0], 0) / ps.length;
    const lat = ps.reduce((s, p) => s + p[1], 0) / ps.length;
    const nets = x.net_count ?? 0;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [+lon.toFixed(4), +lat.toFixed(4)] },
      properties: {
        title: `Internetknoten ${x.name}`,
        subtitle: [x.name_long !== x.name ? x.name_long : '', [x.city, x.country].filter(Boolean).join(', '), `${nets} Netze`, `${ps.length} Rechenzentren`]
          .filter(Boolean)
          .join(' · '),
        url: `https://www.peeringdb.com/ix/${x.id}`,
        nets,
      },
    });
  }
  const fc: FeatureCollection<Point> = { type: 'FeatureCollection', features };
  store.cacheSet('ixp', fc);
  return fc;
}

// ---------------------------------------------------------------------------
// Power plants – WRI Global Power Plant Database (CC BY 4.0, ~35 000 plants worldwide)

export type PowerCat = 'wind' | 'solar' | 'hydro' | 'nuclear' | 'coal' | 'gas' | 'oil' | 'biomass' | 'other';

export const FUELS: Record<string, { label: string; color: string; cat: PowerCat }> = {
  Wind: { label: 'Windkraft', color: '#4fc3f7', cat: 'wind' },
  Solar: { label: 'Solar', color: '#ffd54f', cat: 'solar' },
  Hydro: { label: 'Wasserkraft', color: '#1e88e5', cat: 'hydro' },
  Nuclear: { label: 'Kernkraft', color: '#ba68c8', cat: 'nuclear' },
  Coal: { label: 'Kohle', color: '#8d6e63', cat: 'coal' },
  Petcoke: { label: 'Petrolkoks', color: '#a1887f', cat: 'coal' },
  Gas: { label: 'Gas', color: '#ff7043', cat: 'gas' },
  Oil: { label: 'Öl', color: '#a1887f', cat: 'oil' },
  Biomass: { label: 'Biomasse', color: '#66bb6a', cat: 'biomass' },
  Waste: { label: 'Müll', color: '#9e9d24', cat: 'biomass' },
  Geothermal: { label: 'Geothermie', color: '#ef5350', cat: 'other' },
  Storage: { label: 'Speicher', color: '#26a69a', cat: 'other' },
  Cogeneration: { label: 'Kraft-Wärme-Kopplung', color: '#ff8a65', cat: 'other' },
  'Wave and Tidal': { label: 'Gezeiten', color: '#4dd0e1', cat: 'hydro' },
  Other: { label: 'Sonstige', color: '#9aa3b5', cat: 'other' },
};

/** Minimal CSV parser supporting quoted fields. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export async function loadPowerPlants(): Promise<FeatureCollection<Point>> {
  const res = await fetch(
    'https://raw.githubusercontent.com/wri/global-power-plant-database/master/output_database/global_power_plant_database.csv',
  );
  if (!res.ok) throw new Error(`GPPD HTTP ${res.status}`);
  const [header, ...rows] = parseCsv(await res.text());
  const col = (n: string) => header.indexOf(n);
  const iName = col('name');
  const iMw = col('capacity_mw');
  const iLat = col('latitude');
  const iLon = col('longitude');
  const iFuel = col('primary_fuel');
  const iCountry = col('country_long');
  const iYear = col('commissioning_year');
  const iOwner = col('owner');
  const iUrl = col('url');
  const features: Feature<Point>[] = [];
  for (const r of rows) {
    const lat = parseFloat(r[iLat]);
    const lon = parseFloat(r[iLon]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const fuel = FUELS[r[iFuel]] ? r[iFuel] : 'Other';
    const f = FUELS[fuel];
    const mw = parseFloat(r[iMw]) || 0;
    const year = parseInt(r[iYear], 10);
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties: {
        cat: f.cat,
        color: f.color,
        mw,
        title: r[iName] || f.label,
        subtitle: [f.label, `${fmt.num(mw, mw < 10 ? 1 : 0)} MW`, r[iCountry], year ? `seit ${year}` : '', r[iOwner]].filter(Boolean).join(' · '),
        url: r[iUrl] || 'https://datasets.wri.org/dataset/globalpowerplantdatabase',
        source: 'WRI Global Power Plant Database',
      },
    });
  }
  // big plants first so they win label/icon collisions
  features.sort((a, b) => (b.properties!.mw as number) - (a.properties!.mw as number));
  return { type: 'FeatureCollection', features };
}

// ---------------------------------------------------------------------------
// Details from OpenStreetMap via Overpass when zoomed in: plants and single wind turbines

const OSM_SOURCE: Record<string, string> = {
  wind: 'Wind',
  solar: 'Solar',
  hydro: 'Hydro',
  nuclear: 'Nuclear',
  coal: 'Coal',
  gas: 'Gas',
  oil: 'Oil',
  biomass: 'Biomass',
  biogas: 'Biomass',
  waste: 'Waste',
  geothermal: 'Geothermal',
  battery: 'Storage',
};

export async function loadOsmPower(b: { west: number; south: number; east: number; north: number }): Promise<FeatureCollection<Point>> {
  const bbox = `${b.south.toFixed(4)},${b.west.toFixed(4)},${b.north.toFixed(4)},${b.east.toFixed(4)}`;
  const query = `[out:json][timeout:25];(nwr["power"="plant"](${bbox});node["power"="generator"]["generator:source"="wind"](${bbox}););out center tags 3000;`;
  const data = await overpass<{ elements: { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }[] }>(query, 'power', 30000);
  const features: Feature<Point>[] = [];
  for (const el of data.elements) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;
    const t = el.tags ?? {};
    const isTurbine = t.power === 'generator';
    const src = (t['plant:source'] ?? t['generator:source'] ?? '').split(';')[0];
    const fuel = OSM_SOURCE[src] ?? 'Other';
    const f = FUELS[fuel];
    const output = t['plant:output:electricity'] ?? t['generator:output:electricity'] ?? '';
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties: {
        cat: f.cat,
        color: f.color,
        turbine: isTurbine,
        title: t.name ?? (isTurbine ? 'Windenergieanlage' : `${f.label}-Kraftwerk`),
        subtitle: [f.label, output && output !== 'yes' ? output : '', t.operator, t.manufacturer, t['generator:model'] ?? t.model]
          .filter(Boolean)
          .join(' · '),
        url: `https://www.openstreetmap.org/${el.type}/${el.id}`,
        source: 'OpenStreetMap',
      },
    });
  }
  return { type: 'FeatureCollection', features };
}
