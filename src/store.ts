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

/** route planner choices (src/routing) */
export interface RoutePrefs {
  profile?: 'car' | 'bike' | 'foot';
  /** routing provider id (src/routing/providers) */
  provider?: string;
  /** spoken guidance */
  voice?: boolean;
}

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
  /** data source of the id: DB or Transitous */
  src?: 'db' | 'motis';
}

/** a saved route: start and destination, the time is picked on every search */
export interface SavedRoute {
  id: string;
  from: SavedStop;
  to: SavedStop;
}

/** a saved connection for commuters: the same ride on chosen weekdays */
export interface SavedTrip {
  id: string;
  from: SavedStop;
  to: SavedStop;
  /** scheduled departure of the first ride / arrival at the destination, "07:12" */
  hm: string;
  arrHm: string;
  /** line of the first ride, e.g. "RE 8" */
  line: string;
  /** weekdays it runs on (0 = Sunday … 6 = Saturday) */
  days: number[];
  /** time zone `hm` was read in (the device zone when saved) – the push worker needs it when the device is elsewhere later */
  tz?: string;
  /** push notifications: minutes before departure, and whether on-time trains stay quiet */
  notify?: { leads: number[]; onlyDelay: boolean };
}

export const routeId = (from: SavedStop, to: SavedStop) => `${from.id}>${to.id}`;

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

  /** stops used in the Fahrplan search lately (newest first), offered when a field is focused */
  getRecentStops: (): SavedStop[] => read('wg.recentStops', []),
  pushRecentStop(s: SavedStop) {
    const list = [s, ...store.getRecentStops().filter((x) => x.id !== s.id)].slice(0, 8);
    write('wg.recentStops', list);
  },

  /** last seen run of saved trips that run soon or now, for offline use (see api/triprun.ts) */
  getRuns: (): Record<string, { at: number; dep: number; today: boolean; it: unknown }> => read('wg.runs', {}),
  setRun(id: string, run: { at: number; dep: number; today: boolean; it: unknown }) {
    write('wg.runs', { ...store.getRuns(), [id]: run });
  },
  /** drops the runs of trips that are not saved any more and those `useful` says are over */
  pruneRuns(keep: string[], useful: (r: { at: number; dep: number; today: boolean; it: unknown }) => boolean) {
    const all = store.getRuns();
    const next = Object.fromEntries(Object.entries(all).filter(([id, r]) => keep.includes(id) && useful(r)));
    if (Object.keys(next).length !== Object.keys(all).length) write('wg.runs', next);
  },

  getRoutes: (): SavedRoute[] => read('wg.routes', []),
  isRoute: (from: SavedStop, to: SavedStop) => store.getRoutes().some((r) => r.id === routeId(from, to)),
  toggleRoute(from: SavedStop, to: SavedStop): boolean {
    const all = store.getRoutes();
    const id = routeId(from, to);
    const idx = all.findIndex((r) => r.id === id);
    if (idx >= 0) all.splice(idx, 1);
    else all.push({ id, from, to });
    write('wg.routes', all);
    return idx < 0;
  },

  getTrips: (): SavedTrip[] => read('wg.trips', []),
  hasTrip: (id: string) => store.getTrips().some((t) => t.id === id),
  /** saves the trip, or removes it when it is saved already; returns whether it is saved now */
  toggleTrip(t: SavedTrip): boolean {
    const all = store.getTrips();
    const idx = all.findIndex((x) => x.id === t.id);
    if (idx >= 0) all.splice(idx, 1);
    else all.push(t);
    write('wg.trips', all);
    return idx < 0;
  },
  updateTrip(id: string, patch: Partial<SavedTrip>) {
    write('wg.trips', store.getTrips().map((t) => (t.id === id ? { ...t, ...patch } : t)));
  },

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

  getRoutePrefs: (): RoutePrefs => read('wg.route', {}),
  setRoutePrefs: (p: RoutePrefs) => write('wg.route', p),

  cacheGet<T>(key: string, maxAgeMs: number): T | null {
    const entry = read<{ t: number; v: T } | null>(`wg.cache.${key}`, null);
    return entry && Date.now() - entry.t < maxAgeMs ? entry.v : null;
  },
  cacheSet: (key: string, v: unknown) => write(`wg.cache.${key}`, { t: Date.now(), v }),
};

export function samePlace(a: Place, b: Place) {
  return Math.abs(a.lat - b.lat) < 0.01 && Math.abs(a.lon - b.lon) < 0.01;
}
