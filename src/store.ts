export interface ApiKeys {
  owm?: string;
  firms?: string;
  /** own CORS proxy for the live flight data */
  adsbProxy?: string;
  /** Windy Webcams API (free tier) */
  windy?: string;
  /** aisstream.io live AIS (free) */
  aisstream?: string;
  /** Transport Victoria open data (free KeyId) */
  victoria?: string;
  /** CTA Train Tracker (free) */
  cta?: string;
  /** Trafiklab GTFS Regional realtime (free) */
  trafiklab?: string;
}

export interface Place {
  name: string;
  lat: number;
  lon: number;
  region?: string;
  country?: string;
  countryCode?: string;
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode) – ignore */
  }
}

const DEFAULT_PLACE: Place = { name: 'Berlin', lat: 52.52, lon: 13.41, region: 'Berlin', country: 'Deutschland', countryCode: 'DE' };

export const store = {
  getLastPlace: (): Place => read('wg.lastPlace', DEFAULT_PLACE),
  setLastPlace: (p: Place) => write('wg.lastPlace', p),

  getFavorites: (): Place[] => read('wg.favorites', []),
  isFavorite: (p: Place) => store.getFavorites().some((f) => samePlace(f, p)),
  toggleFavorite(p: Place): boolean {
    const favs = store.getFavorites();
    const idx = favs.findIndex((f) => samePlace(f, p));
    if (idx >= 0) favs.splice(idx, 1);
    else favs.push(p);
    write('wg.favorites', favs);
    return idx < 0;
  },

  getGlobeState: <T>(fallback: T): T => read('wg.globe', fallback),
  setGlobeState: (s: unknown) => write('wg.globe', s),

  getKeys: (): ApiKeys => read('wg.keys', {}),
  setKeys: (k: ApiKeys) => write('wg.keys', k),

  cacheGet<T>(key: string, maxAgeMs: number): T | null {
    const entry = read<{ t: number; v: T } | null>(`wg.cache.${key}`, null);
    return entry && Date.now() - entry.t < maxAgeMs ? entry.v : null;
  },
  cacheSet: (key: string, v: unknown) => write(`wg.cache.${key}`, { t: Date.now(), v }),
};

export function samePlace(a: Place, b: Place) {
  return Math.abs(a.lat - b.lat) < 0.01 && Math.abs(a.lon - b.lon) < 0.01;
}
