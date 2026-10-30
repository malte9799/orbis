import { parseTile } from './parseTile';

// One worker of the pool: fetches a tile (through the Cache API, so a second visit costs no network),
// decodes it and hands back typed arrays. The main thread only has to build the meshes.

export type WorkerIn = { type: 'load'; id: number; url: string; transform: number[]; zUp?: boolean; headers?: Record<string, string> } | { type: 'cancel'; id: number };
export type WorkerOut = { type: 'done'; id: number; data: Awaited<ReturnType<typeof parseTile>>['data'] } | { type: 'fail'; id: number; error: string; aborted?: boolean };

const CACHE = 'orbis-tiles3d-v1';
const jobs = new Map<number, AbortController>();

const MAX_AGE_MS = 7 * 24 * 3600e3;
const MAX_ENTRIES = 4000;
const TRIM_TO = 3000;
let puts = 0;

/** the cache grows without bound otherwise: drops the oldest entries (the keys come in insertion order) */
async function trim(cache: Cache) {
  const keys = await cache.keys();
  if (keys.length > MAX_ENTRIES) await Promise.all(keys.slice(0, keys.length - TRIM_TO).map((k) => cache.delete(k)));
}

async function fetchBytes(url: string, headers: Record<string, string> | undefined, signal: AbortSignal): Promise<ArrayBuffer> {
  const cache = typeof caches !== 'undefined' && !headers ? await caches.open(CACHE).catch(() => null) : null;
  const hit = cache ? await cache.match(url) : undefined;
  if (hit) {
    if (Date.now() - Number(hit.headers.get('x-cached-at') ?? 0) < MAX_AGE_MS) return hit.arrayBuffer();
    void cache!.delete(url);
  }
  const res = await fetch(url, { signal, headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  if (cache) {
    cache.put(url, new Response(buf.slice(0), { headers: { 'x-cached-at': String(Date.now()) } })).catch(() => {});
    if (++puts % 100 === 0) void trim(cache).catch(() => {});
  }
  return buf;
}

self.onmessage = async (e: MessageEvent<WorkerIn>) => {
  const m = e.data;
  if (m.type === 'cancel') {
    jobs.get(m.id)?.abort();
    return;
  }
  const ctl = new AbortController();
  jobs.set(m.id, ctl);
  try {
    const raw = await fetchBytes(m.url, m.headers, ctl.signal);
    const { data, transfer } = await parseTile(raw, m.transform, undefined, m.zUp);
    (self as unknown as Worker).postMessage({ type: 'done', id: m.id, data } satisfies WorkerOut, transfer);
  } catch (err) {
    const aborted = ctl.signal.aborted;
    (self as unknown as Worker).postMessage({ type: 'fail', id: m.id, error: String((err as Error)?.message ?? err), aborted } satisfies WorkerOut);
  } finally {
    jobs.delete(m.id);
  }
};
