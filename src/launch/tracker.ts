import type { Feature, FeatureCollection } from 'geojson';
import { fetchJson } from '../util';
import { t as m, type MessageKey } from '../i18n';
import type { Launch } from '../api/transport';

// Launch tracker: full launch records from Launch Library 2 (The Space Devs), reminders via the
// browser Notification API and a simulated ascent track (public rocket telemetry simply does not
// exist, so position/altitude/speed are modelled from the pad and the target orbit).

export interface LaunchDetail {
  id: string;
  name: string;
  net: string;
  windowStart: string;
  windowEnd: string;
  /** LL2 status abbrev (Go, In Flight, Success …) */
  status: string;
  statusDe: string;
  provider: string;
  rocket: string;
  missionName: string;
  orbit: string;
  orbitName: string;
  /** target orbit altitude in km (estimated from the orbit abbrev) */
  altKm: number;
  /** target orbit inclination in degrees (estimated from the orbit abbrev + pad latitude) */
  incDeg: number;
  pad: string;
  place: string;
  lat: number;
  lon: number;
  desc: string;
  video?: string;
  videos: string[];
  probability: number | null;
}

// ---------------------------------------------------------------------------
// Data

const DETAIL_CACHE = 'wg.launch.track.v1';

interface LL2Launch {
  id?: string;
  name: string;
  net: string;
  window_start?: string;
  window_end?: string;
  probability?: number;
  status?: { abbrev?: string; name?: string };
  launch_service_provider?: { name?: string };
  rocket?: { configuration?: { full_name?: string; name?: string } };
  mission?: { name?: string; description?: string; orbit?: { abbrev?: string; name?: string; inclination?: number; altitude?: number } };
  pad?: { name?: string; latitude?: string | number; longitude?: string | number; location?: { name?: string; country?: { name?: string; code?: string } } };
  vid_urls?: { url?: string; priority?: number }[];
}

/** LL2 abbrev → message key of the launch.status.* catalog (misc.json). */
const STATUS_KEYS: Record<string, string> = {
  Go: 'go',
  'Go for Launch': 'go',
  TBD: 'tbd',
  TBC: 'tbc',
  Hold: 'hold',
  'In Flight': 'flight',
  Debris: 'debris',
  Success: 'success',
  Failure: 'failure',
};

/** display name of the launch status in the UI language; unknown abbrevs keep their original */
export function statusTxt(d: Pick<LaunchDetail, 'status' | 'statusDe'>): string {
  const k = STATUS_KEYS[d.status];
  return k ? m(`launch.status.${k}` as MessageKey) : d.statusDe || d.status;
}

/** Target altitude/speed estimates for the simulation, by LL2 orbit abbrev. */
const ORBIT: Record<string, { altKm: number; inc: number; note?: string }> = {
  ISS: { altKm: 410, inc: 51.6 },
  LEO: { altKm: 450, inc: 50 },
  VLEO: { altKm: 260, inc: 50 },
  SSO: { altKm: 550, inc: 97.5 },
  POLAR: { altKm: 550, inc: 92 },
  Suborbital: { altKm: 90, inc: 30, note: 'Suborbital' },
  MEO: { altKm: 20180, inc: 58 },
  GTO: { altKm: 35786, inc: 27, note: 'Transferbahn' },
  GEO: { altKm: 35786, inc: 0 },
  HEO: { altKm: 35786, inc: 40 },
  TLI: { altKm: 380000, inc: 30 },
  'Lunar Orbit': { altKm: 100, inc: 45, note: 'Mondorbit' },
};

const orbitOf = (o?: LL2Launch['mission']) => {
  const abbrev = o?.orbit?.abbrev ?? '';
  const hit = ORBIT[abbrev] ?? { altKm: 400, inc: 45 };
  return {
    orbit: abbrev,
    orbitName: o?.orbit?.name ?? abbrev,
    altKm: o?.orbit?.altitude && o.orbit.altitude > 100 ? o.orbit.altitude : hit.altKm,
    incDeg: Number.isFinite(o?.orbit?.inclination) ? Number(o?.orbit?.inclination) : hit.inc,
    note: hit.note,
  };
};

let detailCache: LaunchDetail[] | null = null;

/** All upcoming launches of the next days, refreshed at most every 3 minutes (LL2: 15 requests/h). */
export async function getLaunchDetails(): Promise<LaunchDetail[]> {
  if (detailCache) return detailCache;
  const cached = localStorage.getItem(DETAIL_CACHE);
  if (cached) {
    try {
      const c = JSON.parse(cached) as { at: number; list: LaunchDetail[] };
      if (Date.now() - c.at < 3 * 60000) {
        detailCache = c.list;
        return detailCache;
      }
    } catch {
      /* ignore */
    }
  }
  const json = await fetchJson<{ results: LL2Launch[] }>('https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=20&mode=detailed', undefined, 30000);
  const videos = (l: LL2Launch) =>
    (l.vid_urls ?? [])
      .map((v) => ({ url: v.url ?? '', priority: v.priority ?? 99 }))
      .filter((v) => /^(https?:)?\/\//.test(v.url))
      .sort((a, b) => a.priority - b.priority);
  const list: LaunchDetail[] = json.results.map((l) => {
    const lat = Number(l.pad?.latitude);
    const lon = Number(l.pad?.longitude);
    const orbit = orbitOf(l.mission);
    return {
      id: l.id ?? '',
      name: l.name ?? '',
      net: l.net,
      windowStart: l.window_start ?? l.net,
      windowEnd: l.window_end ?? l.net,
      status: l.status?.abbrev ?? '',
      statusDe: l.status?.name ?? '',
      provider: l.launch_service_provider?.name ?? '',
      rocket: l.rocket?.configuration?.full_name ?? l.rocket?.configuration?.name ?? '',
      missionName: l.mission?.name ?? '',
      desc: l.mission?.description ?? '',
      pad: l.pad?.name ?? '',
      place: [l.pad?.location?.name, l.pad?.location?.country?.code].filter(Boolean).join(' · '),
      lat: Number.isFinite(lat) ? lat : 0,
      lon: Number.isFinite(lon) ? lon : 0,
      videos: videos(l).map((v) => v.url),
      video: videos(l)[0]?.url,
      probability: typeof l.probability === 'number' ? l.probability : null,
      ...orbit,
    };
  });
  detailCache = list;
  try {
    localStorage.setItem(DETAIL_CACHE, JSON.stringify({ at: Date.now(), list }));
  } catch {
    /* ignore */
  }
  return list;
}

/** A minimal detail object when the id is missing from the detail list (older / just launched). */
export function detailFromLaunch(l: Launch, lng?: number, lat?: number): LaunchDetail {
  const orbit = orbitOf(void 0);
  const m = /launch\/([a-z0-9-]+)/i.exec(l.url ?? '')?.[1] ?? '';
  return {
    id: l.id || m,
    name: l.name,
    net: l.net,
    windowStart: l.net,
    windowEnd: l.net,
    status: '',
    statusDe: l.status,
    provider: l.provider,
    rocket: l.rocket,
    missionName: l.mission.split(' – ')[0] ?? '',
    desc: l.mission,
    pad: '',
    place: '',
    lat: lat ?? 0,
    lon: lng ?? 0,
    videos: l.video ? [l.video] : [],
    video: l.video,
    probability: null,
    ...orbit,
  };
}

// ---------------------------------------------------------------------------
// Simulated ascent (Falcon 9-class profile over the target orbit)

export interface FlightPhase {
  /** seconds since T-0, negative = countdown */
  tSec: number;
  phase: 'active' | 'orbit' | 'pre';
  /** flight-path angle above horizon (deg), 0 = orbit insertion */
  pitchDeg: number;
  at: LivePoint | null;
}

export interface LivePoint {
  lat: number;
  lon: number;
  altKm: number;
  speedKmh: number;
  /** heading of the ground track (deg from north) */
  az: number;
  /** distance travelled downrange (km) */
  downrangeKm: number;
}

const lerp = (pts: [number, number][], t: number) => {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i][0]) {
      const [x0, v0] = pts[i - 1];
      const [x1, v1] = pts[i];
      return v0 + ((v1 - v0) * (t - x0)) / (x1 - x0);
    }
  }
  return pts[pts.length - 1][1];
};

// plausible profiles for a two-stage rocket climbing to low Earth orbit
const V: [number, number][] = [[0, 0], [30, 0.07], [60, 0.25], [90, 0.55], [145, 1.2], [180, 1.65], [240, 2.35], [300, 3.1], [360, 3.9], [420, 4.9], [480, 6.0], [540, 7.0], [600, 7.8], [680, 7.9]];
const H: [number, number][] = [[0, 0], [30, 0.8], [60, 3], [90, 8], [120, 15], [180, 35], [240, 65], [300, 100], [360, 128], [420, 158], [480, 188], [540, 205], [600, 212], [680, 215]];
const PITCH: [number, number][] = [[0, 90], [30, 84], [60, 74], [90, 63], [120, 53], [145, 46], [180, 37], [240, 25], [300, 17], [360, 10], [420, 5], [480, 2], [540, 0], [680, 0]];

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Great-circle destination from a point along a bearing (deg), distance in km. */
function destination(lat: number, lon: number, azDeg: number, distKm: number): [number, number] {
  const d = distKm / 6371;
  const b = rad(azDeg);
  const p1 = rad(lat);
  const l1 = rad(lon);
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [Math.min(180, Math.max(-180, deg(l2))), Math.min(90, Math.max(-90, deg(p2)))];
}

/** End of the simulated live track (engine cutoff of the second stage). */
export function flightEndSec(d: LaunchDetail): number {
  if (SUBORBITAL.includes(d.orbit)) return 300;
  if (d.altKm > 2000) return 1250; // transfer/lunar missions keep boosting longer
  return 680;
}

const SUBORBITAL = ['Suborbital'];

/** Factor for a faster climb on higher-energy missions (GTO etc.). */
const energy = (d: LaunchDetail) => Math.min(1.12, Math.max(1, 0.92 + d.altKm / 6000));

/** Estimated launch azimuth from the pad latitude and target inclination. */
function azimuthOf(d: LaunchDetail): number {
  const i = Math.abs(d.incDeg) % 180;
  // pads that normally fly polar missions southbound (Rocket Lab is southbound from NZ)
  const southbound = /Vandenberg|Mahan|Mahia|Onenui|Kodiak|Uchinoura|Kazakhstan/.test(`${d.place},${d.pad}`);
  if (i >= 85 || Math.cos(rad(d.lat)) < 0) return southbound && d.lat > 0 ? 190 : 0;
  // direct insertion: sin(A) = cos(i)/cos(lat) eastward, mirrored for southern sites;
  // from northern pads the course bends toward the south-east, from southern ones to the north-east
  const a = deg(Math.asin(Math.min(1, Math.cos(rad(i)) / Math.cos(rad(Math.abs(d.lat))))));
  return Math.round((d.lat >= 0 ? 90 + a : 90 - a) * 10) / 10;
}

/** Simulated position of the rocket `tSec` after T-0 (null before liftoff). */
export function trackAt(d: LaunchDetail, tSec: number): LivePoint | null {
  if (tSec < 0) return null;
  const t = Math.min(tSec, flightEndSec(d));
  const f = energy(d);
  const v = lerp(V, t) * f;
  const h = Math.min(lerp(H, t) * Math.max(0.7, Math.min(1.1, 0.8 + d.altKm / 1500)), d.altKm > 2000 ? 230 : d.altKm);
  // integrate the horizontal speed v·cos(gamma) from liftoff to t
  let dist = 0;
  for (let s = 0; s < t; s += 10) {
    const mid = Math.min(t, s + 5);
    dist += lerp(V, mid) * f * Math.cos(rad(lerp(PITCH, mid))) * 10;
  }
  const [lon, lat] = destination(d.lat, d.lon, azimuthOf(d), dist);
  return { lat, lon, altKm: h, speedKmh: v * 3600, az: azimuthOf(d), downrangeKm: dist };
}

/** Current flight phase + position for the reminder/tracking logic. */
export function flightPhase(d: LaunchDetail, at = Date.now()): FlightPhase {
  const tSec = Math.round((at - Date.parse(d.net)) / 1000);
  const end = flightEndSec(d);
  if (tSec < 0) return { tSec, phase: 'pre', pitchDeg: 90, at: null };
  if (tSec > end) return { tSec, phase: 'orbit', pitchDeg: 0, at: null };
  const a = trackAt(d, tSec)!;
  return { tSec, phase: 'active', pitchDeg: lerp(PITCH, tSec), at: a };
}

/** Feature collection for the map: dashed trail plus the rocket symbol at its head. */
export function trackFeatures(d: LaunchDetail, at = Date.now()): { line: FeatureCollection; pos: FeatureCollection } | null {
  const p = flightPhase(d, at);
  if (p.phase !== 'active' || !p.at) return null;
  const coords: [number, number][] = [];
  for (let t = Math.max(0, p.tSec - 600); t <= p.tSec; t += 15) {
    const a = trackAt(d, t);
    if (t <= p.tSec && a) coords.push([a.lon, a.lat]);
  }
  coords.push([p.at.lon, p.at.lat]);
  const line: Feature = {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: coords },
    properties: {},
  };
  const pos: Feature = {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [p.at.lon, p.at.lat] },
    properties: {
      rot: Math.round(p.at.az),
      when: `T${p.tSec >= 0 ? '+' : '-'} ${tLabel(Math.abs(p.tSec))}`,
    },
  };
  return { line: { type: 'FeatureCollection', features: [line] }, pos: { type: 'FeatureCollection', features: [pos] } };
}

/** "2:35" from seconds */
export function tLabel(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Reminders (browser notifications)

const REMIND_KEY = 'wg.launch.remind.v1';
const FIRED_KEY = 'wg.launch.remind.fired.v1';

export interface RemindEntry {
  id: string;
  name: string;
  net: string;
  provider?: string;
  video?: string;
  /** minutes before liftoff, 0 = at T-0 */
  minutes: number[];
}

const loadJson = <T>(key: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '') ?? fallback;
  } catch {
    return fallback;
  }
};
const save = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* ignore */
  }
};

export const notifSupported = () => typeof Notification !== 'undefined';

export async function requestNotifyPermission(): Promise<NotificationPermission> {
  if (!notifSupported()) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  try {
    return (await Notification.requestPermission()) as NotificationPermission;
  } catch {
    return Notification.permission;
  }
}

export const notifyPermission = (): NotificationPermission => (notifSupported() ? Notification.permission : 'denied');

export function getReminder(id: string): number[] {
  return loadJson<RemindEntry[]>(REMIND_KEY, []).find((r) => r.id === id)?.minutes ?? [];
}

/** Stores (or clears, with an empty list) the reminder for a launch. */
export function setReminder(d: LaunchDetail, minutes: number[]) {
  const list = loadJson<RemindEntry[]>(REMIND_KEY, []).filter((r) => r.id !== d.id);
  if (minutes.length) {
    list.push({ id: d.id, name: d.name, net: d.net, provider: d.provider, video: d.video, minutes });
  }
  save(REMIND_KEY, list);
  const fired = loadJson<string[]>(FIRED_KEY, []).filter((f) => !f.startsWith(`${d.id}#`));
  save(FIRED_KEY, fired);
}

export function remindCount(): number {
  return loadJson<RemindEntry[]>(REMIND_KEY, []).length;
}

function fire(entry: RemindEntry, minutesBefore: number) {
  const liftoff = minutesBefore <= 0;
  const text = liftoff ? m('launch.goingUp', { name: entry.name }) : m('launch.upcoming', { name: entry.name, when: earthly(entry.net) });
  const go = () => {
    window.focus();
    location.hash = '#/karte';
  };
  if (document.visibilityState === 'visible') {
    void import('../util').then((u) => u.toast(text, 'info'));
  }
  if (notifSupported() && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
    try {
      const n = new Notification(liftoff ? m('launch.notifGo', { name: entry.name }) : m('launch.notifPrefix', { when: earthly(entry.net) }), {
        body: liftoff && entry.video ? m('launch.openStream') : entry.provider ?? '',
        tag: `orbis-${entry.id}-${liftoff ? 'go' : `t${minutesBefore}`}`,
      });
      n.onclick = () => {
        go();
        n.close();
      };
    } catch {
      /* insecure context or blocked by the browser */
    }
  }
}

const earthly = (net: string) => {
  const d = new Date(net);
  const mins = Math.round((d.getTime() - Date.now()) / 60000);
  if (mins <= 1) return m('launch.lessThanMin');
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} h ${mins % 60} min`;
};

let reminderTimer: number | undefined;

/** Checks the stored reminders every 10 s and fires due notifications. */
export function initLaunchReminders() {
  if (reminderTimer != null) return;
  reminderTimer = window.setInterval(() => {
    const entries = loadJson<RemindEntry[]>(REMIND_KEY, []);
    if (!entries.length) return;
    const fired = new Set(loadJson<string[]>(FIRED_KEY, []));
    const now = Date.now();
    for (const e of entries) {
      const net = Date.parse(e.net);
      if (Number.isNaN(net)) continue;
      for (const m of e.minutes) {
        const at = net - m * 60000;
        const key = `${e.id}#${m}`;
        if (now >= at && now - at < 600000 && !fired.has(key)) {
          fired.add(key);
          fire(e, m);
        }
      }
    }
    // prune: keys older than 2 days or for gone entries
    const ids = new Set(entries.map((e) => e.id));
    save(FIRED_KEY, [...fired].filter((f) => {
      const id = f.slice(0, f.indexOf('#'));
      const m = Number(f.slice(f.indexOf('#') + 1));
      const e = entries.find((x) => x.id === id);
      return ids.has(id) && e && now <= Date.parse(e.net) - m * 60000 + 86400000;
    }));
  }, 10000);
}
