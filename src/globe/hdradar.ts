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

// mm/h → colour. Interpolated on a log scale, so light rain stays readable and heavy rain glows.
const STOPS: [number, [number, number, number, number]][] = [
  [0.002, [110, 170, 255, 0]],
  [0.01, [115, 175, 255, 140]], // even 0.01 mm/h (the sources' smallest step) is a clearly blue veil
  [0.05, [105, 165, 255, 170]],
  [0.2, [90, 150, 250, 195]],
  [0.6, [85, 135, 245, 210]],
  [1.5, [80, 110, 235, 222]], // Zoom Earth's legend: blue → violet → magenta → salmon → yellow
  [3, [120, 85, 220, 232]],
  [6, [190, 75, 180, 240]],
  [10, [228, 85, 135, 245]],
  [20, [244, 130, 100, 248]],
  [40, [250, 190, 85, 252]],
  [80, [255, 240, 95, 255]],
];

const LUT = (() => {
  const lut = new Uint8ClampedArray(256 * 4);
  for (let v = 1; v < 256; v++) {
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

let protocolRegistered = false;
function registerProtocol() {
  if (protocolRegistered) return;
  protocolRegistered = true;
  // URL format: hdradar://<region>/<frame>/<z>/<x>/<y>
  addProtocol('hdradar', async (params) => {
    const path = params.url.replace(/^hdradar:\/\//, '');
    const tile = await tileValues(path);
    if (!tile) return { data: await createImageBitmap(new OffscreenCanvas(1, 1)) };
    const canvas = new OffscreenCanvas(tile.size, tile.size);
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(tile.size, tile.size);
    const d = img.data;
    for (let i = 0; i < tile.v.length; i++) {
      const o = tile.v[i] * 4;
      d[i * 4] = LUT[o];
      d[i * 4 + 1] = LUT[o + 1];
      d[i * 4 + 2] = LUT[o + 2];
      d[i * 4 + 3] = LUT[o + 3];
    }
    ctx.putImageData(img, 0, 0);
    return { data: await createImageBitmap(canvas) };
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

  /** The region whose footprint contains the point. */
  private regionAt(lng: number, lat: number): Region | undefined {
    return this.manifest?.regions.find((r) => lng >= r.bounds[0] && lng <= r.bounds[2] && lat >= r.bounds[1] && lat <= r.bounds[3]);
  }

  /** True if the point lies in a region with a frame for the shown time – coarser layers can hide there. */
  covers(lng: number, lat: number): boolean {
    if (!this.visible) return false;
    const r = this.regionAt(lng, lat);
    return !!r && !!this.current.get(r.id);
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
    return rainRate(tile.v[py * tile.size + px]);
  }
}
