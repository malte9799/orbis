// Reine Hilfsfunktionen der Intelligence-Ebenen (gdelt, ucdp, gem, portwatch, cyberc2, hormuz, vip):
// Loader-Daten -> GeoJSON-Punkte. Nur Einträge mit gültigen Koordinaten kommen auf die Karte.
import type { Feature, FeatureCollection, Point } from 'geojson';
import type { GemAsset } from '../../../api/energy';
import type { PortWatchData } from '../../../api/portwatch';
import type { CyberServer } from '../../../api/cyber';
import type { HormuzCompactSnapshot } from '../../../api/hormuz';
import type { VipData } from '../../../api/vip';

type Props = Record<string, string | number | boolean>;
type Pt = Feature<Point, Props>;

const fc = (features: Pt[]): FeatureCollection<Point, Props> => ({ type: 'FeatureCollection', features });
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
/** valid WGS84 position (0/0 counts as "no position" – typical for missing data) */
export const validLonLat = (lon: unknown, lat: unknown): boolean =>
  finite(lon) && finite(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90 && !(lon === 0 && lat === 0);
const point = (lon: number, lat: number, properties: Props): Pt => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties });

/** GDELT: points with name + article URL (de-duplicated by position and URL) */
export function gdeltFeatures(data: FeatureCollection<Point, { name?: string; url?: string }> | null | undefined): FeatureCollection<Point, Props> {
  const seen = new Set<string>();
  const out: Pt[] = [];
  for (const f of data?.features ?? []) {
    const c = f.geometry?.coordinates;
    if (!c || !validLonLat(c[0], c[1])) continue;
    const name = String(f.properties?.name ?? '').trim();
    const url = String(f.properties?.url ?? '').trim();
    const key = `${c[0]},${c[1]},${url}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(point(c[0], c[1], { name, url }));
  }
  return fc(out);
}

/** UCDP: keeps only events with a valid position */
export function ucdpFeatures(data: FeatureCollection<Point, { id: string; deaths: number; side_a: string; side_b: string }> | null | undefined): FeatureCollection<Point, Props> {
  const out: Pt[] = [];
  for (const f of data?.features ?? []) {
    const c = f.geometry?.coordinates;
    if (!c || !validLonLat(c[0], c[1])) continue;
    out.push(point(c[0], c[1], { id: String(f.properties.id), deaths: Number(f.properties.deaths) || 0, side_a: String(f.properties.side_a ?? ''), side_b: String(f.properties.side_b ?? '') }));
  }
  return fc(out);
}

export type GemGroup = 'coal' | 'gas' | 'oil' | 'nuclear' | 'solar' | 'wind' | 'hydro' | 'other';

export const GEM_COLORS: Record<GemGroup, string> = {
  coal: '#8d6e63',
  gas: '#ffb74d',
  oil: '#455a64',
  nuclear: '#ab47bc',
  solar: '#ffee58',
  wind: '#4dd0e1',
  hydro: '#42a5f5',
  other: '#9ccc65',
};

export const GEM_GROUP_LABEL: Record<GemGroup, string> = {
  coal: 'Kohle',
  gas: 'Gas',
  oil: 'Öl',
  nuclear: 'Kernkraft',
  solar: 'Solar',
  wind: 'Wind',
  hydro: 'Wasserkraft',
  other: 'Sonstige',
};

/** fuel group of a GEM asset type ("Coal Mine", "Gas Power Plant", "Oil & Gas Pipeline" …) */
export function gemGroup(assetType: string | undefined): GemGroup {
  const t = (assetType ?? '').toLowerCase();
  if (t.includes('coal')) return 'coal';
  if (t.includes('nuclear')) return 'nuclear';
  if (t.includes('solar')) return 'solar';
  if (t.includes('wind')) return 'wind';
  if (t.includes('hydro')) return 'hydro';
  if (t.includes('oil')) return 'oil';
  if (t.includes('gas') || t.includes('lng')) return 'gas';
  return 'other';
}

export function gemFeatures(assets: GemAsset[] | null | undefined): FeatureCollection<Point, Props> {
  const out: Pt[] = [];
  for (const a of assets ?? []) {
    if (!validLonLat(a.longitude, a.latitude)) continue;
    const g = gemGroup(a.asset_type);
    out.push(
      point(a.longitude as number, a.latitude as number, {
        id: a.asset_id,
        name: a.asset_name || a.project_name || a.asset_id,
        type: a.asset_type,
        group: g,
        color: GEM_COLORS[g],
        status: a.operating_status ?? '',
        cap: finite(a.capacity_value) ? a.capacity_value : -1,
        unit: a.capacity_unit ?? '',
        country: a.country ?? '',
        region: a.state_province ?? '',
        wiki: a.wiki_url ?? '',
      }),
    );
  }
  return fc(out);
}

export function portwatchFeatures(data: PortWatchData | null | undefined): FeatureCollection<Point, Props> {
  const out: Pt[] = [];
  for (const c of data?.chokepoints ?? []) {
    if (!validLonLat(c.lon, c.lat)) continue;
    out.push(point(c.lon as number, c.lat as number, { id: c.portid, name: c.portname, kind: 'choke', n: finite(c.vessel_count_total) ? c.vessel_count_total : 0, country: '', cls: '' }));
  }
  for (const p of data?.ports ?? []) {
    if (!validLonLat(p.long, p.lat)) continue;
    out.push(point(p.long as number, p.lat as number, { id: p.portid, name: p.portname, kind: 'port', n: finite(p.vessel_count_total) ? p.vessel_count_total : 0, country: p.country ?? '', cls: p.portclass ?? '' }));
  }
  return fc(out);
}

/** Feodo C2 servers: only entries with lat/lon */
export function cyberFeatures(servers: CyberServer[] | null | undefined): FeatureCollection<Point, Props> {
  const out: Pt[] = [];
  for (const s of servers ?? []) {
    if (!validLonLat(s.lon, s.lat)) continue;
    out.push(
      point(s.lon as number, s.lat as number, {
        ip: s.ip_address,
        port: s.port,
        status: s.status,
        malware: s.malware ?? '',
        country: s.country ?? '',
        as: s.as_name ?? '',
        last: s.last_online ?? '',
        first: s.first_seen ?? '',
      }),
    );
  }
  return fc(out);
}

/** hormuz.now compact snapshot (`fields` + `rows`) -> vessels */
export function hormuzFeatures(snap: HormuzCompactSnapshot | null | undefined): FeatureCollection<Point, Props> {
  if (!snap || !Array.isArray(snap.fields) || !Array.isArray(snap.rows)) return fc([]);
  const ix = (n: string) => snap.fields.indexOf(n);
  const [iId, iName, iLat, iLon, iSpeed, iCat, iLen, iFlag, iType, iDest, iAge] = ['id', 'name', 'lat', 'lon', 'speed', 'category', 'length', 'flag', 'type', 'destination', 'ageMin'].map(ix);
  const out: Pt[] = [];
  for (const r of snap.rows) {
    const lat = r[iLat];
    const lon = r[iLon];
    if (!validLonLat(lon, lat)) continue;
    const str = (i: number) => (i >= 0 && r[i] != null ? String(r[i]) : '');
    const num = (i: number) => (i >= 0 && finite(r[i]) ? (r[i] as number) : -1);
    out.push(point(lon as number, lat as number, { id: str(iId), name: str(iName) || str(iId), cat: str(iCat), speed: num(iSpeed), len: num(iLen), flag: str(iFlag), type: str(iType), dest: str(iDest), age: num(iAge) }));
  }
  return fc(out);
}

/** billionaires: one point per company headquarters (`i` = person index in `data.people`, `c` = company index) */
export function vipFeatures(data: VipData | null | undefined): FeatureCollection<Point, Props> {
  const out: Pt[] = [];
  (data?.people ?? []).forEach((p, i) => {
    (p.companies ?? []).forEach((c, ci) => {
      if (!validLonLat(c.lon, c.lat)) return;
      out.push(point(c.lon, c.lat, { i, c: ci, name: c.name, person: p.name }));
    });
  });
  return fc(out);
}
