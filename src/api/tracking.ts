import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import { degreesLat, degreesLong, eciToGeodetic, gstime, propagate, twoline2satrec, type SatRec } from 'satellite.js';
import { store } from '../store';
import { proxyBase, viaProxy } from './proxy';
import { fetchJson, fmt } from '../util';
import { distTxt, speedTxt, uTok } from '../units';

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
  science: 'Forschung',
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
      ? `Höhe ${distTxt(p.heightKm, 0)} · ${speedTxt(p.speedKmS * 3600)} · Umlaufzeit ${fmt.num(periodMin, 0)} min`
      : '',
    url: `https://celestrak.org/satcat/table-satcat.php?CATNR=${s.id}`,
  };
}

// ---------------------------------------------------------------------------
// Aircraft – free, keyless community ADS-B networks. Not every network allows direct browser
// access (CORS), so several are tried in turn and the first one that answers is remembered.
// An optional own proxy (see proxy/ in the repository) can be set in the settings.

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
  baro_rate?: number;
  emergency?: string;
}

export type AircraftKind = 'plane' | 'heli' | 'glider' | 'balloon' | 'drone' | 'vehicle';

function aircraftKind(a: Ac): AircraftKind {
  const hex = (a.hex ?? '').toUpperCase();
  const flight = (a.flight ?? '').trim().toUpperCase();
  const type = (a.t ?? '').trim().toUpperCase();
  const desc = (a.desc ?? '').trim().toUpperCase();
  const cat = a.category ?? '';
  // Ground transponders and airfield vehicles (e.g. Follow-Me, Pushback Tugs, Service Vehicles)
  if (
    type === 'TWR' || type === 'GND' || type === 'VEH' || type === 'CAR' ||
    /^C[0-2]$/.test(cat) ||
    /^(FM\d*|FOLLOW\w*|TUG\d*|PUSH\d*|MARSH\w*|SWEEP\w*|APRON\w*|GATE\w*|FEUER\w*|FIRE\w*|RAMP\w*)/i.test(flight) ||
    /FOLLOW|PUSHBACK|TUG|SWEEPER|SURFACE VEHICLE|BODENFAHRZEUG/i.test(desc) ||
    hex === '3C41FA' || hex === '3C41D0'
  ) {
    return 'vehicle';
  }
  switch (cat) {
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

interface AcSource {
  id: string;
  label: string;
  url(lat: number, lon: number, nm: number): string;
  parse(json: unknown): Ac[];
  /** minimum seconds between requests (anonymous quotas) */
  minInterval?: number;
}

const readsb = (json: unknown) => {
  const j = json as { ac?: Ac[]; aircraft?: Ac[] };
  return j.ac ?? j.aircraft ?? [];
};

// OpenSky state vector → readsb-like record. Categories (extended=1): 8 rotorcraft,
// 9 glider, 10 lighter-than-air, 14 UAV.
type OskState = [string, string | null, string, number | null, number, number | null, number | null, number | null, boolean, number | null, number | null, number | null, unknown, number | null, string | null, boolean, number, number?];
const OSK_CAT: Record<number, string> = { 8: 'A7', 9: 'B1', 10: 'B2', 14: 'B6' };
function parseOpenSky(json: unknown): Ac[] {
  const states = ((json as { states?: OskState[] | null }).states ?? []) as OskState[];
  return states.map((s) => ({
    hex: s[0],
    flight: s[1] ?? undefined,
    desc: s[2] ? `Herkunft: ${s[2]}` : undefined,
    lon: s[5] ?? undefined,
    lat: s[6] ?? undefined,
    alt_baro: s[8] ? 'ground' : s[7] != null ? s[7] / 0.3048 : undefined,
    gs: s[9] != null ? s[9] * 1.943844 : undefined,
    track: s[10] ?? undefined,
    squawk: s[14] ?? undefined,
    category: s[17] != null ? OSK_CAT[s[17]] : undefined,
  }));
}

const AC_SOURCES: AcSource[] = [
  {
    id: 'adsb.lol',
    label: 'adsb.lol (ODbL)',
    url: (lat, lon, r) => `https://api.adsb.lol/v2/point/${lat.toFixed(3)}/${lon.toFixed(3)}/${r}`,
    parse: readsb,
  },
  {
    id: 'adsb.fi',
    label: 'adsb.fi',
    url: (lat, lon, r) => `https://opendata.adsb.fi/api/v3/lat/${lat.toFixed(3)}/lon/${lon.toFixed(3)}/dist/${r}`,
    parse: readsb,
  },
  {
    id: 'opensky',
    label: 'OpenSky Network',
    url: (lat, lon, r) => {
      // small boxes cost fewer credits (≤ 25 deg² = 1 credit)
      const dLat = (Math.min(r, 110) * 1.852) / 111.2;
      const dLon = dLat / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
      const q = [`lamin=${(lat - dLat).toFixed(2)}`, `lamax=${(lat + dLat).toFixed(2)}`, `lomin=${(lon - dLon).toFixed(2)}`, `lomax=${(lon + dLon).toFixed(2)}`];
      return `https://opensky-network.org/api/states/all?${q.join('&')}&extended=1`;
    },
    parse: parseOpenSky,
    // anonymous users get 400 credits a day
    minInterval: 45,
  },
];

let preferredSource = -1;
// Sources that failed are rested before the next attempt (30 s, doubling up to 10 min). Without
// a proxy most of them block browser requests (CORS) or rate-limit (429) – hammering them every
// few seconds only fills the console and makes the limits worse.
const acHealth = AC_SOURCES.map(() => ({ fails: 0, until: 0 }));
export const AC_ALL_PAUSED = 'Alle Flugdatenquellen pausiert – neuer Versuch in Kürze';
let lastResult: { at: number; lat: number; lon: number; nm: number; fc: AircraftResult } | null = null;

export interface AircraftResult extends FeatureCollection<Point> {
  source: string;
}

let globalCache: { at: number; fc: AircraftResult } | null = null;
let globalFailedAt = 0;
let lastProxy: string | undefined;

/** A newly entered proxy may fix what failed before – retry everything right away. */
function resetOnProxyChange() {
  const proxy = proxyBase();
  if (proxy === lastProxy) return;
  lastProxy = proxy;
  for (const h of acHealth) Object.assign(h, { fails: 0, until: 0 });
  globalFailedAt = 0;
}

/**
 * Worldwide overview of all aircraft from OpenSky (anonymous: 4 of 400 daily credits per
 * call) – cached for two minutes and shown when zoomed out.
 */
export async function loadGlobalAircraft(): Promise<AircraftResult> {
  resetOnProxyChange();
  if (globalCache && Date.now() - globalCache.at < 120000) return globalCache.fc;
  if (Date.now() - globalFailedAt < 300000) throw new Error('OpenSky-Weltübersicht pausiert (letzter Versuch fehlgeschlagen)');
  const json = await fetchJson<unknown>(viaProxy('https://opensky-network.org/api/states/all?extended=1'), undefined, 30000).catch((e) => {
    globalFailedAt = Date.now();
    throw e;
  });
  const fc = toFeatures(parseOpenSky(json), 'OpenSky Network (Weltübersicht)');
  globalCache = { at: Date.now(), fc };
  return fc;
}

/** One aircraft by its Mode-S code, wherever it is (for the selected aircraft when the map is far away from it). */
export async function loadAircraftByHex(hex: string): Promise<AircraftResult> {
  resetOnProxyChange();
  const sources: [string, string][] = [
    ['adsb.lol (ODbL)', 'https://api.adsb.lol/v2/hex/'],
  ];
  let last: unknown;
  for (const [label, base] of sources) {
    try {
      return toFeatures(readsb(await fetchJson<unknown>(viaProxy(base + encodeURIComponent(hex)), undefined, 8000)), label);
    } catch (e) {
      last = e;
    }
  }
  throw last instanceof Error ? last : new Error('Flugzeug nicht erreichbar');
}

/** Aircraft within `radiusNm` (max 250) around a point. */
export async function loadAircraft(lat: number, lon: number, radiusNm: number): Promise<AircraftResult> {
  resetOnProxyChange();
  const r = Math.min(250, Math.max(10, Math.round(radiusNm)));
  const order = AC_SOURCES.map((_, i) => i);
  if (preferredSource >= 0) order.unshift(...order.splice(preferredSource, 1));
  const errors: string[] = [];
  for (const i of order) {
    const src = AC_SOURCES[i];
    const health = acHealth[i];
    if (Date.now() < health.until) {
      errors.push(`${src.id}: pausiert`);
      continue;
    }
    // rate-limited sources: reuse the last answer while the view barely moved
    if (src.minInterval && lastResult?.fc.source === src.label && Date.now() - lastResult.at < src.minInterval * 1000) {
      const moved = Math.hypot(lastResult.lat - lat, (lastResult.lon - lon) * Math.cos((lat * Math.PI) / 180)) * 60;
      if (moved < r * 0.3 && Math.abs(lastResult.nm - r) < r * 0.3) return lastResult.fc;
    }
    try {
      const json = await fetchJson<unknown>(viaProxy(src.url(lat, lon, r)), undefined, 12000);
      const fc = toFeatures(src.parse(json), src.label);
      preferredSource = i;
      health.fails = 0;
      lastResult = { at: Date.now(), lat, lon, nm: r, fc };
      return fc;
    } catch (e) {
      health.fails++;
      health.until = Date.now() + Math.min(600000, 30000 * 2 ** (health.fails - 1));
      errors.push(`${src.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  preferredSource = -1;
  if (errors.every((e) => e.endsWith(': pausiert'))) throw new Error(AC_ALL_PAUSED);
  throw new Error(`Keine Flugdatenquelle erreichbar (${errors.join('; ')})`);
}

/** Some feeds send "@@@@@@@@" instead of a callsign / registration / type when nothing was decoded. */
const clean = (v?: string) => (v ?? '').replace(/@/g, '').trim();

function toFeatures(list: Ac[], source: string): AircraftResult {
  const features: Feature<Point>[] = [];
  for (const a of list) {
    if (a.lat == null || a.lon == null) continue;
    // ADS-B also carries fixed obstacles (category C3–C5, hex 000000): no aircraft and no vehicle
    if (/^C[3-5]$/.test(a.category ?? '') || /^0+$/.test(a.hex)) continue;
    // a tower transponder (type TWR without any further description) is a fixed station, not a vehicle
    if ((a.t ?? '').trim().toUpperCase() === 'TWR' && /^(TWR)?$/.test(clean(a.desc).toUpperCase())) continue;
    const onGround = a.alt_baro === 'ground';
    const altFt = typeof a.alt_baro === 'number' ? a.alt_baro : 0;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [a.lon, a.lat] },
      properties: {
        hex: a.hex,
        kind: aircraftKind(a),
        callsign: clean(a.flight) || clean(a.r) || a.hex.toUpperCase(),
        reg: clean(a.r),
        type: clean(a.desc) || clean(a.t),
        icao: clean(a.t),
        squawk: a.squawk ?? '',
        // ft/min → m/s
        vsMs: a.baro_rate != null ? Math.round(a.baro_rate * 0.0508) / 10 : null,
        cat: a.category ?? '',
        operator: clean(a.ownOp),
        altM: onGround ? 0 : Math.round(altFt * 0.3048),
        speedKmh: a.gs != null ? Math.round(a.gs * 1.852) : null,
        track: a.track ?? a.true_heading ?? 0,
        ground: onGround,
        emergency: a.emergency && a.emergency !== 'none' ? a.emergency : '',
      },
    });
  }
  return { type: 'FeatureCollection', features, source };
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
  heading?: number;
  manufacturer?: string;
  frame?: number;
  time_received?: string;
  uploader_callsign?: string;
  uploader_antenna?: string;
  software_name?: string;
  software_version?: string;
}

export async function loadSondes(): Promise<FeatureCollection<Point>> {
  const data = await fetchJson<Record<string, SondeTelemetry>>('https://api.v2.sondehub.org/sondes?last=10800', undefined, 20000);
  const features: Feature<Point>[] = [];
  for (const s of Object.values(data)) {
    if (s.lat == null || s.lon == null) continue;
    const rising = (s.vel_v ?? 0) > 0.5;
    const falling = (s.vel_v ?? 0) < -0.5;
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
      properties: {
        serial: s.serial,
        // the label above the 3D model is the serial itself (like a callsign)
        callsign: s.serial,
        title: `Wetterballon ${s.serial}`,
        subtitle: `${s.subtype || s.type || 'Radiosonde'} · Höhe ${uTok('height', s.alt)} · ${rising ? 'steigt' : falling ? 'fällt (Fallschirm)' : 'gelandet'}`,
        date: s.datetime,
        url: `https://sondehub.org/#!mt=Mapnik&f=${encodeURIComponent(s.serial)}&q=${encodeURIComponent(s.serial)}`,
        altM: Math.round(s.alt),
        type: s.type ?? '',
        subtype: s.subtype ?? '',
        manufacturer: s.manufacturer ?? '',
        frequency: s.frequency ?? null,
        heading: s.heading ?? null,
        velV: s.vel_v ?? null,
        velH: s.vel_h ?? null,
        timeReceived: s.time_received ?? '',
        frame: s.frame ?? null,
        uploader: s.uploader_callsign ?? '',
        antenna: s.uploader_antenna ?? '',
        software: [s.software_name, s.software_version].filter(Boolean).join(' '),
      },
    });
  }
  return { type: 'FeatureCollection', features };
}
