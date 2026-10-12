import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import { degreesLat, degreesLong, eciToGeodetic, gstime, propagate, twoline2satrec, type SatRec } from 'satellite.js';
import { store } from '../store';
import { fetchJson, fmt } from '../util';

// ---------------------------------------------------------------------------
// Satellites – orbital elements from CelesTrak, positions computed in the browser (SGP4)

export interface Sat {
  name: string;
  id: string;
  group: string;
  satrec: SatRec;
}

const SAT_GROUPS: Record<string, string> = {
  stations: 'Raumstation',
  visual: 'Hell sichtbar',
  weather: 'Wettersatellit',
  'gps-ops': 'GPS',
  galileo: 'Galileo',
  starlink: 'Starlink',
};

/** CelesTrak asks clients not to re-download the same data more often than every ~2 h. */
const TLE_CACHE_MS = 6 * 3600 * 1000;

export async function loadSatGroup(group: string): Promise<Sat[]> {
  const key = `tle.${group}`;
  let text = store.cacheGet<string>(key, TLE_CACHE_MS);
  if (!text) {
    const res = await fetch(`https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=tle`);
    if (!res.ok) throw new Error(`CelesTrak HTTP ${res.status}`);
    text = await res.text();
    if (group !== 'starlink') store.cacheSet(key, text); // starlink is too big for localStorage
  }
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter(Boolean);
  const sats: Sat[] = [];
  for (let i = 0; i + 2 < lines.length; i += 3) {
    const [name, l1, l2] = [lines[i], lines[i + 1], lines[i + 2]];
    if (!l1?.startsWith('1 ') || !l2?.startsWith('2 ')) continue;
    try {
      sats.push({ name: name.trim(), id: l1.slice(2, 7).trim(), group, satrec: twoline2satrec(l1, l2) });
    } catch {
      /* skip malformed element sets */
    }
  }
  return sats;
}

/** All curated groups except Starlink (which is loaded separately via loadSatGroup). */
export async function loadSatellites(): Promise<Sat[]> {
  const groups = Object.keys(SAT_GROUPS).filter((g) => g !== 'starlink');
  const results = await Promise.allSettled(groups.map(loadSatGroup));
  if (results.every((r) => r.status === 'rejected')) throw new Error('CelesTrak nicht erreichbar');
  const seen = new Set<string>();
  const out: Sat[] = [];
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const s of r.value) {
      if (seen.has(s.id)) continue; // a satellite can be in several groups
      seen.add(s.id);
      out.push(s);
    }
  }
  return out;
}

export interface SatPosition {
  lon: number;
  lat: number;
  heightKm: number;
  speedKmS: number;
}

export function satPosition(s: Sat, date: Date): SatPosition | null {
  const pv = propagate(s.satrec, date);
  if (!pv || typeof pv.position !== 'object' || typeof pv.velocity !== 'object') return null;
  const geo = eciToGeodetic(pv.position, gstime(date));
  const v = pv.velocity;
  return {
    lon: degreesLong(geo.longitude),
    lat: degreesLat(geo.latitude),
    heightKm: geo.height,
    speedKmS: Math.hypot(v.x, v.y, v.z),
  };
}

export function satelliteFeatures(sats: Sat[], date = new Date()): FeatureCollection<Point> {
  const features: Feature<Point>[] = [];
  for (const s of sats) {
    const p = satPosition(s, date);
    if (!p || !Number.isFinite(p.lat)) continue;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
      properties: { id: s.id, name: s.name, group: s.group, label: SAT_GROUPS[s.group] ?? s.group, h: Math.round(p.heightKm) },
    });
  }
  return { type: 'FeatureCollection', features };
}

/** Ground track from one orbit back to one orbit ahead, split at the antimeridian. */
export function groundTrack(s: Sat, date = new Date()): FeatureCollection<LineString> {
  const periodMin = (2 * Math.PI) / s.satrec.no; // no = mean motion in rad/min
  const lines: [number, number][][] = [[]];
  for (let m = -periodMin; m <= periodMin; m += 1) {
    const p = satPosition(s, new Date(date.getTime() + m * 60000));
    if (!p) continue;
    const cur = lines[lines.length - 1];
    const prev = cur[cur.length - 1];
    if (prev && Math.abs(p.lon - prev[0]) > 180) lines.push([]);
    lines[lines.length - 1].push([p.lon, p.lat]);
  }
  return {
    type: 'FeatureCollection',
    features: lines
      .filter((l) => l.length > 1)
      .map((coordinates) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates }, properties: {} })),
  };
}

export function satPopupInfo(s: Sat, date = new Date()) {
  const p = satPosition(s, date);
  const periodMin = (2 * Math.PI) / s.satrec.no;
  return {
    title: s.name,
    subtitle: `${SAT_GROUPS[s.group] ?? s.group} · NORAD ${s.id}`,
    details: p
      ? `Höhe ${fmt.num(p.heightKm, 0)} km · ${fmt.num(p.speedKmS * 3600, 0)} km/h · Umlaufzeit ${fmt.num(periodMin, 0)} min`
      : '',
    url: `https://celestrak.org/satcat/table-satcat.php?CATNR=${s.id}`,
  };
}

// ---------------------------------------------------------------------------
// Aircraft – community ADS-B networks (adsb.lol, airplanes.live), free & keyless

interface Ac {
  hex: string;
  flight?: string;
  r?: string;
  t?: string;
  desc?: string;
  ownOp?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | 'ground';
  gs?: number;
  track?: number;
  true_heading?: number;
  category?: string;
  squawk?: string;
  emergency?: string;
}

export type AircraftKind = 'plane' | 'heli' | 'glider' | 'balloon' | 'drone';

function aircraftKind(a: Ac): AircraftKind {
  switch (a.category) {
    case 'A7':
      return 'heli';
    case 'B1':
    case 'B4':
      return 'glider';
    case 'B2':
      return 'balloon';
    case 'B6':
      return 'drone';
  }
  return 'plane';
}

/** Aircraft within `radiusNm` (max 250) around a point. */
export async function loadAircraft(lat: number, lon: number, radiusNm: number): Promise<FeatureCollection<Point>> {
  const r = Math.min(250, Math.max(10, Math.round(radiusNm)));
  const urls = [
    `https://api.adsb.lol/v2/point/${lat.toFixed(3)}/${lon.toFixed(3)}/${r}`,
    `https://api.airplanes.live/v2/point/${lat.toFixed(3)}/${lon.toFixed(3)}/${r}`,
  ];
  let data: { ac?: Ac[] } | null = null;
  let lastErr: unknown;
  for (const url of urls) {
    try {
      data = await fetchJson<{ ac?: Ac[] }>(url, undefined, 12000);
      break;
    } catch (e) {
      lastErr = e;
    }
  }
  if (!data) throw lastErr;
  const features: Feature<Point>[] = [];
  for (const a of data.ac ?? []) {
    if (a.lat == null || a.lon == null) continue;
    const onGround = a.alt_baro === 'ground';
    const altFt = typeof a.alt_baro === 'number' ? a.alt_baro : 0;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [a.lon, a.lat] },
      properties: {
        hex: a.hex,
        kind: aircraftKind(a),
        callsign: (a.flight ?? '').trim() || a.r || a.hex.toUpperCase(),
        reg: a.r ?? '',
        type: a.desc || a.t || '',
        operator: a.ownOp ?? '',
        altM: onGround ? 0 : Math.round(altFt * 0.3048),
        speedKmh: a.gs != null ? Math.round(a.gs * 1.852) : null,
        track: a.track ?? a.true_heading ?? 0,
        ground: onGround,
        emergency: a.emergency && a.emergency !== 'none' ? a.emergency : '',
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

// ---------------------------------------------------------------------------
// Weather balloons (radiosondes) tracked by the SondeHub amateur network

interface SondeTelemetry {
  serial: string;
  lat: number;
  lon: number;
  alt: number;
  datetime: string;
  type?: string;
  subtype?: string;
  vel_v?: number;
  vel_h?: number;
  frequency?: number;
}

export async function loadSondes(): Promise<FeatureCollection<Point>> {
  const data = await fetchJson<Record<string, SondeTelemetry>>('https://api.v2.sondehub.org/sondes?last=10800', undefined, 20000);
  const features: Feature<Point>[] = [];
  for (const s of Object.values(data)) {
    if (s.lat == null || s.lon == null) continue;
    const rising = (s.vel_v ?? 0) > 0.5;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
      properties: {
        serial: s.serial,
        title: `Wetterballon ${s.serial}`,
        subtitle: `${s.subtype || s.type || 'Radiosonde'} · Höhe ${fmt.num(s.alt, 0)} m · ${rising ? 'steigt' : (s.vel_v ?? 0) < -0.5 ? 'fällt (Fallschirm)' : 'gelandet'}`,
        date: s.datetime,
        url: `https://sondehub.org/#!mt=Mapnik&f=${encodeURIComponent(s.serial)}&q=${encodeURIComponent(s.serial)}`,
        altM: Math.round(s.alt),
      },
    });
  }
  return { type: 'FeatureCollection', features };
}
