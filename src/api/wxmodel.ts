import type { Bounds, ModelVar, WxGrid } from './model';
import { decodeOwxRaw, type OwxHeader, type RawTile } from './owx';
import { decodeOffThread } from './owxpool';
import { yieldToMain } from '../yield';

export { decodeOwxRaw };

// Forecast fields from the DWD ICON model, prepared by scripts/wx-icon.py (format: docs/WETTERDATEN-FORMAT.md)
// and served by proxy/wx-worker.js. A coarse 0.5° overview of the whole world (all time steps) is always
// loaded; when zoomed in, the 45° tiles (0.125°) covering the view are stitched into one detail grid.
// ModelSampler mixes both on top of the Open-Meteo grid and falls back to that wherever a field is missing.

export const WX_BASE = 'https://orbis-wx.malte9799.workers.dev';
const MAX_AGE_MS = 30 * 3600 * 1000;
const META_TTL_MS = 5 * 60 * 1000;
const TILE = 45;
/** a detail mosaic is held as 16-bit numbers (≈6.5 MB per tile and variable); more tiles than this are too much */
const MAX_DETAIL_TILES = 12;
const DEM_PATH = 'static/dem';
const META_TIMEOUT_MS = 15_000;
const FILE_TIMEOUT_MS = 40_000;

export interface WxMeta {
  v: number;
  run: string;
  issued: number;
  times: number[];
  attribution: string;
  vars: Record<string, { scale: number; offset: number; unit: string; static?: boolean }>;
}

/** The ICON fields are the default; ?wx=0 switches them off (Open-Meteo only), for comparing and debugging. */
export function wxEnabled(): boolean {
  try {
    return new URLSearchParams(location.search).get('wx') !== '0';
  } catch {
    return true;
  }
}

// ---------------------------------------------------------------------------
// OWX decoding

/** Quantised numbers → values (NaN for "missing"). */
function dequantize(h: OwxHeader, q: Int16Array, from = 0, count = q.length): Float32Array {
  const out = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const v = q[from + i];
    out[i] = v === h.nodata ? NaN : v * h.scale + h.offset;
  }
  return out;
}

/** Decoded values as Float32 (all time steps). */
export async function decodeOwx(buf: ArrayBuffer): Promise<{ header: OwxHeader; values: Float32Array }> {
  const { header, q } = await decodeOwxRaw(buf);
  return { header, values: dequantize(header, q) };
}

/** All steps in memory as Float32 (the small world overview). */
class FloatGrid implements WxGrid {
  private views: Float32Array[] = [];
  readonly lat0: number;
  readonly lon0: number;
  readonly dx: number;
  readonly dy: number;
  readonly nx: number;
  readonly ny: number;
  readonly wrap: boolean;
  constructor(h: OwxHeader, values: Float32Array) {
    ({ lat0: this.lat0, lon0: this.lon0, dx: this.dx, dy: this.dy, nx: this.nx, ny: this.ny, wrap: this.wrap } = h);
    const n = h.nx * h.ny;
    for (let t = 0; t < h.nt; t++) this.views.push(values.subarray(t * n, (t + 1) * n));
  }
  step(t: number): Float32Array {
    return this.views[Math.max(0, Math.min(this.views.length - 1, t))];
  }
}

/** Detail mosaic held as 16-bit numbers; a time step is expanded to Float32 when it is needed (small LRU). */
class QuantGrid implements WxGrid {
  // two time steps are in use at any moment (before and after the shown time); four slots leave room while playing, and avoid map lookups per sample
  private slots: { t: number; a: Float32Array }[] = [];
  readonly lat0: number;
  readonly lon0: number;
  readonly dx: number;
  readonly dy: number;
  readonly nx: number;
  readonly ny: number;
  readonly wrap = false;
  readonly nt: number;
  constructor(private h: OwxHeader, private q: Int16Array) {
    ({ lat0: this.lat0, lon0: this.lon0, dx: this.dx, dy: this.dy, nx: this.nx, ny: this.ny, nt: this.nt } = h);
  }
  step(t: number): Float32Array {
    const i = Math.max(0, Math.min(this.nt - 1, t));
    const slots = this.slots;
    for (let k = 0; k < slots.length; k++) if (slots[k].t === i) return slots[k].a;
    const n = this.nx * this.ny;
    const a = dequantize(this.h, this.q, i * n, n);
    if (slots.length < 4) slots.push({ t: i, a });
    else slots[(this.slotNext = (this.slotNext + 1) % 4)] = { t: i, a };
    return a;
  }
  private slotNext = 0;
}

// ---------------------------------------------------------------------------
// Loading

/** fetch that gives up after a while – the ICON fields are optional and must never hold up the map */
async function fetchOk(url: string, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} – ${url}`);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function getJson<T>(url: string): Promise<T> {
  return (await fetchOk(url, META_TIMEOUT_MS)).json() as Promise<T>;
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

async function loadRaw(path: string): Promise<RawTile> {
  const res = await fetchOk(`${WX_BASE}/v1/${path}.owx`, FILE_TIMEOUT_MS);
  return decodeOffThread(await res.arrayBuffer());
}

// Only the (small) overviews stay in memory. Decoded tiles are copied into the detail mosaic and then
// dropped – the browser's HTTP cache keeps the compressed files (immutable), so panning back is cheap
// and the memory use is bounded by MAX_DETAIL_TILES.
const overviewCache = new Map<string, Promise<WxGrid>>();

function getOverview(run: string, variable: string): Promise<WxGrid> {
  const id = `${run}/${variable}`;
  let p = overviewCache.get(id);
  if (!p) {
    p = loadRaw(`${run}/${variable}/o`).then(({ header, q }) => new FloatGrid(header, dequantize(header, q)));
    p.catch(() => overviewCache.delete(id));
    overviewCache.set(id, p);
    while (overviewCache.size > 8) overviewCache.delete(overviewCache.keys().next().value!);
  }
  return p;
}

/** Overviews of several variables; each succeeds or fails on its own (a failed one stays with Open-Meteo, the others are kept). */
async function loadOverviews(run: string, vars: ModelVar[]): Promise<[ModelVar, WxGrid][]> {
  const results = await Promise.allSettled(vars.map((v) => getOverview(run, v)));
  const ok: [ModelVar, WxGrid][] = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') ok.push([vars[i], r.value]);
    else console.warn(`Wetterdaten (ICON): ${vars[i]} nicht verfügbar`, r.reason);
  });
  return ok;
}

/** Variables the ICON fields hold themselves (the others are derived from them in ModelSampler). */
export const WX_VARS: ModelVar[] = ['temperature_2m', 'dew_point_2m', 'u', 'v', 'wind_gusts_10m', 'precipitation', 'cloud_cover', 'pressure_msl', 'snow_depth', 'cape'];

/** Which stored variables a displayed variable needs. */
export function wxDeps(v: ModelVar): ModelVar[] {
  switch (v) {
    case 'wind_speed_10m':
    case 'wind_direction_10m':
      return ['u', 'v'];
    case 'relative_humidity_2m':
      return ['temperature_2m', 'dew_point_2m'];
    case 'apparent_temperature':
      return ['temperature_2m', 'dew_point_2m', 'u', 'v'];
    default:
      return (WX_VARS as string[]).includes(v) ? [v] : [];
  }
}

/** Tile indices (column from the west, row from the north) covering the bounds, or null if too many. */
export function tilesFor(b: Bounds, max = MAX_DETAIL_TILES): { c0: number; c1: number; r0: number; r1: number } | null {
  const margin = 2;
  const west = Math.max(-180, b.west - margin);
  const east = Math.min(180, b.east + margin);
  const north = Math.min(90, b.north + margin);
  const south = Math.max(-90, b.south - margin);
  if (east <= west || north <= south) return null;
  const col = (lon: number) => Math.max(0, Math.min(360 / TILE - 1, Math.floor((lon + 180) / TILE)));
  const row = (lat: number) => Math.max(0, Math.min(180 / TILE - 1, Math.floor((90 - lat) / TILE)));
  const t = { c0: col(west), c1: col(east), r0: row(north), r1: row(south) };
  return (t.c1 - t.c0 + 1) * (t.r1 - t.r0 + 1) > max ? null : t;
}

/** Stitches tiles (one cell of overlap) into one rectangular grid held as 16-bit numbers. */
export function mosaic(tiles: RawTile[][]): WxGrid {
  const m = startMosaic(tiles);
  for (let r = 0; r < tiles.length; r++) for (let c = 0; c < tiles[0].length; c++) m.copy(r, c);
  return m.done();
}

/** Same as mosaic(), but copies tile by tile with the browser getting a turn in between (up to 80 MB are moved). */
export async function mosaicYielding(tiles: RawTile[][]): Promise<WxGrid> {
  const m = startMosaic(tiles);
  for (let r = 0; r < tiles.length; r++) {
    for (let c = 0; c < tiles[0].length; c++) {
      m.copy(r, c);
      await yieldToMain();
    }
  }
  return m.done();
}

function startMosaic(tiles: RawTile[][]) {
  const rows = tiles.length;
  const cols = tiles[0].length;
  const h0 = tiles[0][0].header;
  const nt = h0.nt;
  const cells = h0.nx - 1;
  const tn = cells + 1;
  const nx = cols * cells + 1;
  const ny = rows * cells + 1;
  const q = new Int16Array(nt * ny * nx);
  return {
    copy(r: number, c: number) {
      const src = tiles[r][c].q;
      for (let t = 0; t < nt; t++) {
        for (let y = 0; y < tn; y++) {
          const from = (t * tn + y) * tn;
          q.set(src.subarray(from, from + tn), (t * ny + r * cells + y) * nx + c * cells);
        }
      }
    },
    done: (): WxGrid => new QuantGrid({ ...h0, nx, ny }, q),
  };
}

// ---------------------------------------------------------------------------

/** Fields of one model run: world overview per variable plus an optional detail mosaic for the view. */
export class WxLayer {
  private overview = new Map<ModelVar, WxGrid>();
  /** detail mosaics for the view: the variables plus the model surface height ('hsurf') */
  readonly detail = new Map<string, WxGrid>();
  /** terrain heights for the view (src/api/wxmodel.ts: DEM_PATH), null while not loaded */
  private dem: WxGrid | null = null;
  private detailKey = '';
  private viewToken = 0;
  /** counts changes of the loaded data, so the tile URL changes with every one */
  private rev = 0;

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
    return `${this.meta.run}-${this.rev}-${this.detailKey}`;
  }

  /** the run is too old to be shown (checked on every use, not only when loading) */
  get expired(): boolean {
    return Date.now() - this.meta.issued > MAX_AGE_MS;
  }

  has(v: ModelVar): boolean {
    return !this.expired && this.overview.has(v);
  }
  overviewOf(v: ModelVar): WxGrid | undefined {
    return this.overview.get(v);
  }

  /** model surface height and terrain height of the view – for the temperature correction; null if either is missing */
  get terrain(): { hs: WxGrid; dem: WxGrid } | null {
    const hs = this.detail.get('hsurf');
    return hs && this.dem ? { hs, dem: this.dem } : null;
  }

  /** null when the service is unavailable, outdated or has none of the variables */
  static async load(vars: ModelVar[]): Promise<WxLayer | null> {
    try {
      const meta = await getWxMeta();
      const layer = new WxLayer(meta);
      for (const [v, g] of await loadOverviews(meta.run, vars.filter((v) => v in meta.vars))) layer.overview.set(v, g);
      return layer;
    } catch (e) {
      console.warn('Wetterdaten (ICON) nicht verfügbar', e);
      return null;
    }
  }

  private async loadMosaic(sel: { c0: number; c1: number; r0: number; r1: number }, path: (c: number, r: number) => string): Promise<WxGrid> {
    // all tiles at once: the transfers overlap instead of waiting row by row
    const rows: RawTile[][] = await Promise.all(
      Array.from({ length: sel.r1 - sel.r0 + 1 }, (_, j) =>
        Promise.all(Array.from({ length: sel.c1 - sel.c0 + 1 }, (_, i) => loadRaw(path(sel.c0 + i, sel.r0 + j)))),
      ),
    );
    return mosaicYielding(rows);
  }

  /**
   * Loads what the view needs: the world overview of `overview` (others are released) and, zoomed in, the 0.125° detail
   * of `detail` plus the terrain for the temperature. Resolves true when something changed.
   */
  async setView(b: Bounds | null, detail: ModelVar[], overview: ModelVar[] = detail, overviewOnly = false): Promise<boolean> {
    const changed = await this.update(b, detail, overview, overviewOnly);
    if (changed) this.rev++;
    return changed;
  }

  private async update(b: Bounds | null, detail: ModelVar[], overview: ModelVar[], overviewOnly: boolean): Promise<boolean> {
    const token = ++this.viewToken;
    let changed = false;
    const wantOverview = [...new Set([...overview, ...detail])].filter((v) => v in this.meta.vars);
    const missing = wantOverview.filter((v) => !this.overview.has(v));
    if (missing.length) {
      const loaded = await loadOverviews(this.meta.run, missing);
      if (token !== this.viewToken) return false;
      for (const [v, g] of loaded) this.overview.set(v, g);
      changed = loaded.length > 0;
    }
    for (const v of [...this.overview.keys()]) {
      if (!wantOverview.includes(v)) {
        this.overview.delete(v);
        changed = true;
      }
    }

    if (overviewOnly) return changed; // the detail tiles stay as they are
    const wanted = detail.filter((v) => this.overview.has(v));
    // the more variables are held in detail, the fewer tiles fit into memory
    const sel = b && wanted.length ? tilesFor(b, wanted.length > 2 ? 4 : wanted.length > 1 ? 6 : MAX_DETAIL_TILES) : null;
    const terrain = wanted.some((v) => v === 'temperature_2m' || v === 'dew_point_2m') && 'hsurf' in this.meta.vars;
    const key = sel ? `${sel.c0}_${sel.r0}_${sel.c1}_${sel.r1}_${wanted.join('')}${terrain ? 't' : ''}`.replace(/[^\w-]/g, '') : '';
    if (key === this.detailKey) return changed;
    if (!sel) {
      this.detail.clear();
      this.dem = null;
      this.detailKey = '';
      return true;
    }
    try {
      const run = this.meta.run;
      const grids = new Map<string, WxGrid>();
      await Promise.all(
        [...wanted, ...(terrain ? ['hsurf'] : [])].map(async (v) => {
          grids.set(v, await this.loadMosaic(sel, (c, r) => `${run}/${v}/t${c}_${r}`));
        }),
      );
      // terrain heights are optional: without them the temperature stays uncorrected
      const dem = terrain ? await this.loadMosaic(sel, (c, r) => `${DEM_PATH}/t${c}_${r}`).catch(() => null) : null;
      if (token !== this.viewToken) return changed; // a newer view request took over
      this.detail.clear();
      for (const [v, g] of grids) this.detail.set(v, g);
      this.dem = dem;
      this.detailKey = key;
      return true;
    } catch (e) {
      console.warn('ICON-Detailkacheln nicht verfügbar', e);
      return changed;
    }
  }
}
