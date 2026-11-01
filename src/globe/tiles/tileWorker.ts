import { parseTile } from './parseTile';

// One worker of the pool: fetches a tile (through the Cache API, so a second visit costs no network),
// decodes it and hands back typed arrays. The main thread only has to build the meshes.

export type WorkerIn = { type: 'load'; id: number; urls: string[]; transform: number[]; maxTexture: number; upAxis: 'y' | 'z' } | { type: 'cancel'; id: number };
export type WorkerOut = { type: 'done'; id: number; data: Awaited<ReturnType<typeof parseTile>>['data'][] } | { type: 'fail'; id: number; error: string; aborted?: boolean };

const CACHE = 'orbis-tiles3d-v1';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const CACHE_BUDGET = 768 * 1024 * 1024;
const MAX_CACHE_ENTRIES = 1400;
const jobs = new Map<number, AbortController>();
const cancelled = new Set<number>();
let lastPrune = 0;

async function pruneCache(cache: Cache) {
  const now = Date.now();
  if (now - lastPrune < 60_000) return;
  lastPrune = now;
  const entries = await Promise.all((await cache.keys()).map(async (request) => {
    const response = await cache.match(request);
    const timestamp = Number(response?.headers.get('X-Orbis-Cached-At') ?? 0);
    const size = Number(response?.headers.get('X-Orbis-Cached-Bytes') ?? 2 * 1024 * 1024);
    return { request, timestamp, size };
  }));
  let bytes = entries.reduce((total, entry) => total + entry.size, 0);
  let count = entries.length;
  for (const entry of entries.sort((a, b) => a.timestamp - b.timestamp)) {
    if (now - entry.timestamp <= CACHE_TTL && count <= MAX_CACHE_ENTRIES && bytes <= CACHE_BUDGET) break;
    await cache.delete(entry.request);
    count--;
    bytes -= entry.size;
  }
}

async function fetchBytes(url: string, headers: Record<string, string> | undefined, signal: AbortSignal): Promise<ArrayBuffer> {
  const cache = typeof caches !== 'undefined' && !headers ? await caches.open(CACHE).catch(() => null) : null;
  const hit = cache ? await cache.match(url) : undefined;
  if (hit) {
    const storedAt = Number(hit.headers.get('X-Orbis-Cached-At') ?? 0);
    if (storedAt && Date.now() - storedAt < CACHE_TTL) return hit.arrayBuffer();
    await cache?.delete(url);
  }
  const res = await fetch(url, { signal, headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (cache) {
    const length = Number(res.headers.get('content-length') ?? 0);
    // Very large tiles are useful in memory but should not accumulate in the persistent browser cache.
    if (!length || length < CACHE_BUDGET / 8) {
      const copy = res.clone();
      const cacheHeaders = new Headers(copy.headers);
      cacheHeaders.set('X-Orbis-Cached-At', String(Date.now()));
      cacheHeaders.set('X-Orbis-Cached-Bytes', String(length || 2 * 1024 * 1024));
      const stored = new Response(copy.body, { status: copy.status, statusText: copy.statusText, headers: cacheHeaders });
      void cache.put(url, stored).then(() => pruneCache(cache)).catch(() => {});
    }
  }
  return res.arrayBuffer();
}

self.onmessage = async (e: MessageEvent<WorkerIn>) => {
  const m = e.data;
  if (m.type === 'cancel') {
    cancelled.add(m.id);
    jobs.get(m.id)?.abort();
    return;
  }
  const ctl = new AbortController();
  jobs.set(m.id, ctl);
  try {
    let firstError: unknown;
    const results = await Promise.allSettled(m.urls.map(async (url) => {
      try {
        const raw = await fetchBytes(url, undefined, ctl.signal);
        return await parseTile(raw, m.transform, m.maxTexture, m.upAxis);
      } catch (error) {
        firstError ??= error;
        ctl.abort();
        throw error;
      }
    }));
    const parsed = results.filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof parseTile>>> => r.status === 'fulfilled').map((r) => r.value);
    const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failed || ctl.signal.aborted) {
      for (const result of parsed) for (const mesh of result.data.meshes) for (const material of mesh.materials) for (const map of material.maps) map.image.close();
      throw firstError ?? failed?.reason ?? new DOMException('Aborted', 'AbortError');
    }
    const transfer = [...new Set(parsed.flatMap((p) => p.transfer))];
    (self as unknown as Worker).postMessage({ type: 'done', id: m.id, data: parsed.map((p) => p.data) } satisfies WorkerOut, transfer);
  } catch (err) {
    const aborted = cancelled.has(m.id);
    (self as unknown as Worker).postMessage({ type: 'fail', id: m.id, error: String((err as Error)?.message ?? err), aborted } satisfies WorkerOut);
  } finally {
    jobs.delete(m.id);
    cancelled.delete(m.id);
  }
};
