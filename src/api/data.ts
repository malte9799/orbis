// Snapshots of sources that browsers cannot query directly (no CORS headers or blocked origins). The data
// collectors write them to Cloudflare R2 (orbis-data, orbis-live, orbis-osm); override per VITE_*_BASE.
// Every loader falls back to the original source if the snapshot is unavailable.

function withSlash(u: string): string {
  return u.endsWith('/') ? u : u + '/';
}

const baseOf = (v: unknown, dflt: string) => withSlash(v ? String(v) : dflt);

export const DATA_BASE = baseOf(import.meta.env?.VITE_DATA_BASE, 'https://orbis-data.maltee.dev/');

// Schnell wechselnde Snapshots (Minuten-Takt): eigener Host (orbis-live).
export const LIVE_BASE = baseOf(import.meta.env?.VITE_LIVE_BASE, 'https://orbis-live.maltee.dev/');

// OSM-Kacheln (Kamera-Dichte, Blitzer …): PMTiles im Bucket orbis-osm.
export const OSM_BASE = baseOf(import.meta.env?.VITE_OSM_BASE, 'https://orbis-osm.maltee.dev/');

/** Whether the clock-worker mirrors on LIVE_BASE (orbis-live) are used – only with an explicit VITE_LIVE_BASE. */
export const LIVE_MIRROR = Boolean(import.meta.env?.VITE_LIVE_BASE);

/** URL of a mirror object (`events/gdacs.json` …) below `base`; null without a base = mirrors off. */
export function mirrorUrl(key: string, base: string | undefined | null): string | null {
  if (!base) return null;
  return withSlash(base) + key.replace(/^\/+/, '');
}

async function mirrorFetch<T>(key: string, read: (r: Response) => Promise<T>, live: () => Promise<T>, timeoutMs: number): Promise<T> {
  const url = mirrorUrl(key, LIVE_MIRROR ? LIVE_BASE : null);
  if (!url) return live();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} – ${key}`);
    return await read(res);
  } catch {
    return live();
  } finally {
    clearTimeout(timer);
  }
}

/** Raw upstream mirror of the clock worker (orbis-live) first, the original source as fallback. Without VITE_LIVE_BASE: live only. */
export const mirrorJson = <T>(key: string, live: () => Promise<T>, timeoutMs = 20000) => mirrorFetch<T>(key, (r) => r.json() as Promise<T>, live, timeoutMs);
export const mirrorText = (key: string, live: () => Promise<string>, timeoutMs = 20000) => mirrorFetch<string>(key, (r) => r.text(), live, timeoutMs);

const LIVE_PATHS = /^(tsunami\/|safecast\.json$|bfs-odl\.json$|stuk-fi\.json$|hc-ca\.json$|ssm-se\.json$|nusc-tw\.json$|firms\/world\.json$|demos\.json$)/;

async function get(path: string, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch((LIVE_PATHS.test(path) ? LIVE_BASE : DATA_BASE) + path, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} – ${path}`);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/** JSON snapshot from the data bucket, else the live fallback. */
export async function snapshotJson<T>(path: string, live?: () => Promise<T>, timeoutMs = 30000): Promise<T> {
  try {
    return (await (await get(path, timeoutMs)).json()) as T;
  } catch (e) {
    if (!live) throw e;
    return live();
  }
}

/** Text snapshot (XML feeds) from the data bucket, else the live fallback. */
export async function snapshotText(path: string, live?: () => Promise<string>, timeoutMs = 20000): Promise<string> {
  try {
    return await (await get(path, timeoutMs)).text();
  } catch (e) {
    if (!live) throw e;
    return live();
  }
}

export async function fetchText(url: string, timeoutMs = 20000): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} – ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

let available: Promise<boolean> | null = null;

/** Whether the data bucket is reachable (meta.json is written by every run of the Action). */
export function snapshotsAvailable(): Promise<boolean> {
  available ??= get('meta.json', 10000)
    .then(() => true)
    .catch(() => false);
  return available;
}
