import { addProtocol, type Map as MlMap } from 'maplibre-gl';
import { DATA_BASE } from '../api/data';

// Orbis radar composites (scripts/radar-composite.mjs → `radar` branch): a z/x/y tile pyramid per
// region and time step (zoom 2–7, 512 px). The tiles hold the rain rate (byte = sqrt(mm/h) * 25),
// not colours: the `hdradar://` protocol below turns them into a continuous mm/h colour scale in
// the browser and keeps the values for the click read-out. Zoom 7 is the native 1 km resolution of
// the sources; beyond that MapLibre stretches the tiles.

const RADAR_BASE = DATA_BASE.replace(/data\/$/, 'radar/');
/** a frame further than this from the requested time is not shown */
const MAX_GAP_MS = 8 * 60000;
const OPACITY = 0.9;
/** frames this close to the shown time are kept loaded for smooth stepping */
const PRELOAD_MS = 25 * 60000;

interface ManifestFrame {
  time: string;
  lead: number;
  id: string;
}
interface Region {
  id: string;
  name: string;
  attribution: string;
  bounds: [number, number, number, number];
  minzoom: number;
  maxzoom: number;
  frames: ManifestFrame[];
}
interface Manifest {
  updated: string;
  regions: Region[];
}

/** first byte value that means "no measurement" (the composites write 255) */
const NODATA_MIN = 250;

// mm/h → colour. Interpolated on a log scale, so light rain stays readable and heavy rain glows.
const STOPS: [number, [number, number, number, number]][] = [
  [0.002, [150, 205, 255, 0]],
  [0.01, [150, 205, 255, 175]], // even 0.01 mm/h is a clearly blue veil, bright enough over dark imagery
  [0.05, [140, 198, 255, 195]],
  [0.2, [120, 180, 252, 210]],
  [0.6, [100, 158, 246, 222]],
  [1.5, [85, 120, 238, 230]], // Zoom Earth's legend: blue → violet → magenta → salmon → yellow
  [3, [125, 90, 225, 236]],
  [6, [190, 75, 180, 242]],
  [10, [228, 85, 135, 246]],
  [20, [244, 130, 100, 249]],
  [40, [250, 190, 85, 252]],
  [80, [255, 240, 95, 255]],
];

const LUT = (() => {
  const lut = new Uint8ClampedArray(256 * 4);
  // 0 = measured, no rain; 255 = no measurement (outside every radar's range): both transparent.
  // Some browsers shift gray values by one while decoding (255 → 254), so everything from
  // NODATA_MIN up counts as "no measurement"; real rain stops at 249 (≈ 99 mm/h).
  for (let v = 1; v < NODATA_MIN; v++) {
    const mmh = (v / 25) ** 2;
    let k = 0;
    while (k < STOPS.length - 2 && mmh > STOPS[k + 1][0]) k++;
    const [m0, c0] = STOPS[k];
    const [m1, c1] = STOPS[k + 1];
    const t = Math.max(0, Math.min(1, Math.log(mmh / m0) / Math.log(m1 / m0)));
    for (let c = 0; c < 4; c++) lut[v * 4 + c] = c0[c] + (c1[c] - c0[c]) * t;
  }
  return lut;
})();

export const rainRate = (byte: number) => (byte / 25) ** 2;

export function rainLabel(mmh: number): string {
  if (mmh < 0.5) return 'Sehr leichter Regen';
  if (mmh < 2.5) return 'Leichter Regen';
  if (mmh < 10) return 'Mäßiger Regen';
  if (mmh < 50) return 'Starker Regen';
  return 'Sehr starker Regen';
}

// ---- tile values ---------------------------------------------------------------------------
interface TileValues {
  v: Uint8Array;
  size: number;
}
const values = new Map<string, Promise<TileValues | null>>();

function tileValues(path: string): Promise<TileValues | null> {
  let p = values.get(path);
  if (!p) {
    p = (async () => {
      const res = await fetch(`${RADAR_BASE}${path}.png`);
      if (!res.ok) return null;
      const bmp = await createImageBitmap(await res.blob());
      const canvas = new OffscreenCanvas(bmp.width, bmp.height);
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(bmp, 0, 0);
      const px = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
      const v = new Uint8Array(bmp.width * bmp.height);
      for (let i = 0; i < v.length; i++) v[i] = px[i * 4];
      return { v, size: bmp.width };
    })().catch(() => null);
    values.set(path, p);
    // the animation needs ~50 tiles per frame set; keep memory bounded
    if (values.size > 400) values.delete(values.keys().next().value!);
  }
  return p;
}

/** Rain rate [mm/h] → byte of the shared value encoding. */
const rateByte = (mmh: number) => (mmh < 0.002 ? 0 : Math.min(NODATA_MIN - 1, Math.round(Math.sqrt(mmh) * 25)));

/** value bytes (size × size) → coloured, smoothly interpolated image */
async function paintValues(v: Uint8Array, size: number, upscale: number): Promise<ImageBitmap> {
  const small = new OffscreenCanvas(size, size);
  const sctx = small.getContext('2d')!;
  const gray = sctx.createImageData(size, size);
  for (let i = 0; i < v.length; i++) {
    gray.data[i * 4] = v[i];
    gray.data[i * 4 + 1] = v[i];
    gray.data[i * 4 + 2] = v[i];
    gray.data[i * 4 + 3] = 255;
  }
  sctx.putImageData(gray, 0, 0);
  const n = size * upscale;
  const canvas = new OffscreenCanvas(n, n);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(small, 0, 0, n, n); // interpolates the values, the colours come afterwards
  const img = ctx.getImageData(0, 0, n, n);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const o = d[i] * 4;
    d[i] = LUT[o];
    d[i + 1] = LUT[o + 1];
    d[i + 2] = LUT[o + 2];
    d[i + 3] = LUT[o + 3];
  }
  ctx.putImageData(img, 0, 0);
  return createImageBitmap(canvas);
}

// ---- RainViewer tiles, re-coloured with the Orbis scale -------------------------------------
// RainViewer's tiles come in a fixed colour ramp: weak echoes are tan with growing alpha, then
// light → dark blue, then yellow → red → pink. The ramp is read back into a rain rate (rough dBZ
// anchors, Marshall-Palmer) so the same scale and smoothing apply to every source.
/** weakest RainViewer haze that is still drawn (see rainviewerRate) */
const TAN_MIN_ALPHA = 100;

const WARM: [number, number, number, number][] = [
  [255, 238, 0, 36],
  [255, 170, 0, 42],
  [255, 68, 0, 48],
  [193, 0, 0, 55],
  [255, 170, 255, 62],
];

function rainviewerRate(r: number, g: number, b: number, a: number): number {
  if (a === 0) return 0;
  let dbz: number;
  if (a < 255 && b <= g) {
    // tan = RainViewer's faintest haze (alpha 20 … 190). Compared tile by tile, Zoom Earth shows
    // none of the alpha < ~100 part (e.g. Bavaria 17:40 UTC: Zoom Earth and DWD empty, RainViewer
    // 15–24 % haze), so it is dropped here.
    if (a < TAN_MIN_ALPHA) return 0;
    dbz = 2 + ((a - 20) / 170) * 13; // tan: 2 … 15 dBZ
  } else if (r > 150 && !(b > r && g < 200)) {
    let best = WARM[0];
    let bd = Infinity;
    for (const w of WARM) {
      const d = (w[0] - r) ** 2 + (w[1] - g) ** 2 + (w[2] - b) ** 2;
      if (d < bd) {
        bd = d;
        best = w;
      }
    }
    dbz = best[3];
  } else {
    // blues: R falls 136 → 0, then G falls 163 → 85
    const p = r > 0 ? ((136 - r) / 136) * 0.25 : 0.25 + ((163 - g) / (163 - 85)) * 0.75;
    dbz = 15 + Math.max(0, Math.min(1, p)) * 20;
  }
  return (10 ** (dbz / 10) / 200) ** 0.625;
}

/** Tile URL template for a RainViewer frame, to be used as a raster source `tiles` entry. */
export function rainviewerTiles(host: string, path: string): string {
  registerProtocol();
  return `rvradar://${encodeURIComponent(host)}${path}/{z}/{x}/{y}`;
}

let protocolRegistered = false;
function registerProtocol() {
  if (protocolRegistered) return;
  protocolRegistered = true;
  const blank = () => createImageBitmap(new OffscreenCanvas(1, 1));
  // URL format: hdradar://<region>/<frame>/<z>/<x>/<y>
  addProtocol('hdradar', async (params) => {
    const path = params.url.replace(/^hdradar:\/\//, '');
    const tile = await tileValues(path);
    return { data: tile ? await paintValues(tile.v, tile.size, 1) : await blank() };
  });
  // URL format: rvradar://<encoded host><path>/<z>/<x>/<y>
  addProtocol('rvradar', async (params, abort) => {
    const m = /^rvradar:\/\/([^/]+)(.*)\/(\d+)\/(\d+)\/(\d+)$/.exec(params.url);
    if (!m) return { data: await blank() };
    const url = `${decodeURIComponent(m[1])}${m[2]}/256/${m[3]}/${m[4]}/${m[5]}/2/1_0.png`;
    try {
      const res = await fetch(url, { signal: abort.signal });
      if (!res.ok) return { data: await blank() };
      const bmp = await createImageBitmap(await res.blob());
      const c = new OffscreenCanvas(bmp.width, bmp.height);
      const cx = c.getContext('2d', { willReadFrequently: true })!;
      cx.drawImage(bmp, 0, 0);
      const px = cx.getImageData(0, 0, bmp.width, bmp.height).data;
      const v = new Uint8Array(bmp.width * bmp.height);
      for (let i = 0; i < v.length; i++) v[i] = rateByte(rainviewerRate(px[i * 4], px[i * 4 + 1], px[i * 4 + 2], px[i * 4 + 3]));
      return { data: await paintValues(v, bmp.width, 2) };
    } catch {
      return { data: await blank() };
    }
  });
}

// ---- layer ---------------------------------------------------------------------------------
export class HdRadar {
  private manifest: Manifest | null = null;
  private loadedAt = 0;
  private visible = false;
  /** frame id currently shown per region (null = no frame close enough to the requested time) */
  private current = new Map<string, string | null>();
  private lastTime = 0;

  constructor(private map: MlMap) {
    registerProtocol();
  }

  private layerId = (r: Region, f: ManifestFrame) => `hdradar-${r.id}-${f.id}`;

  /** Load (or refresh) the manifest and make sure every frame has its layer. */
  async ensure(before?: string): Promise<boolean> {
    if (!this.manifest || Date.now() - this.loadedAt > 4 * 60000) {
      try {
        const res = await fetch(`${RADAR_BASE}manifest.json?t=${Math.floor(Date.now() / 60000)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        this.manifest = (await res.json()) as Manifest;
        this.loadedAt = Date.now();
      } catch (e) {
        console.warn('hdradar', e);
        return !!this.manifest;
      }
    }
    const wanted = new Set<string>();
    for (const r of this.manifest.regions) {
      for (const f of r.frames) {
        if (!f.id) continue; // manifest of the previous (single image) format
        const id = this.layerId(r, f);
        wanted.add(id);
        if (this.map.getSource(id)) continue;
        this.map.addSource(id, {
          type: 'raster',
          tiles: [`hdradar://${r.id}/${f.id}/{z}/{x}/{y}`],
          tileSize: 256,
          minzoom: r.minzoom,
          maxzoom: r.maxzoom,
          bounds: r.bounds,
          attribution: r.attribution,
        });
        this.map.addLayer(
          {
            id,
            type: 'raster',
            source: id,
            layout: { visibility: 'none' }, // show() makes the frames around the shown time visible
            paint: { 'raster-opacity': 0, 'raster-fade-duration': 0, 'raster-resampling': 'linear' },
          },
          before && this.map.getLayer(before) ? before : undefined,
        );
      }
    }
    // drop frames that left the two-hour window
    for (const l of this.map.getStyle().layers ?? []) {
      if (l.id.startsWith('hdradar-') && !wanted.has(l.id)) {
        this.map.removeLayer(l.id);
        this.map.removeSource(l.id);
      }
    }
    return wanted.size > 0;
  }

  isVisible = () => this.visible;

  /** Valid times (ms) of forecast steps later than `afterMs`, for the shared timeline. */
  futureTimes(afterMs: number): number[] {
    const t = new Set<number>();
    for (const r of this.manifest?.regions ?? []) {
      for (const f of r.frames) {
        const ms = Date.parse(f.time);
        if (f.id && ms > afterMs) t.add(ms);
      }
    }
    return [...t].sort((x, y) => x - y);
  }

  /** The region whose footprint contains the point. */
  private regionAt(lng: number, lat: number): Region | undefined {
    return this.manifest?.regions.find((r) => lng >= r.bounds[0] && lng <= r.bounds[2] && lat >= r.bounds[1] && lat <= r.bounds[3]);
  }

  setVisible(on: boolean) {
    this.visible = on;
    for (const l of this.map.getStyle().layers ?? []) {
      if (l.id.startsWith('hdradar-')) this.map.setLayoutProperty(l.id, 'visibility', on ? 'visible' : 'none');
    }
    if (on && this.lastTime) this.show(this.lastTime);
  }

  /** Show, per region, the frame closest to the requested time. */
  show(timeMs: number) {
    if (!this.manifest) return;
    this.visible = true;
    this.lastTime = timeMs;
    for (const r of this.manifest.regions) {
      let best: ManifestFrame | null = null;
      let gap = Infinity;
      for (const f of r.frames) {
        if (!f.id) continue;
        const d = Math.abs(Date.parse(f.time) - timeMs);
        if (d < gap) {
          gap = d;
          best = f;
        }
      }
      const pick = best && gap <= MAX_GAP_MS ? best : null;
      this.current.set(r.id, pick?.id ?? null);
      for (const f of r.frames) {
        const id = this.layerId(r, f);
        if (!this.map.getLayer(id)) continue;
        // only frames around the shown time are loaded (hidden layers request no tiles),
        // far ones follow when the slider gets there
        const near = Math.abs(Date.parse(f.time) - timeMs) <= PRELOAD_MS;
        this.map.setLayoutProperty(id, 'visibility', near ? 'visible' : 'none');
        this.map.setPaintProperty(id, 'raster-opacity', f === pick ? OPACITY : 0);
      }
    }
  }

  /** Rain rate [mm/h] at a point of the currently shown frame, or null outside the data. */
  async sample(lng: number, lat: number): Promise<number | null> {
    const r = this.regionAt(lng, lat);
    const frame = r && this.current.get(r.id);
    if (!r || !frame) return null;
    const z = r.maxzoom;
    const n = 2 ** z;
    const fx = ((lng + 180) / 360) * n;
    const rl = (lat * Math.PI) / 180;
    const fy = ((1 - Math.log(Math.tan(rl) + 1 / Math.cos(rl)) / Math.PI) / 2) * n;
    const x = Math.floor(fx);
    const y = Math.floor(fy);
    const tile = await tileValues(`${r.id}/${frame}/${z}/${x}/${y}`);
    if (!tile) return null;
    const px = Math.min(tile.size - 1, Math.floor((fx - x) * tile.size));
    const py = Math.min(tile.size - 1, Math.floor((fy - y) * tile.size));
    const byte = tile.v[py * tile.size + px];
    return byte >= NODATA_MIN ? null : rainRate(byte);
  }
}
