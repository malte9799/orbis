import { parseTile } from './parseTile';

// One worker of the pool: fetches a tile (through the Cache API, so a second visit costs no network),
// decodes it and hands back typed arrays. The main thread only has to build the meshes.

export type WorkerIn = { type: 'load'; id: number; url: string; transform: number[]; headers?: Record<string, string> } | { type: 'cancel'; id: number };
export type WorkerOut = { type: 'done'; id: number; data: Awaited<ReturnType<typeof parseTile>>['data'] } | { type: 'fail'; id: number; error: string; aborted?: boolean };

const CACHE = 'orbis-tiles3d-v1';
const jobs = new Map<number, AbortController>();

async function fetchBytes(url: string, headers: Record<string, string> | undefined, signal: AbortSignal): Promise<ArrayBuffer> {
  const cache = typeof caches !== 'undefined' && !headers ? await caches.open(CACHE).catch(() => null) : null;
  const hit = cache ? await cache.match(url) : undefined;
  if (hit) return hit.arrayBuffer();
  const res = await fetch(url, { signal, headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (cache) cache.put(url, res.clone()).catch(() => {});
  return res.arrayBuffer();
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
    const { data, transfer } = await parseTile(raw, m.transform);
    (self as unknown as Worker).postMessage({ type: 'done', id: m.id, data } satisfies WorkerOut, transfer);
  } catch (err) {
    const aborted = ctl.signal.aborted;
    (self as unknown as Worker).postMessage({ type: 'fail', id: m.id, error: String((err as Error)?.message ?? err), aborted } satisfies WorkerOut);
  } finally {
    jobs.delete(m.id);
  }
};
