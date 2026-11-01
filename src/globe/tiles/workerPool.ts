import type { TileData } from './parseTile';
import type { WorkerIn, WorkerOut } from './tileWorker';

interface Task {
  id: number;
  urls: string[];
  transform: number[];
  maxTexture: number;
  upAxis: 'y' | 'z';
  resolve(data: TileData[]): void;
  reject(error: Error): void;
}

/** One bounded decoder pool for every active tileset, rather than a worker pool per source. */
class TileWorkerPool {
  private workers: Worker[] = [];
  private busy: boolean[] = [];
  private queue: Task[] = [];
  private active = new Map<number, { task: Task; worker: number }>();
  private nextId = 1;
  private unavailable = false;
  private readonly size = Math.max(2, Math.min(4, (navigator.hardwareConcurrency ?? 4) - 1));

  load(urls: string[], transform: number[], maxTexture: number, upAxis: 'y' | 'z' = 'y'): { promise: Promise<TileData[]>; cancel(): void } {
    let task!: Task;
    const promise = new Promise<TileData[]>((resolve, reject) => {
      task = { id: this.nextId++, urls, transform, maxTexture, upAxis, resolve, reject };
      if (!this.init()) {
        reject(new Error('Worker unavailable'));
        return;
      }
      this.queue.push(task);
      this.pump();
    });
    return { promise, cancel: () => this.cancel(task) };
  }

  private init() {
    if (this.unavailable) return false;
    if (this.workers.length) return true;
    try {
      for (let i = 0; i < this.size; i++) {
        const worker = new Worker(new URL('./tileWorker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (event: MessageEvent<WorkerOut>) => this.receive(i, event.data);
        worker.onerror = () => this.failWorker(i);
        this.workers.push(worker);
        this.busy.push(false);
      }
      return true;
    } catch {
      this.unavailable = true;
      for (const worker of this.workers) worker.terminate();
      this.workers = [];
      this.busy = [];
      return false;
    }
  }

  private pump() {
    if (this.unavailable) {
      for (const task of this.queue.splice(0)) task.reject(new Error('Worker unavailable'));
      return;
    }
    for (let i = 0; i < this.workers.length && this.queue.length; i++) {
      if (!this.workers[i] || this.busy[i]) continue;
      const task = this.queue.shift()!;
      this.busy[i] = true;
      this.active.set(task.id, { task, worker: i });
      try {
        this.workers[i].postMessage({ type: 'load', id: task.id, urls: task.urls, transform: task.transform, maxTexture: task.maxTexture, upAxis: task.upAxis } satisfies WorkerIn);
      } catch (error) {
        this.active.delete(task.id);
        this.busy[i] = false;
        task.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  private receive(worker: number, message: WorkerOut) {
    const active = this.active.get(message.id);
    if (!active || active.worker !== worker) {
      if (message.type === 'done') for (const content of message.data) for (const mesh of content.meshes) for (const material of mesh.materials) for (const map of material.maps) map.image.close();
      return;
    }
    this.active.delete(message.id);
    this.busy[worker] = false;
    if (message.type === 'done') active.task.resolve(message.data);
    else if (message.aborted) active.task.reject(new DOMException('Aborted', 'AbortError'));
    else active.task.reject(new Error(message.error));
    this.pump();
  }

  private cancel(task: Task) {
    const queued = this.queue.indexOf(task);
    if (queued >= 0) {
      this.queue.splice(queued, 1);
      task.reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const active = this.active.get(task.id);
    if (!active) return;
    this.active.delete(task.id);
    this.workers[active.worker].postMessage({ type: 'cancel', id: task.id } satisfies WorkerIn);
    this.busy[active.worker] = false;
    task.reject(new DOMException('Aborted', 'AbortError'));
    this.pump();
  }

  private failWorker(index: number) {
    const worker = this.workers[index];
    worker?.terminate();
    this.workers[index] = undefined as unknown as Worker;
    this.busy[index] = true;
    for (const [id, active] of [...this.active]) {
      if (active.worker !== index) continue;
      this.active.delete(id);
      active.task.reject(new Error('Worker unavailable'));
    }
    if (!this.workers.some(Boolean)) this.unavailable = true;
    this.pump();
  }
}

export const tileWorkerPool = new TileWorkerPool();
