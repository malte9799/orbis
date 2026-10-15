import type { ImageSource, Map as MlMap } from 'maplibre-gl';
import { DATA_BASE } from '../api/data';

// Orbis radar composites (scripts/radar-composite.mjs → `radar` branch): one grayscale PNG per
// region and time step holding the rain rate (byte = sqrt(mm/h) * 25). The browser smooths it,
// colours it with a continuous mm/h scale and keeps the values for the click read-out. These
// images are not tiles: MapLibre stretches the same picture over the region at every zoom.

const RADAR_BASE = DATA_BASE.replace(/data\/$/, 'radar/');
/** upscaling of the 1 km grid before colouring – the smooth look comes from this interpolation */
const SCALE = 2;
/** a frame further than this from the requested time is not shown */
const MAX_GAP_MS = 8 * 60000;

interface ManifestFrame {
  time: string;
  lead: number;
  file: string;
}
interface Region {
  id: string;
  name: string;
  attribution: string;
  bounds: [number, number, number, number];
  width: number;
  height: number;
  frames: ManifestFrame[];
}
interface Manifest {
  updated: string;
  regions: Region[];
}

// mm/h → colour. Interpolated on a log scale, so light rain stays readable and heavy rain glows.
const STOPS: [number, [number, number, number, number]][] = [
  [0.05, [150, 205, 255, 0]],
  [0.1, [140, 200, 255, 150]],
  [0.5, [100, 175, 255, 195]],
  [1, [70, 145, 250, 210]],
  [2.5, [60, 110, 235, 225]],
  [5, [95, 80, 220, 235]],
  [10, [150, 60, 210, 240]],
  [20, [210, 50, 190, 245]],
  [40, [255, 60, 130, 250]],
  [80, [255, 200, 80, 255]],
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

interface Shown {
  region: Region;
  frame: ManifestFrame | null;
}

export class HdRadar {
  private manifest: Manifest | null = null;
  private loadedAt = 0;
  private values = new Map<string, Promise<Uint8Array | null>>();
  private shown = new Map<string, Shown>();
  private visible = false;
  private token = 0;
  private urls = new Map<string, string>();

  constructor(private map: MlMap) {}

  /** Load (or refresh) the manifest and make sure every region has its layer. */
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
    for (const r of this.manifest.regions) {
      const id = this.layerId(r);
      if (this.map.getSource(id)) continue;
      const [w, s, e, n] = r.bounds;
      this.map.addSource(id, { type: 'image', url: blank(), coordinates: [[w, n], [e, n], [e, s], [w, s]] });
      this.map.addLayer(
        { id, type: 'raster', source: id, layout: { visibility: 'none' }, paint: { 'raster-opacity': 0.9, 'raster-fade-duration': 0, 'raster-resampling': 'linear' } },
        before && this.map.getLayer(before) ? before : undefined,
      );
    }
    return this.manifest.regions.length > 0;
  }

  private layerId = (r: Region) => `hdradar-${r.id}`;

  /** The region whose footprint contains the point, if its data are loaded. */
  private regionAt(lng: number, lat: number): Region | undefined {
    return this.manifest?.regions.find((r) => lng >= r.bounds[0] && lng <= r.bounds[2] && lat >= r.bounds[1] && lat <= r.bounds[3]);
  }

  /** True if the point lies in a region this module draws – the caller can hide a coarser layer there. */
  covers(lng: number, lat: number): boolean {
    if (!this.visible) return false;
    const r = this.regionAt(lng, lat);
    return !!r && !!this.shown.get(r.id)?.frame;
  }

  setVisible(on: boolean) {
    this.visible = on;
    for (const r of this.manifest?.regions ?? []) {
      const id = this.layerId(r);
      if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    }
  }

  /** Time axis (ms) of all frames – the player uses it to show the picture closest to the slider. */
  async show(timeMs: number) {
    if (!this.manifest) return;
    const token = ++this.token;
    this.visible = true;
    for (const r of this.manifest.regions) {
      let best: ManifestFrame | null = null;
      let gap = Infinity;
      for (const f of r.frames) {
        const d = Math.abs(Date.parse(f.time) - timeMs);
        if (d < gap) {
          gap = d;
          best = f;
        }
      }
      const frame = best && gap <= MAX_GAP_MS ? best : null;
      const id = this.layerId(r);
      if (!this.map.getLayer(id)) continue;
      if (this.shown.get(r.id)?.frame?.file === frame?.file) {
        this.map.setLayoutProperty(id, 'visibility', frame ? 'visible' : 'none');
        continue;
      }
      if (!frame) {
        this.shown.set(r.id, { region: r, frame: null });
        this.map.setLayoutProperty(id, 'visibility', 'none');
        continue;
      }
      const url = await this.colorize(r, frame);
      if (token !== this.token || !url) continue;
      (this.map.getSource(id) as ImageSource | undefined)?.updateImage({ url });
      const old = this.urls.get(r.id);
      if (old) setTimeout(() => URL.revokeObjectURL(old), 3000);
      this.urls.set(r.id, url);
      this.shown.set(r.id, { region: r, frame });
      this.map.setLayoutProperty(id, 'visibility', 'visible');
    }
  }

  /** Rain rate [mm/h] at a point of the currently shown frame, or null outside the data. */
  sample(lng: number, lat: number): number | null {
    const r = this.regionAt(lng, lat);
    const shown = r && this.shown.get(r.id);
    if (!r || !shown?.frame) return null;
    const vals = this.cached(r, shown.frame);
    if (!vals) return null;
    const [w, s, e, n] = r.bounds;
    const my = (la: number) => Math.log(Math.tan(Math.PI / 4 + (la * Math.PI) / 360));
    const x = Math.floor(((lng - w) / (e - w)) * r.width);
    const y = Math.floor(((my(n) - my(lat)) / (my(n) - my(s))) * r.height);
    if (x < 0 || y < 0 || x >= r.width || y >= r.height) return null;
    return rainRate(vals[y * r.width + x]);
  }

  private resolved = new Map<string, Uint8Array>();
  private cached(r: Region, f: ManifestFrame) {
    return this.resolved.get(`${r.id}/${f.file}`) ?? null;
  }

  private values$(r: Region, f: ManifestFrame): Promise<Uint8Array | null> {
    const key = `${r.id}/${f.file}`;
    let p = this.values.get(key);
    if (!p) {
      p = (async () => {
        const res = await fetch(`${RADAR_BASE}${key}`);
        if (!res.ok) return null;
        const bmp = await createImageBitmap(await res.blob());
        const c = document.createElement('canvas');
        c.width = bmp.width;
        c.height = bmp.height;
        const ctx = c.getContext('2d', { willReadFrequently: true })!;
        ctx.drawImage(bmp, 0, 0);
        const px = ctx.getImageData(0, 0, c.width, c.height).data;
        const out = new Uint8Array(c.width * c.height);
        for (let i = 0; i < out.length; i++) out[i] = px[i * 4];
        this.resolved.set(key, out);
        // keep memory bounded: the animation needs ~50 frames per region
        if (this.resolved.size > 60) this.resolved.delete(this.resolved.keys().next().value!);
        return out;
      })().catch(() => null);
      this.values.set(key, p);
      if (this.values.size > 60) this.values.delete(this.values.keys().next().value!);
    }
    return p;
  }

  private async colorize(r: Region, f: ManifestFrame): Promise<string | null> {
    const vals = await this.values$(r, f);
    if (!vals) return null;
    const { width: w, height: h } = r;
    const small = document.createElement('canvas');
    small.width = w;
    small.height = h;
    const sctx = small.getContext('2d')!;
    const img = sctx.createImageData(w, h);
    for (let i = 0; i < vals.length; i++) {
      const v = vals[i];
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v;
      img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    sctx.putImageData(img, 0, 0);
    const big = document.createElement('canvas');
    big.width = w * SCALE;
    big.height = h * SCALE;
    const bctx = big.getContext('2d', { willReadFrequently: true })!;
    bctx.imageSmoothingEnabled = true;
    bctx.imageSmoothingQuality = 'high';
    bctx.drawImage(small, 0, 0, big.width, big.height);
    const out = bctx.getImageData(0, 0, big.width, big.height);
    const d = out.data;
    for (let i = 0; i < d.length; i += 4) {
      const o = d[i] * 4;
      d[i] = LUT[o];
      d[i + 1] = LUT[o + 1];
      d[i + 2] = LUT[o + 2];
      d[i + 3] = LUT[o + 3];
    }
    bctx.putImageData(out, 0, 0);
    return new Promise((resolve) => big.toBlob((b) => resolve(b ? URL.createObjectURL(b) : null), 'image/png'));
  }

  attributions(): string[] {
    return this.manifest?.regions.map((r) => r.attribution) ?? [];
  }
}

/** 1×1 transparent PNG, placeholder until the first frame is coloured. */
function blank(): string {
  return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
}

export type { Shown };
