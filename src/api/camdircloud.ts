import type { Feature, Point } from 'geojson';
import { store } from '../store';

// Corrected viewing directions of webcams, kept in our own Cloudflare Worker (proxy/camdir-worker.js).
// Everybody reads them; writing needs the admin token (settings), later maybe suggestions of all users.
// (camdir.ts estimates directions from the road – these corrections win over every estimate.)

// import.meta.env is undefined when this is imported under Node
const BUILT_IN = (import.meta.env?.VITE_CAMDIR_URL as string | undefined)?.trim() || '';

export const builtInCamdir = () => BUILT_IN;

/** Worker address in use ('' without one) – the user's own address wins over the built-in one. */
export const camdirBase = (): string => (store.getKeys().camdirWorker?.trim() || BUILT_IN).replace(/\/+$/, '');

/** a token is entered: the camera panel may change directions */
export const camdirWritable = (): boolean => !!camdirBase() && !!store.getKeys().camdirToken?.trim();

/** Stable key of a camera: its feed id (if any) and rounded position – the feeds have no common id space. */
export const cloudKey = (id: unknown, lon: number, lat: number): string => `${id ?? ''}@${lat.toFixed(5)},${lon.toFixed(5)}`;

/** corrections from the worker (camera key → heading) and what is being previewed in the panel right now */
const remote = new Map<string, number>();
const local = new Map<string, number>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

/** called whenever a correction changed (loaded, previewed, saved, removed) */
export const onCamDirsChange = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const dirOverride = (key: string): number | undefined => local.get(key) ?? remote.get(key);
export const hasRemoteDir = (key: string) => remote.has(key);

/** the feature with its corrected direction (`dirset` marks it as not estimated), or itself without a correction */
export function withCloudDir<T extends Feature<Point>>(f: T): T {
  const c = f.geometry.coordinates;
  const d = dirOverride(cloudKey(f.properties?.id, c[0], c[1]));
  return d === undefined ? f : { ...f, properties: { ...f.properties, dir: d, dirset: true } };
}

/** shows a heading right away (before it is saved); null drops the preview */
export function previewDir(key: string, dir: number | null) {
  if (dir === null) local.delete(key);
  else local.set(key, ((dir % 360) + 360) % 360);
  emit();
}

let loadedAt = 0;
let loadedBase = '';

/** loads the corrections (at most every 5 minutes unless forced); {} / no change without a worker */
export async function loadCamDirs(force = false) {
  const base = camdirBase();
  if (!base) return;
  if (!force && loadedBase === base && Date.now() - loadedAt < 300_000) return;
  const res = await fetch(`${base}/dirs`);
  if (!res.ok) throw new Error(`Kamera-Richtungen: HTTP ${res.status}`);
  const json = (await res.json()) as { dirs?: Record<string, { d?: number }> };
  remote.clear();
  for (const [k, v] of Object.entries(json.dirs ?? {})) if (typeof v?.d === 'number' && Number.isFinite(v.d)) remote.set(k, v.d);
  loadedAt = Date.now();
  loadedBase = base;
  emit();
}

async function send(method: 'PUT' | 'DELETE', path: string, body?: unknown) {
  const token = store.getKeys().camdirToken?.trim();
  if (!camdirBase() || !token) throw new Error('Worker-Adresse und Token fehlen (Einstellungen)');
  const res = await fetch(`${camdirBase()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) throw new Error('Token wurde abgelehnt');
  if (!res.ok) throw new Error(`Worker antwortet mit HTTP ${res.status}`);
}

/** stores a corrected heading in the worker (admin token) */
export async function saveCamDir(key: string, dir: number) {
  const d = ((dir % 360) + 360) % 360;
  await send('PUT', '/dirs', { key, dir: d });
  remote.set(key, d);
  local.delete(key);
  emit();
}

/** removes the correction of a camera */
export async function removeCamDir(key: string) {
  await send('DELETE', `/dirs?key=${encodeURIComponent(key)}`);
  remote.delete(key);
  local.delete(key);
  emit();
}
