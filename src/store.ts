/** API keys of the user (see src/settings/keys: one file per key) */
export type ApiKeys = Record<string, string | undefined>;

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
  /** heights, depths, wave heights (m / ft) */
  height?: 'm' | 'ft';
  /** coordinates */
  coords?: 'dec' | 'gms';
  /** clock */
  hour12?: '12h' | '24h';
  /** absolute event/report times in UTC or the device's time zone */
  tz?: 'auto' | 'utc';
}

/** fired on `window` after the unit/display options changed */
export const OPTIONS_EVENT = 'wg:options';

/** defaults for whatever is not stored yet */
const APP_OPTION_DEFAULTS: AppOptions = {
  clickWx: true,
  rain: 'mm',
  temp: 'c',
  wind: 'kmh',
  windDir: 'compass',
  pressure: 'hpa',
  dist: 'km',
  height: 'm',
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

export interface SavedStop {
  id: string;
  name: string;
  lat: number;
  lon: number;
  area?: string;
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

  /** saved public transport stops (Fahrplan) */
  getStations: (): SavedStop[] => read('wg.stations', []),
  isStation: (id: string) => store.getStations().some((s) => s.id === id),
  toggleStation(s: SavedStop): boolean {
    const all = store.getStations();
    const idx = all.findIndex((x) => x.id === s.id);
    if (idx >= 0) all.splice(idx, 1);
    else all.push(s);
    write('wg.stations', all);
    return idx < 0;
  },

  /** last connection search endpoints (Fahrplan) */
  getLastRoute: (): { from?: SavedStop; to?: SavedStop } => read('wg.lastRoute', {}),
  setLastRoute: (r: { from?: SavedStop; to?: SavedStop }) => write('wg.lastRoute', r),

  /** connection search options (Fahrplan), see FpOptions */
  getFpOptions: (): Record<string, unknown> => read('wg.fpOptions', {}),
  setFpOptions: (o: Record<string, unknown>) => write('wg.fpOptions', o),

  getGlobeState: <T>(fallback: T): T => read('wg.globe', fallback),
  setGlobeState: (s: unknown) => write('wg.globe', s),

  getHud: <T>(fallback: T): T => read('wg.hud', fallback),
  setHud: (s: unknown) => write('wg.hud', s),

  getKeys: (): ApiKeys => read('wg.keys', {}),
  setKeys: (k: ApiKeys) => write('wg.keys', k),

  getOptions: (): AppOptions => ({ ...APP_OPTION_DEFAULTS, ...read('wg.options', {}) }),
  setOptions: (o: AppOptions) => {
    write('wg.options', o);
    // visible legends/readouts re-render with the new units
    window.dispatchEvent(new Event(OPTIONS_EVENT));
  },

  cacheGet<T>(key: string, maxAgeMs: number): T | null {
    const entry = read<{ t: number; v: T } | null>(`wg.cache.${key}`, null);
    return entry && Date.now() - entry.t < maxAgeMs ? entry.v : null;
  },
  cacheSet: (key: string, v: unknown) => write(`wg.cache.${key}`, { t: Date.now(), v }),
};

export function samePlace(a: Place, b: Place) {
  return Math.abs(a.lat - b.lat) < 0.01 && Math.abs(a.lon - b.lon) < 0.01;
}
