export interface ApiKeys {
  owm?: string;
  firms?: string;
  /** own CORS proxy for the live flight data */
  adsbProxy?: string;
  /** own RainViewer-compatible radar server (e.g. self-hosted LibreWXR) */
  radarHost?: string;
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
  /** US National Park Service API (free) */
  nps?: string;
  /** 511 Ontario API (free, Key request after sign-in at 511on.ca/developers) */
  ontario511?: string;
  /** 511 Alberta API (free, Key request after sign-in at 511.alberta.ca/developers) */
  alberta511?: string;
  /** Mapillary client token (free) – street photos for the street guessing game */
  mapillary?: string;
}

export interface AppOptions {
  /** a click on an empty spot of the map shows the weather there */
  clickWx?: boolean;
  /** precipitation rate */
  rain?: 'mm' | 'in' | 'dbz';
  /** temperature */
  temp?: 'c' | 'f';
  /** wind speed */
  wind?: 'kmh' | 'ms' | 'mph' | 'kn' | 'bft';
  /** wind direction */
  windDir?: 'compass' | 'deg';
  /** air pressure */
  pressure?: 'hpa' | 'mb' | 'mmhg' | 'inhg';
  /** distances */
  dist?: 'km' | 'mi' | 'nmi';
  /** areas */
  area?: 'km2' | 'mi2' | 'acre' | 'ha';
  /** burned area */
  burned?: 'km2' | 'mi2' | 'acre' | 'ha';
  /** coordinates */
  coords?: 'dec' | 'gms';
  /** clock */
  hour12?: '12h' | '24h';
  /** absolute event/report times in UTC or the device's time zone */
  tz?: 'auto' | 'utc';
}

/** defaults for whatever is not stored yet */
const APP_OPTION_DEFAULTS: AppOptions = {
  clickWx: true,
  rain: 'mm',
  temp: 'c',
  wind: 'kmh',
  windDir: 'compass',
  pressure: 'hpa',
  dist: 'km',
  area: 'km2',
  burned: 'km2',
  coords: 'dec',
  hour12: '24h',
  tz: 'auto',
};

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

  getHud: <T>(fallback: T): T => read('wg.hud', fallback),
  setHud: (s: unknown) => write('wg.hud', s),

  getKeys: (): ApiKeys => read('wg.keys', {}),
  setKeys: (k: ApiKeys) => write('wg.keys', k),

  getOptions: (): AppOptions => ({ ...APP_OPTION_DEFAULTS, ...read('wg.options', {}) }),
  setOptions: (o: AppOptions) => write('wg.options', o),

  cacheGet<T>(key: string, maxAgeMs: number): T | null {
    const entry = read<{ t: number; v: T } | null>(`wg.cache.${key}`, null);
    return entry && Date.now() - entry.t < maxAgeMs ? entry.v : null;
  },
  cacheSet: (key: string, v: unknown) => write(`wg.cache.${key}`, { t: Date.now(), v }),
};

export function samePlace(a: Place, b: Place) {
  return Math.abs(a.lat - b.lat) < 0.01 && Math.abs(a.lon - b.lon) < 0.01;
}
