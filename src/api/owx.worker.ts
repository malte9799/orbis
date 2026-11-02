import { decodeOwxRaw } from './owx';

self.onmessage = async (e: MessageEvent<{ id: number; buf: ArrayBuffer }>) => {
  const { id, buf } = e.data;
  try {
    const tile = await decodeOwxRaw(buf);
    (self as unknown as Worker).postMessage({ id, tile }, [tile.q.buffer]);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String(err) });
  }
};
