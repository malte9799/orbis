import { decodeOwxRaw, type RawTile } from './owx';

// Decoding a tile takes 40–80 ms of pure number crunching; a view loads dozens of them. They run in a small pool of
// Web Workers so the map stays responsive while the data arrives (where workers do not exist – tests – it runs inline).

const POOL = 2;
let workers: Worker[] | null = null;
let next = 0;
let seq = 0;
const waiting = new Map<number, { ok: (t: RawTile) => void; fail: (e: Error) => void }>();

function pool(): Worker[] | null {
  if (workers) return workers;
  if (typeof Worker === 'undefined') return null;
  try {
    workers = Array.from({ length: POOL }, () => {
      const w = new Worker(new URL('./owx.worker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e: MessageEvent<{ id: number; tile?: RawTile; error?: string }>) => {
        const job = waiting.get(e.data.id);
        if (!job) return;
        waiting.delete(e.data.id);
        if (e.data.tile) job.ok(e.data.tile);
        else job.fail(new Error(e.data.error ?? 'OWX-Dekodierung fehlgeschlagen'));
      };
      return w;
    });
  } catch {
    workers = null;
  }
  return workers;
}

/** Decodes an OWX file; the buffer is handed over to the worker. */
export function decodeOffThread(buf: ArrayBuffer): Promise<RawTile> {
  const ws = pool();
  if (!ws) return decodeOwxRaw(buf);
  const id = ++seq;
  const w = ws[next++ % ws.length];
  return new Promise((ok, fail) => {
    waiting.set(id, { ok, fail });
    w.postMessage({ id, buf }, [buf]);
  });
}
