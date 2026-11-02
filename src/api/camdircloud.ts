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

/** Pose of the camera next to its heading: tilt below the horizon, height above the ground (m), roll, vertical field of view (all degrees but alt). */
export interface CamPose {
  down: number;
  alt: number;
  roll: number;
  fov: number;
}
interface Entry {
  d: number;
  p?: CamPose;
  /** corrected position [lng, lat] */
  pos?: [number, number];
}

/** corrections from the worker (camera key → heading, pose) and what is being previewed in the panel right now */
const remote = new Map<string, Entry>();
const local = new Map<string, Entry>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

/** called whenever a correction changed (loaded, previewed, saved, removed) */
export const onCamDirsChange = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export const dirOverride = (key: string): number | undefined => (local.get(key) ?? remote.get(key))?.d;
export const hasRemoteDir = (key: string) => remote.has(key);
export const remoteEntry = (key: string) => remote.get(key);

/** the feature with its corrected direction (`dirset` marks it as not estimated), or itself without a correction */
export function withCloudDir<T extends Feature<Point>>(f: T): T {
  const c = f.geometry.coordinates;
  const key = cloudKey(f.properties?.id, c[0], c[1]);
  const e = local.get(key) ?? remote.get(key);
  if (!e) return f;
  // the pose goes along as flat properties (map features only carry plain values); a moved camera keeps the key
  // and the place it was found at, so it can be saved and reset
  const moved = e.pos ? { ckey: key, olon: c[0], olat: c[1] } : {};
  return {
    ...f,
    ...(e.pos ? { geometry: { ...f.geometry, coordinates: e.pos } } : {}),
    properties: { ...f.properties, dir: e.d, dirset: true, ...moved, ...(e.p ? { pdown: e.p.down, palt: e.p.alt, proll: e.p.roll, pfov: e.p.fov } : {}) },
  };
}

/** the pose stored in a camera feature's properties (see withCloudDir), if there is one */
export function poseOf(p: Record<string, unknown> | null | undefined): CamPose | undefined {
  const n = [p?.pdown, p?.palt, p?.proll, p?.pfov].map(Number);
  return p && p.pdown !== undefined && n.every(Number.isFinite) ? { down: n[0], alt: n[1], roll: n[2], fov: n[3] } : undefined;
}

/** shows a heading (and pose, position) right away, before it is saved; null drops the preview */
export function previewDir(key: string, dir: number | null, pose?: CamPose, pos?: [number, number]) {
  if (dir === null) local.delete(key);
  else local.set(key, { d: ((dir % 360) + 360) % 360, p: pose ?? remote.get(key)?.p, pos });
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
  const json = (await res.json()) as { dirs?: Record<string, { d?: number; p?: Partial<CamPose>; pos?: number[] }> };
  remote.clear();
  for (const [k, v] of Object.entries(json.dirs ?? {})) {
    if (typeof v?.d !== 'number' || !Number.isFinite(v.d)) continue;
    const p = v.p;
    const ok = p && [p.down, p.alt, p.roll, p.fov].every((x) => typeof x === 'number' && Number.isFinite(x));
    const pos = Array.isArray(v.pos) && v.pos.length === 2 && v.pos.every((x) => Number.isFinite(x)) ? ([v.pos[0], v.pos[1]] as [number, number]) : undefined;
    remote.set(k, { d: v.d, p: ok ? (p as CamPose) : undefined, pos });
  }
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

/** stores a corrected heading (and the pose / moved position of the camera, if any) in the worker (admin token) */
export async function saveCamDir(key: string, dir: number, pose?: CamPose, pos?: [number, number]) {
  const d = ((dir % 360) + 360) % 360;
  await send('PUT', '/dirs', { key, dir: d, ...(pose ? { pose } : {}), ...(pos ? { pos } : {}) });
  remote.set(key, { d, p: pose, pos });
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
