// Shared Overpass client for all OpenStreetMap layers (ÖPNV, resources, pipelines, webcams,
// ALPR, power). Public Overpass servers allow only a couple of parallel requests per IP and
// answer with 429/504 or drop connections beyond that – so all layers share one queue:
// - at most two requests in flight,
// - a newer request of the same layer replaces one still waiting (only the latest view counts),
// - a server that failed is skipped for a while (30 s, doubling up to 5 min),
// - with a data proxy (see proxy.ts) requests go through it first: it caches answers, so
//   visitors looking at the same area cost the public servers only one request.

import { proxyBase, viaProxy } from './proxy';

const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const MAX_PARALLEL = 2;

interface Job {
  key: string;
  query: string;
  timeoutMs: number;
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
}

const queue: Job[] = [];
let running = 0;
const health = new Map<string, { fails: number; until: number }>();

/** Rejection of a request that was replaced by a newer one of the same layer – ignore it. */
export class Superseded extends Error {
  name = 'Superseded';
}
export const isSuperseded = (e: unknown) => e instanceof Error && e.name === 'Superseded';

/** Run an Overpass QL query; `key` identifies the layer (one waiting request per key). */
export function overpass<T>(query: string, key: string, timeoutMs = 40000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const i = queue.findIndex((j) => j.key === key);
    if (i >= 0) queue.splice(i, 1)[0].reject(new Superseded('durch neuere Anfrage ersetzt'));
    queue.push({ key, query, timeoutMs, resolve: resolve as (v: unknown) => void, reject });
    pump();
  });
}

function pump() {
  while (running < MAX_PARALLEL && queue.length) {
    const job = queue.shift()!;
    running++;
    run(job)
      .then(job.resolve, job.reject)
      .finally(() => {
        running--;
        pump();
      });
  }
}

async function run(job: Job): Promise<unknown> {
  const now = Date.now();
  // proxied (GET, cacheable) first, direct (POST) as fallback
  const candidates = [...(proxyBase() ? ENDPOINTS.map((ep) => ({ ep, id: `proxy ${ep}`, proxied: true })) : []), ...ENDPOINTS.map((ep) => ({ ep, id: ep, proxied: false }))];
  const ready = candidates.filter((c) => (health.get(c.id)?.until ?? 0) <= now);
  if (!ready.length) throw new Error('Overpass-Server überlastet – neuer Versuch beim nächsten Verschieben');
  let lastErr: unknown;
  for (const { ep, id, proxied } of ready) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), job.timeoutMs);
    try {
      const res = proxied
        ? await fetch(viaProxy(`${ep}?data=${encodeURIComponent(job.query)}`), { signal: ctrl.signal })
        : await fetch(ep, { method: 'POST', body: new URLSearchParams({ data: job.query }), signal: ctrl.signal });
      if (!res.ok) {
        const err = new Error(`HTTP ${res.status} – ${id}`);
        // 400 = bad query: not the server's fault, another server won't help either
        if (res.status === 400) throw Object.assign(err, { fatal: true });
        throw err;
      }
      const data = await res.json();
      health.delete(id);
      return data;
    } catch (e) {
      if ((e as { fatal?: boolean }).fatal) throw e;
      // overloaded, rate-limited, timed out or unreachable: rest this server for a while
      const fails = (health.get(id)?.fails ?? 0) + 1;
      health.set(id, { fails, until: Date.now() + Math.min(300000, 30000 * 2 ** (fails - 1)) });
      lastErr = e instanceof Error && e.name === 'AbortError' ? new Error(`Zeitüberschreitung – ${id}`) : e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}
