// Snapshots of sources that browsers cannot query directly (no CORS headers or blocked
// origins). A scheduled GitHub Action (.github/workflows/data.yml) downloads them server-side
// into the `data` branch; raw.githubusercontent.com serves them with CORS enabled.
// Every loader falls back to the original source if the snapshot is unavailable.

function dataBase(): string {
  // Node (the data Action) has no location – snapshots are read only in the browser.
  if (typeof location === 'undefined') return 'https://raw.githubusercontent.com/malte9799/orbis/data/';
  // On GitHub Pages (owner.github.io/repo) use that repository, otherwise the main one.
  const m = /^([\w-]+)\.github\.io$/.exec(location.hostname);
  const repo = location.pathname.split('/').filter(Boolean)[0];
  if (m && repo) return `https://raw.githubusercontent.com/${m[1]}/${repo}/data/`;
  return 'https://raw.githubusercontent.com/malte9799/orbis/data/';
}

export const DATA_BASE = dataBase();

async function get(path: string, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(DATA_BASE + path, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} – ${path}`);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/** JSON snapshot from the data branch, else the live fallback. */
export async function snapshotJson<T>(path: string, live?: () => Promise<T>, timeoutMs = 30000): Promise<T> {
  try {
    return (await (await get(path, timeoutMs)).json()) as T;
  } catch (e) {
    if (!live) throw e;
    return live();
  }
}

/** Text snapshot (XML feeds) from the data branch, else the live fallback. */
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

/** Whether the data branch exists (meta.json is written by every run of the Action). */
export function snapshotsAvailable(): Promise<boolean> {
  available ??= get('meta.json', 10000)
    .then(() => true)
    .catch(() => false);
  return available;
}
