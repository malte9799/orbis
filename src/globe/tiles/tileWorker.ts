import { parseTile } from './parseTile';

// One worker of the pool: fetches a tile (through the Cache API, so a second visit costs no network),
// decodes it and hands back typed arrays. The main thread only has to build the meshes.

export type WorkerIn = { type: 'load'; id: number; url: string; transform: number[]; zUp?: boolean; headers?: Record<string, string> } | { type: 'cancel'; id: number };
export type WorkerOut = { type: 'done'; id: number; data: Awaited<ReturnType<typeof parseTile>>['data'] } | { type: 'fail'; id: number; error: string; aborted?: boolean };

const CACHE = 'orbis-tiles3d-v1';
const jobs = new Map<number, AbortController>();

const MAX_AGE_MS = 7 * 24 * 3600e3;
const MAX_CACHE_BYTES = 768 * 1024 * 1024;
const TRIM_TO_ENTRIES = 1000;
let puts = 0;

/** Bound persistent storage by bytes as well as count; tiles can be tens of MB each. */
async function trim(cache: Cache) {
  const keys = await cache.keys();
  const rows = await Promise.all(keys.map(async (key) => {
    const response = await cache.match(key);
    return { key, at: Number(response?.headers.get('x-cached-at') ?? 0), bytes: Number(response?.headers.get('x-cached-bytes') ?? 2 * 1024 * 1024) };
  }));
  let bytes = rows.reduce((total, row) => total + row.bytes, 0);
  let count = rows.length;
  for (const row of rows.sort((a, b) => a.at - b.at)) {
    if (count <= TRIM_TO_ENTRIES && bytes <= MAX_CACHE_BYTES) break;
    await cache.delete(row.key);
    count--;
    bytes -= row.bytes;
  }
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
  if (cache && buf.byteLength <= MAX_CACHE_BYTES / 8) {
    cache.put(url, new Response(buf.slice(0), { headers: { 'x-cached-at': String(Date.now()), 'x-cached-bytes': String(buf.byteLength) } })).then(() => {
      if (++puts % 25 === 0) void trim(cache).catch(() => {});
    }).catch(() => {});
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
