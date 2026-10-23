// Mockup: records every fetch() the page makes, so the raw-data inspector can show what came back.
// Only the main thread is covered (MapLibre tiles and style files are fetched in a worker).

export type Kind = 'json' | 'xml' | 'text' | 'image' | 'model' | 'binary';

export interface Capture {
  id: number;
  url: string;
  host: string;
  method: string;
  status: number;
  ok: boolean;
  /** Content-Type header, without parameters */
  mime: string;
  kind: Kind;
  /** wall-clock start, ms since epoch */
  t: number;
  /** request duration in ms until the headers arrived */
  ms: number;
  /** body size in bytes (only known once the body was read) */
  size: number | null;
  /** route the user was on when the request started, e.g. "forecast" */
  route: string;
  text?: string;
  /** image the page loaded itself (<img>, texture): shown straight from its URL, the body was not read */
  imgUrl?: string;
  /** blob: URL for images */
  objectUrl?: string;
  /** body was not kept (too large, binary, stream) */
  skipped?: string;
  /** already looked at by the tile recogniser */
  tileChecked?: boolean;
  /** only the first N bytes of a very large text body were kept */
  truncated?: number;
  error?: string;
}

/** the real fetch, for requests the inspector makes itself (they must not show up in the list) */
const nativeFetch = window.fetch.bind(window);
export const rawFetch: typeof fetch = (...a) => nativeFetch(...a);

const MAX_KEEP = 250;
const MAX_IMAGE = 3_000_000;
/** text bodies up to this size are kept whole (the tree view builds nodes lazily) */
const MAX_TEXT = 25_000_000;
/** larger ones keep only this many leading bytes */
const PREVIEW = 1_000_000;
/** total text kept across all requests */
const BUDGET = 80_000_000;
const captures: Capture[] = [];
const listeners = new Set<() => void>();
let seq = 0;
let installed = false;

export function currentRoute(): string {
  const p = location.hash.replace(/^#/, '').split('?')[0];
  return p.startsWith('/spiele') ? 'games' : p.startsWith('/planet') || p.startsWith('/weltall') ? 'space' : p.startsWith('/karte') || p.startsWith('/globus') ? 'globe' : 'forecast';
}

export function getCaptures(): Capture[] {
  return captures;
}

export function onCaptures(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  listeners.forEach((fn) => fn());
}

/** other recorders (map tiles) report new data through the same channel */
export const emitChange = notify;

function kindOf(mime: string, url: string): Kind {
  if (/gltf|glb/.test(mime) || /\.(glb|gltf)(\?|$)/i.test(url)) return 'model';
  if (/json/.test(mime) || /\.(geo)?json(\?|$)/.test(url)) return 'json';
  if (!mime && /\.(png|jpe?g|webp|avif|gif)(\?|$)/i.test(url)) return 'image';
  if (/xml|svg|gml|kml/.test(mime)) return 'xml';
  if (mime.startsWith('image/')) return 'image';
  if (/^text\/|javascript|csv|yaml/.test(mime)) return 'text';
  return 'binary';
}

function evict() {
  while (captures.length > MAX_KEEP) {
    const old = captures.shift()!;
    if (old.objectUrl) URL.revokeObjectURL(old.objectUrl);
  }
}

/** Resources the page loads without fetch() (<img>, textures, CSS images) only show up in the resource timeline. */
const EXT_OTHER = /\.(png|jpe?g|webp|avif|gif|svg|glb|gltf|json|pbf)(\?|$)/i;
const SKIP_PATH = /\/(src|node_modules|@vite|@id|@fs)\//;

function observeResources() {
  if (typeof PerformanceObserver === 'undefined') return;
  const handle = (e: PerformanceResourceTiming) => {
    if (e.initiatorType === 'fetch' || e.initiatorType === 'xmlhttprequest' || e.initiatorType === 'beacon') return;
    const abs = new URL(e.name, location.href);
    if (!/^https?:$/.test(abs.protocol) || SKIP_PATH.test(abs.pathname)) return;
    const img = e.initiatorType === 'img' || e.initiatorType === 'css';
    if (!img && !(e.initiatorType === 'other' && EXT_OTHER.test(abs.pathname + abs.search))) return;
    if (img && /\.(css|js|mjs|ts|woff2?|ttf)(\?|$)/i.test(abs.pathname)) return;
    const kind = kindOf('', abs.href);
    const cap: Capture = {
      id: ++seq,
      url: abs.href,
      host: abs.host,
      method: 'GET',
      status: (e as PerformanceResourceTiming & { responseStatus?: number }).responseStatus || 200,
      ok: true,
      mime: '',
      kind: img && kind === 'binary' ? 'image' : kind,
      t: Math.round(performance.timeOrigin + e.startTime),
      ms: Math.round(e.duration),
      size: e.decodedBodySize || e.encodedBodySize || null,
      route: currentRoute(),
      tileChecked: undefined,
    };
    if (cap.kind === 'image') cap.imgUrl = cap.url;
    captures.push(cap);
    evict();
  };
  new PerformanceObserver((list) => {
    list.getEntries().forEach((e) => handle(e as PerformanceResourceTiming));
    notify();
  }).observe({ type: 'resource', buffered: true });
}

export function installCapture() {
  if (installed) return;
  installed = true;
  observeResources();
  const orig = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!/^https?:/.test(url) && !url.startsWith('/') && !url.startsWith('./')) return orig(input, init);
    const abs = new URL(url, location.href);
    const cap: Capture = {
      id: ++seq,
      url: abs.href,
      host: abs.host,
      method: (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase(),
      status: 0,
      ok: false,
      mime: '',
      kind: 'binary',
      t: Date.now(),
      ms: 0,
      size: null,
      route: currentRoute(),
    };
    captures.push(cap);
    evict();
    notify();
    const t0 = performance.now();
    let res: Response;
    try {
      res = await orig(input, init);
    } catch (e) {
      cap.ms = Math.round(performance.now() - t0);
      cap.error = e instanceof Error ? e.message : String(e);
      notify();
      throw e;
    }
    cap.ms = Math.round(performance.now() - t0);
    cap.status = res.status;
    cap.ok = res.ok;
    cap.mime = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    cap.kind = kindOf(cap.mime, abs.pathname);
    notify();
    void readBody(cap, res.clone());
    return res;
  };
}

/** drop the bodies of the oldest requests once the kept text exceeds the budget */
function trimBudget() {
  let total = 0;
  for (let i = captures.length - 1; i >= 0; i--) {
    const c = captures[i];
    total += c.text?.length ?? 0;
    if (total > BUDGET && c.text) {
      total -= c.text.length;
      c.text = undefined;
      c.skipped = 'aus dem Speicher entfernt (Älteres wird verworfen)';
    }
  }
}

async function readBody(cap: Capture, res: Response) {
  const len = Number(res.headers.get('content-length')) || 0;
  if (cap.mime === 'text/event-stream') cap.skipped = 'Stream';
  // 3D models are fetched again by the viewer itself (they can be huge)
  else if (cap.kind === 'model') return notify();
  else if (cap.kind === 'binary') cap.skipped = 'Binärdaten';
  else if (cap.kind === 'image' && len > MAX_IMAGE) {
    cap.size = len;
    cap.skipped = 'zu groß für die Vorschau';
  }
  if (cap.skipped) return notify();
  try {
    if (cap.kind === 'image') {
      const buf = await res.arrayBuffer();
      cap.size = buf.byteLength;
      if (buf.byteLength > MAX_IMAGE) cap.skipped = 'zu groß für die Vorschau';
      else cap.objectUrl = URL.createObjectURL(new Blob([buf], { type: cap.mime }));
    } else {
      // text: read the stream; a body above the limit is cut off after the first PREVIEW bytes
      const limit = len > MAX_TEXT ? PREVIEW : MAX_TEXT;
      const reader = res.body!.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      let cut = false;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        total += value.length;
        if (total > limit) {
          cut = true;
          await reader.cancel();
          break;
        }
      }
      const bytes = new Uint8Array(Math.min(total, cut ? PREVIEW : total));
      let at = 0;
      for (const c of chunks) {
        if (at >= bytes.length) break;
        const part = c.subarray(0, bytes.length - at);
        bytes.set(part, at);
        at += part.length;
      }
      cap.text = new TextDecoder().decode(bytes);
      cap.size = cut ? (len || null) : total;
      if (cut) cap.truncated = bytes.length;
      trimBudget();
    }
  } catch (e) {
    cap.error = e instanceof Error ? e.message : String(e);
  }
  notify();
}
