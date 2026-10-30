import type { Bounds, ModelVar, WxGrid } from './model';

// Forecast fields from the DWD ICON model, prepared by scripts/wx-icon.py (format: docs/WETTERDATEN-FORMAT.md)
// and served by proxy/wx-worker.js. A coarse 0.5° overview of the whole world (all time steps) is always
// loaded; when zoomed in, the 45° tiles (0.125°) covering the view are stitched into one detail grid.
// ModelSampler mixes both on top of the Open-Meteo grid and falls back to that wherever a field is missing.

export const WX_BASE = 'https://orbis-wx.malte9799.workers.dev';
const MAX_AGE_MS = 30 * 3600 * 1000;
const META_TTL_MS = 5 * 60 * 1000;
const TILE = 45;
const TILE_CELLS = 360;
/** a detail mosaic of more tiles than this would use too much memory (≈13 MB per tile and variable) */
const MAX_DETAIL_TILES = 6;
const MAX_CACHED = 16;

export interface WxMeta {
  v: number;
  run: string;
  issued: number;
  times: number[];
  attribution: string;
  vars: Record<string, { scale: number; offset: number; unit: string }>;
}

/** Switched on with ?wx=1 (off: ?wx=0); the choice is remembered. */
export function wxEnabled(): boolean {
  try {
    const q = new URLSearchParams(location.search).get('wx');
    if (q === '1' || q === '0') localStorage.setItem('wg.wx', q);
    return localStorage.getItem('wg.wx') === '1';
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// OWX decoding

interface OwxHeader {
  var: string;
  nt: number;
  ny: number;
  nx: number;
  lat0: number;
  lon0: number;
  dx: number;
  dy: number;
  wrap: boolean;
  scale: number;
  offset: number;
  nodata: number;
}

async function gunzip(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Inverse of encode() in scripts/wx-icon.py; values come out as Float32 with NaN for "missing". */
export async function decodeOwx(buf: ArrayBuffer): Promise<{ header: OwxHeader; values: Float32Array }> {
  const bytes = new Uint8Array(buf);
  if (bytes[0] !== 0x4f || bytes[1] !== 0x57 || bytes[2] !== 0x58 || bytes[3] !== 0x31) throw new Error('kein OWX-Format');
  const hl = new DataView(buf).getUint32(4, true);
  const header = JSON.parse(new TextDecoder().decode(bytes.subarray(8, 8 + hl))) as OwxHeader;
  const { nt, ny, nx, scale, offset, nodata } = header;
  const planes = await gunzip(bytes.subarray(8 + hl));
  const n = ny * nx;
  const total = nt * n;
  if (planes.length !== total * 2) throw new Error('OWX: unerwartete Länge');
  const values = new Float32Array(total);
  const s = new Int16Array(n); // spatial residual plane of the current step (int16 wraps like the encoder)
  const q = new Int16Array(n); // running sum over time
  for (let t = 0; t < nt; t++) {
    const o = t * n;
    for (let y = 0; y < ny; y++) {
      for (let x = 0; x < nx; x++) {
        const i = y * nx + x;
        const z = planes[o + i] | (planes[total + o + i] << 8);
        const d = (z >>> 1) ^ -(z & 1);
        s[i] = y === 0 ? (x === 0 ? d : s[i - 1] + d) : x === 0 ? s[i - nx] + d : d + s[i - 1] + s[i - nx] - s[i - nx - 1];
      }
    }
    for (let i = 0; i < n; i++) {
      q[i] = t === 0 ? s[i] : q[i] + s[i];
      values[o + i] = q[i] === nodata ? NaN : q[i] * scale + offset;
    }
  }
  return { header, values };
}

// ---------------------------------------------------------------------------
// Loading

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} – ${url}`);
  return res.json() as Promise<T>;
}

let metaCache: { at: number; promise: Promise<WxMeta> } | null = null;

export function getWxMeta(): Promise<WxMeta> {
  if (!metaCache || Date.now() - metaCache.at > META_TTL_MS) {
    const promise = getJson<WxMeta>(`${WX_BASE}/v1/latest.json`).then((m) => {
      if (m.v !== 1) throw new Error('Wetterdaten: unbekannte Version');
      if (Date.now() - m.issued > MAX_AGE_MS) throw new Error('Wetterdaten: Lauf zu alt');
      return m;
    });
    metaCache = { at: Date.now(), promise };
    promise.catch(() => {
      if (metaCache?.promise === promise) metaCache = null;
    });
  }
  return metaCache.promise;
}

const fileCache = new Map<string, Promise<{ header: OwxHeader; values: Float32Array }>>();

function getFile(run: string, variable: string, key: string) {
  const url = `${WX_BASE}/v1/${run}/${variable}/${key}.owx`;
  let p = fileCache.get(url);
  if (p) {
    // refresh the LRU position
    fileCache.delete(url);
    fileCache.set(url, p);
    return p;
  }
  p = fetch(url).then(async (res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status} – ${url}`);
    return decodeOwx(await res.arrayBuffer());
  });
  p.catch(() => fileCache.delete(url));
  fileCache.set(url, p);
  while (fileCache.size > MAX_CACHED) fileCache.delete(fileCache.keys().next().value!);
  return p;
}

/** Tile indices (column from the west, row from the north) covering the bounds, or null if too many. */
export function tilesFor(b: Bounds): { c0: number; c1: number; r0: number; r1: number } | null {
  const margin = 2;
  const west = Math.max(-180, b.west - margin);
  const east = Math.min(180, b.east + margin);
  const north = Math.min(90, b.north + margin);
  const south = Math.max(-90, b.south - margin);
  if (east <= west || north <= south) return null;
  const col = (lon: number) => Math.max(0, Math.min(360 / TILE - 1, Math.floor((lon + 180) / TILE)));
  const row = (lat: number) => Math.max(0, Math.min(180 / TILE - 1, Math.floor((90 - lat) / TILE)));
  const t = { c0: col(west), c1: col(east), r0: row(north), r1: row(south) };
  return (t.c1 - t.c0 + 1) * (t.r1 - t.r0 + 1) > MAX_DETAIL_TILES ? null : t;
}

/** Stitches 361×361 tiles (one cell of overlap) into one rectangular grid. */
function mosaic(tiles: { header: OwxHeader; values: Float32Array }[][], times: number[]): WxGrid {
  const rows = tiles.length;
  const cols = tiles[0].length;
  const nt = tiles[0][0].header.nt;
  const nx = cols * TILE_CELLS + 1;
  const ny = rows * TILE_CELLS + 1;
  const data = new Float32Array(nt * ny * nx);
  const tn = TILE_CELLS + 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const src = tiles[r][c].values;
      for (let t = 0; t < nt; t++) {
        for (let y = 0; y < tn; y++) {
          const from = (t * tn + y) * tn;
          data.set(src.subarray(from, from + tn), (t * ny + r * TILE_CELLS + y) * nx + c * TILE_CELLS);
        }
      }
    }
  }
  const h = tiles[0][0].header;
  return { lat0: h.lat0, lon0: h.lon0, dx: h.dx, dy: h.dy, nx, ny, wrap: false, times, data };
}

// ---------------------------------------------------------------------------

/** Fields of one model run: world overview per variable plus an optional detail mosaic for the view. */
export class WxLayer {
  private overview = new Map<ModelVar, WxGrid>();
  readonly detail = new Map<ModelVar, WxGrid>();
  private detailKey = '';
  private viewToken = 0;

  private constructor(readonly meta: WxMeta) {}

  get times(): number[] {
    return this.meta.times;
  }
  get stepMs(): number {
    return this.meta.times.length > 1 ? this.meta.times[1] - this.meta.times[0] : 3600_000;
  }
  get attribution(): string {
    return this.meta.attribution;
  }
  /** changes with the run and the detail area – goes into the tile URL so MapLibre re-requests tiles */
  get version(): string {
    return `${this.meta.run}-${this.detailKey}`;
  }

  has(v: ModelVar): boolean {
    return this.overview.has(v);
  }
  overviewOf(v: ModelVar): WxGrid | undefined {
    return this.overview.get(v);
  }

  /** null when the service is unavailable, outdated or has none of the variables */
  static async load(vars: ModelVar[]): Promise<WxLayer | null> {
    try {
      const meta = await getWxMeta();
      const layer = new WxLayer(meta);
      await Promise.all(
        vars
          .filter((v) => v in meta.vars)
          .map(async (v) => {
            const f = await getFile(meta.run, v, 'o');
            const h = f.header;
            layer.overview.set(v, { lat0: h.lat0, lon0: h.lon0, dx: h.dx, dy: h.dy, nx: h.nx, ny: h.ny, wrap: h.wrap, times: meta.times, data: f.values });
          }),
      );
      return layer.overview.size ? layer : null;
    } catch (e) {
      console.warn('Wetterdaten (ICON) nicht verfügbar', e);
      return null;
    }
  }

  /** Loads the 0.125° detail for the view (null: none). Resolves true when the detail grids changed. */
  async setView(b: Bounds | null, vars: ModelVar[]): Promise<boolean> {
    const token = ++this.viewToken;
    const sel = b ? tilesFor(b) : null;
    const wanted = vars.filter((v) => this.overview.has(v));
    const key = sel && wanted.length ? `${sel.c0}_${sel.r0}_${sel.c1}_${sel.r1}_${wanted.join('')}`.replace(/[^\w-]/g, '') : '';
    if (key === this.detailKey) return false;
    if (!sel || !wanted.length) {
      this.detail.clear();
      this.detailKey = '';
      return true;
    }
    try {
      const grids = new Map<ModelVar, WxGrid>();
      for (const v of wanted) {
        const rows: { header: OwxHeader; values: Float32Array }[][] = [];
        for (let r = sel.r0; r <= sel.r1; r++) {
          rows.push(await Promise.all(Array.from({ length: sel.c1 - sel.c0 + 1 }, (_, i) => getFile(this.meta.run, v, `t${sel.c0 + i}_${r}`))));
        }
        grids.set(v, mosaic(rows, this.meta.times));
      }
      if (token !== this.viewToken) return false; // a newer view request took over
      this.detail.clear();
      for (const [v, g] of grids) this.detail.set(v, g);
      this.detailKey = key;
      return true;
    } catch (e) {
      console.warn('ICON-Detailkacheln nicht verfügbar', e);
      return false;
    }
  }
}
