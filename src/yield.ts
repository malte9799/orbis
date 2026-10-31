// Cooperative scheduling for heavy main-thread work (drawing weather tiles, stitching data): the work is cut into
// slices of a few milliseconds and the browser gets a turn in between, so animations (wind particles, the timeline)
// do not stutter while tiles are being prepared.

let channel: MessageChannel | null = null;
const waiting: (() => void)[] = [];

/** Lets the browser handle input and draw a frame before the caller continues. */
export function yieldToMain(): Promise<void> {
  const s = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (s?.yield) return s.yield();
  if (typeof MessageChannel === 'undefined') return new Promise((r) => setTimeout(r));
  if (!channel) {
    channel = new MessageChannel();
    channel.port1.onmessage = () => waiting.shift()?.();
  }
  return new Promise((r) => {
    waiting.push(r);
    channel!.port2.postMessage(0);
  });
}

/** Call `tick()` often inside a long loop: it yields once the time budget of the current slice is used up. */
export class Slicer {
  private t0 = performance.now();
  constructor(
    private signal?: AbortSignal | null,
    private budgetMs = 7,
  ) {}
  async tick(): Promise<void> {
    if (performance.now() - this.t0 < this.budgetMs) return;
    await yieldToMain();
    if (this.signal?.aborted) throw new DOMException('aborted', 'AbortError');
    this.t0 = performance.now();
  }
}
