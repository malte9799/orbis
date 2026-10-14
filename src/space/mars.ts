import { snapshotJson } from '../api/data';
import type { LandingSite } from './moon';

// Mars: landing sites, rover traverses and the Ingenuity flights. The traverses come from
// NASA's MMGIS (condensed by scripts/mars-traverse.mjs, refreshed in the data branch).

export const SOL_MS = 88_775_244;

export interface Track {
  /** ISO time of sol 0 */
  sol0: string;
  /** sol of every point */
  sol: number[];
  /** lon, lat pairs */
  ll: number[];
  /** driven distance in km */
  km: number;
}

export interface HeliFlight {
  n: number;
  sol: number;
  len: number;
  pts: number[];
}

export interface MarsTracks {
  updated: string;
  m20: Track;
  msl: Track;
  heli: { sol0: string; flights: HeliFlight[] };
}

let tracks: MarsTracks | null = null;
let loading: Promise<MarsTracks | null> | null = null;

export const getMarsTracks = () => tracks;

export function loadMarsTracks(): Promise<MarsTracks | null> {
  loading ??= snapshotJson<MarsTracks>('mars/traverse.json', async () => {
    const res = await fetch('./data/mars-traverse.json');
    if (!res.ok) throw new Error('mars traverse unavailable');
    return res.json();
  })
    .then((t) => (tracks = t))
    .catch((e) => {
      console.warn('Mars-Fahrspuren', e);
      return null;
    });
  return loading;
}

export const trackMs = (track: Track, i: number) => Date.parse(track.sol0) + track.sol[i] * SOL_MS;

/** Number of points of the track that were driven by time `ms`. */
export function trackCount(track: Track, ms: number): number {
  const t0 = Date.parse(track.sol0);
  const sol = (ms - t0) / SOL_MS;
  let lo = 0;
  let hi = track.sol.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (track.sol[mid] <= sol) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Position of a rover at time `ms` ([lon, lat]), null before the first point. */
export function roverAt(track: Track | undefined, ms: number): [number, number] | null {
  if (!track) return null;
  const n = trackCount(track, ms);
  if (!n) return null;
  return [track.ll[(n - 1) * 2], track.ll[(n - 1) * 2 + 1]];
}

/** Ingenuity: end of the latest flight started by `ms` (before the first flight: its airfield). */
export function heliAt(ms: number): [number, number] | null {
  const h = tracks?.heli;
  if (!h?.flights.length) return null;
  const t0 = Date.parse(h.sol0);
  let f: HeliFlight | null = null;
  for (const fl of h.flights) if (t0 + fl.sol * SOL_MS <= ms) f = fl;
  if (!f) {
    const p = h.flights[0].pts;
    return [p[0], p[1]];
  }
  return [f.pts[f.pts.length - 2], f.pts[f.pts.length - 1]];
}

export const solAt = (ms: number, sol0: string) => Math.floor((ms - Date.parse(sol0)) / SOL_MS);

export const MARS_SITES: LandingSite[] = [
  {
    id: 'viking1',
    body: 'mars',
    name: 'Viking 1',
    flag: 'us',
    date: '1976-07-20T11:53Z',
    lat: 22.27,
    lon: -47.95,
    region: 'Chryse Planitia',
    text: 'Erste erfolgreiche Landung auf dem Mars: Der Lander arbeitete über sechs Jahre und schickte die ersten Farbbilder von der Oberfläche.',
  },
  {
    id: 'viking2',
    body: 'mars',
    name: 'Viking 2',
    flag: 'us',
    date: '1976-09-03T22:37Z',
    lat: 47.67,
    lon: 134.26,
    region: 'Utopia Planitia',
    text: 'Zweiter Viking-Lander; seine Kamera zeigte erstmals Raureif auf dem Marsboden.',
  },
  {
    id: 'pathfinder',
    body: 'mars',
    name: 'Mars Pathfinder',
    flag: 'us',
    date: '1997-07-04T16:57Z',
    lat: 19.13,
    lon: -33.22,
    craft: 'Rover Sojourner',
    region: 'Ares Vallis',
    text: 'Brachte mit „Sojourner“ den ersten Rover auf den Mars und landete – airbaggedämpft – in einer Mündungsebene.',
  },
  {
    id: 'spirit',
    body: 'mars',
    name: 'Spirit (MER-A)',
    flag: 'us',
    date: '2004-01-04T04:35Z',
    lat: -14.57,
    lon: 175.47,
    craft: 'Mars Exploration Rover',
    region: 'Gusev-Krater',
    text: 'Sollte 90 Tage arbeiten und fuhr über sechs Jahre, bis er in weichem Sand stecken blieb (2010).',
  },
  {
    id: 'opportunity',
    body: 'mars',
    name: 'Opportunity (MER-B)',
    flag: 'us',
    date: '2004-01-25T05:05Z',
    lat: -1.95,
    lon: -5.53,
    craft: 'Mars Exploration Rover',
    region: 'Meridiani Planum',
    text: 'Fuhr fast 45 km – Rekord für ein außerirdisches Fahrzeug – und fand Hinweise auf früheres flüssiges Wasser. Kontakt 2018 nach einem Staubsturm verloren.',
  },
  {
    id: 'phoenix',
    body: 'mars',
    name: 'Phoenix',
    flag: 'us',
    date: '2008-05-25T23:53Z',
    lat: 68.22,
    lon: -125.7,
    region: 'Vastitas Borealis (Nordpolarebene)',
    text: 'Grub im Nordpolargebiet und bestätigte Wassereis dicht unter dem Marsboden.',
  },
  {
    id: 'curiosity',
    body: 'mars',
    name: 'Curiosity (MSL)',
    flag: 'us',
    date: '2012-08-06T05:17Z',
    lat: -4.5895,
    lon: 137.4417,
    craft: 'Rover Curiosity',
    region: 'Gale-Krater, Aeolis Palus',
    hideFlag: true,
    text: 'Der atomgetriebene Rover erkundet seit 2012 den Mount Sharp im Gale-Krater und fand organische Moleküle sowie Spuren eines früheren Sees.',
  },
  {
    id: 'insight',
    body: 'mars',
    name: 'InSight',
    flag: 'us',
    date: '2018-11-26T19:53Z',
    lat: 4.502,
    lon: 135.623,
    region: 'Elysium Planitia',
    text: 'Stationärer Lander mit Seismometer: zeichnete über 1 300 Marsbeben auf und vermaß den Aufbau des Planeteninneren.',
  },
  {
    id: 'perseverance',
    body: 'mars',
    name: 'Perseverance (Mars 2020)',
    flag: 'us',
    date: '2021-02-18T20:55Z',
    lat: 18.4446,
    lon: 77.4509,
    craft: 'Rover Perseverance, Hubschrauber Ingenuity',
    region: 'Jezero-Krater',
    hideFlag: true,
    text: 'Sammelt Gesteinsproben für eine spätere Rückführung zur Erde. Der mitgebrachte Hubschrauber Ingenuity absolvierte 72 Flüge (2021–2024).',
  },
  {
    id: 'zhurong',
    body: 'mars',
    name: 'Tianwen-1 / Zhurong',
    flag: 'cn',
    date: '2021-05-14T23:18Z',
    lat: 25.066,
    lon: 109.925,
    craft: 'Rover Zhurong',
    region: 'Utopia Planitia',
    text: 'Chinas erste Marslandung gelang gleich im ersten Anlauf; der Rover fuhr rund 1,9 km.',
  },
];

const M_PER_DEG = (2 * Math.PI * 3_389_500) / 360;
const cumCache = new WeakMap<Track, Float64Array>();

/** Driven distance in km after the first `n` points of a track. */
export function trackKm(track: Track, n: number): number {
  let cum = cumCache.get(track);
  if (!cum) {
    const count = track.sol.length;
    cum = new Float64Array(count);
    for (let i = 1; i < count; i++) {
      const lat = track.ll[i * 2 + 1];
      const dx = (track.ll[i * 2] - track.ll[(i - 1) * 2]) * Math.cos((lat * Math.PI) / 180) * M_PER_DEG;
      const dy = (lat - track.ll[(i - 1) * 2 + 1]) * M_PER_DEG;
      cum[i] = cum[i - 1] + Math.hypot(dx, dy) / 1000;
    }
    cumCache.set(track, cum);
  }
  return n > 0 ? cum[Math.min(n, cum.length) - 1] : 0;
}
