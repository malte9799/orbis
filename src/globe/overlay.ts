import { addProtocol, LngLat, type Map as MlMap } from 'maplibre-gl';
import type { Feature, FeatureCollection, LineString, Point, Polygon } from 'geojson';
import type { ModelSampler, ModelVar } from '../api/model';
import { fmt, rampColor, TEMP_STOPS } from '../util';

// ---------------------------------------------------------------------------
// Forecast fields rendered as raster tiles through a custom protocol: the grid is
// bilinearly interpolated per pixel at every zoom, MapLibre handles 2D/3D projection.

export type FieldId =
  | 'wind'
  | 'gusts'
  | 'temp'
  | 'feels'
  | 'humidity'
  | 'dewpoint'
  | 'precip'
  | 'cloud'
  | 'pressure'
  | 'snow'
  | 'cape';

type Rgba = [number, number, number, number];

export interface FieldDef {
  label: string;
  unit: string;
  variable: ModelVar;
  color(v: number): Rgba;
  legend: { stops: [number, string][]; ticks: number[]; gradient?: string };
  format(v: number): string;
  /** show wind particles automatically */
  particles?: boolean;
}

const WIND_STOPS: [number, string][] = [
  [0, '#3d2e8c'],
  [8, '#3462c9'],
  [18, '#2a9fc4'],
  [30, '#35b984'],
  [45, '#a9d34a'],
  [60, '#f2c23d'],
  [80, '#ec7a32'],
  [100, '#d83b3b'],
  [130, '#a3225c'],
  [170, '#e7b8e8'],
];
const HUMIDITY_STOPS: [number, string][] = [
  [0, '#8c4a1c'],
  [25, '#c98a3d'],
  [45, '#e8d6a0'],
  [65, '#8fd0c6'],
  [80, '#3d9ad1'],
  [100, '#1d4fa6'],
];
const PRECIP_STOPS: [number, string][] = [
  [0.1, '#9fd8ff'],
  [0.5, '#4fb0ff'],
  [1.5, '#2f6fe0'],
  [3, '#2bd46f'],
  [6, '#ffe14d'],
  [10, '#ff8c1a'],
  [20, '#e8384f'],
  [40, '#b03ad6'],
];
const PRESSURE_STOPS: [number, string][] = [
  [960, '#5b2bd6'],
  [985, '#2f7fd8'],
  [1000, '#4fc3e8'],
  [1013, '#e6ebf2'],
  [1022, '#f6c945'],
  [1035, '#e0462f'],
  [1050, '#9e1a3a'],
];
const SNOW_STOPS: [number, string][] = [
  [0.01, '#d7ecff'],
  [0.1, '#9ccbff'],
  [0.3, '#5f8dff'],
  [0.7, '#7c5cff'],
  [1.5, '#c45cff'],
  [3, '#ffd1ff'],
];
const CAPE_STOPS: [number, string][] = [
  [100, '#4a6d8c'],
  [300, '#59c48a'],
  [700, '#e3e05a'],
  [1200, '#f2a23c'],
  [2000, '#e8573a'],
  [3000, '#b8264f'],
  [4500, '#e7b8e8'],
];

/**
 * Colour ramp. Below `min` the colour fades out smoothly (over min…3·min) and transparent
 * pixels keep the first stop's RGB, so GPU interpolation produces no dark fringes.
 */
const ramp = (stops: [number, string][], alpha = 190, min = -Infinity) => {
  const first = rampColor(stops, stops[0][0]);
  return (v: number): Rgba => {
    if (Number.isNaN(v)) return [first[0], first[1], first[2], 0];
    const [r, g, b] = rampColor(stops, v);
    if (!Number.isFinite(min)) return [r, g, b, alpha];
    const f = Math.max(0, Math.min(1, (v - min) / (2 * min)));
    return [r, g, b, alpha * f * f * (3 - 2 * f)];
  };
};
const num = (d = 0) => (v: number) => fmt.num(v, d);

export const FIELDS: Record<FieldId, FieldDef> = {
  wind: {
    label: 'Wind',
    unit: 'km/h',
    variable: 'wind_speed_10m',
    color: ramp(WIND_STOPS),
    legend: { stops: WIND_STOPS, ticks: [0, 30, 60, 100, 130] },
    format: num(),
    particles: true,
  },
  gusts: {
    label: 'Windböen',
    unit: 'km/h',
    variable: 'wind_gusts_10m',
    color: ramp(WIND_STOPS),
    legend: { stops: WIND_STOPS, ticks: [0, 30, 60, 100, 130] },
    format: num(),
    particles: true,
  },
  temp: {
    label: 'Temperatur',
    unit: '°C',
    variable: 'temperature_2m',
    color: ramp(TEMP_STOPS, 185),
    legend: { stops: TEMP_STOPS, ticks: [-30, -15, 0, 15, 30, 40] },
    format: num(),
  },
  feels: {
    label: 'Gefühlte Temperatur',
    unit: '°C',
    variable: 'apparent_temperature',
    color: ramp(TEMP_STOPS, 185),
    legend: { stops: TEMP_STOPS, ticks: [-30, -15, 0, 15, 30, 40] },
    format: num(),
  },
  humidity: {
    label: 'Luftfeuchtigkeit',
    unit: '%',
    variable: 'relative_humidity_2m',
    color: ramp(HUMIDITY_STOPS, 175),
    legend: { stops: HUMIDITY_STOPS, ticks: [0, 25, 50, 75, 100] },
    format: num(),
  },
  dewpoint: {
    label: 'Taupunkt',
    unit: '°C',
    variable: 'dew_point_2m',
    color: ramp(TEMP_STOPS, 185),
    legend: { stops: TEMP_STOPS, ticks: [-30, -15, 0, 15, 30, 40] },
    format: num(),
  },
  precip: {
    label: 'Niederschlag',
    unit: 'mm/h',
    variable: 'precipitation',
    color: ramp(PRECIP_STOPS, 210, 0.08),
    legend: { stops: PRECIP_STOPS, ticks: [0.1, 3, 10, 20, 40] },
    format: num(1),
  },
  cloud: {
    label: 'Bewölkung',
    unit: '%',
    variable: 'cloud_cover',
    color: (v) => [255, 255, 255, Number.isNaN(v) ? 0 : Math.max(0, Math.min(1, (v - 8) / 92)) ** 1.25 * 225],
    legend: { stops: [[0, '#000'], [100, '#fff']], ticks: [0, 25, 50, 75, 100], gradient: 'linear-gradient(90deg, rgba(255,255,255,0), #fff)' },
    format: num(),
  },
  pressure: {
    label: 'Luftdruck',
    unit: 'hPa',
    variable: 'pressure_msl',
    color: ramp(PRESSURE_STOPS, 150),
    legend: { stops: PRESSURE_STOPS, ticks: [970, 990, 1013, 1030, 1045] },
    format: num(),
  },
  snow: {
    label: 'Schneehöhe',
    unit: 'cm',
    variable: 'snow_depth',
    color: ramp(SNOW_STOPS, 210, 0.01),
    legend: { stops: SNOW_STOPS, ticks: [0.01, 0.5, 1, 2, 3] },
    format: (v) => fmt.num(v * 100, 0),
  },
  cape: {
    label: 'Gewitterenergie (CAPE)',
    unit: 'J/kg',
    variable: 'cape',
    color: ramp(CAPE_STOPS, 190, 100),
    legend: { stops: CAPE_STOPS, ticks: [100, 1000, 2000, 3000, 4500] },
    format: num(),
  },
};

// The protocol reads the active sampler; the tile URL carries a version so MapLibre
// re-requests tiles whenever field, time step or detail grid change.
let activeSampler: ModelSampler | null = null;
let protocolRegistered = false;

export function setActiveSampler(s: ModelSampler | null) {
  activeSampler = s;
}

function tile2lon(x: number, z: number) {
  return (x / 2 ** z) * 360 - 180;
}
function tile2lat(y: number, z: number) {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
}

export function registerFieldProtocol() {
  if (protocolRegistered) return;
  protocolRegistered = true;
  // URL format: wxfield://<field>/<version>/<z>/<x>/<y>
  addProtocol('wxfield', async (params) => {
    const m = /^wxfield:\/\/(\w+)\/[\w-]+\/(\d+)\/(\d+)\/(\d+)/.exec(params.url);
    const def = m ? FIELDS[m[1] as FieldId] : undefined;
    const sampler = activeSampler;
    if (!m || !def || !sampler) throw new Error('field not ready');
    const z = +m[2];
    const x = +m[3];
    const y = +m[4];
    // The fields are smooth, so render a small image and let the GPU interpolate it up
    // ('raster-resampling: linear'): 64 px per tile when zoomed out, 128 px when zoomed in.
    const N = z <= 4 ? 64 : 128;
    const canvas = new OffscreenCanvas(N, N);
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(N, N);
    for (let py = 0; py < N; py++) {
      const lat = tile2lat(y + (py + 0.5) / N, z);
      for (let px = 0; px < N; px++) {
        const lon = tile2lon(x + (px + 0.5) / N, z);
        const [r, g, b, a] = def.color(sampler.sample(def.variable, lat, lon));
        const o = (py * N + px) * 4;
        img.data[o] = r;
        img.data[o + 1] = g;
        img.data[o + 2] = b;
        img.data[o + 3] = a;
      }
    }
    ctx.putImageData(img, 0, 0);
    return { data: await createImageBitmap(canvas) };
  });
}

// ---------------------------------------------------------------------------
// Isobars (marching squares on a 2° lattice) plus H/T markers for highs and lows.

export function isobars(s: ModelSampler, interval = 4): FeatureCollection<LineString | Point> {
  const STEP = 2;
  const lats: number[] = [];
  const lons: number[] = [];
  for (let lat = 80; lat >= -80; lat -= STEP) lats.push(lat);
  for (let lon = -180; lon <= 180; lon += STEP) lons.push(lon);
  const ny = lats.length;
  const nx = lons.length;
  const P = new Float32Array(nx * ny);
  let min = Infinity;
  let max = -Infinity;
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const v = s.sample('pressure_msl', lats[j], lons[i]);
      P[j * nx + i] = v;
      if (v < min) min = v;
      if (v > max) max = v;
    }

  const features: Feature<LineString | Point>[] = [];
  // Edge ids: horizontal edge h(j,i) between (j,i)-(j,i+1), vertical v(j,i) between (j,i)-(j+1,i)
  const edgePoint = (id: number, L: number): [number, number] => {
    const horizontal = id % 2 === 0;
    const k = id >> 1;
    const j = Math.floor(k / nx);
    const i = k % nx;
    const a = P[j * nx + i];
    const b = horizontal ? P[j * nx + i + 1] : P[(j + 1) * nx + i];
    const f = (L - a) / (b - a || 1e-6);
    return horizontal ? [lons[i] + f * STEP, lats[j]] : [lons[i], lats[j] - f * STEP];
  };
  const H = (j: number, i: number) => ((j * nx + i) << 1) | 0;
  const V = (j: number, i: number) => ((j * nx + i) << 1) | 1;

  for (let L = Math.ceil(min / interval) * interval; L <= max; L += interval) {
    const segs: [number, number][] = [];
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const a = P[j * nx + i];
        const b = P[j * nx + i + 1];
        const c = P[(j + 1) * nx + i + 1];
        const d = P[(j + 1) * nx + i];
        const idx = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (d > L ? 1 : 0);
        if (idx === 0 || idx === 15) continue;
        const top = H(j, i);
        const bottom = H(j + 1, i);
        const left = V(j, i);
        const right = V(j, i + 1);
        switch (idx) {
          case 1: case 14: segs.push([left, bottom]); break;
          case 2: case 13: segs.push([bottom, right]); break;
          case 3: case 12: segs.push([left, right]); break;
          case 4: case 11: segs.push([top, right]); break;
          case 6: case 9: segs.push([top, bottom]); break;
          case 7: case 8: segs.push([left, top]); break;
          case 5: segs.push([left, top], [bottom, right]); break;
          case 10: segs.push([top, right], [left, bottom]); break;
        }
      }
    }
    // Join segments into polylines via shared edge ids
    const byEdge = new Map<number, number[]>();
    segs.forEach(([e1, e2], k) => {
      for (const e of [e1, e2]) {
        const list = byEdge.get(e);
        if (list) list.push(k);
        else byEdge.set(e, [k]);
      }
    });
    const used = new Uint8Array(segs.length);
    for (let k = 0; k < segs.length; k++) {
      if (used[k]) continue;
      used[k] = 1;
      const chain = [segs[k][0], segs[k][1]];
      for (const forward of [true, false]) {
        for (;;) {
          const end = forward ? chain[chain.length - 1] : chain[0];
          const nextSeg = (byEdge.get(end) ?? []).find((n) => !used[n]);
          if (nextSeg === undefined) break;
          used[nextSeg] = 1;
          const [e1, e2] = segs[nextSeg];
          const other = e1 === end ? e2 : e1;
          if (forward) chain.push(other);
          else chain.unshift(other);
        }
      }
      if (chain.length < 4) continue;
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: chain.map((e) => edgePoint(e, L)) },
        properties: { p: L, major: L % 20 === 0 },
      });
    }
  }

  // Highs and lows on a coarser 6° lattice
  const C = 3;
  for (let j = C; j < ny - C; j += 1) {
    for (let i = 0; i < nx - 1; i += 1) {
      const v = P[j * nx + i];
      if (Number.isNaN(v)) continue;
      let isMax = v > 1012;
      let isMin = v < 1008;
      for (let dj = -C; dj <= C && (isMax || isMin); dj++)
        for (let di = -C; di <= C; di++) {
          if (!dj && !di) continue;
          const ii = (i + di + (nx - 1)) % (nx - 1);
          const w = P[(j + dj) * nx + ii];
          if (w >= v) isMax = false;
          if (w <= v) isMin = false;
        }
      if (isMax || isMin) {
        features.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lons[i], lats[j]] },
          properties: { label: isMax ? 'H' : 'T', p: Math.round(v), kind: isMax ? 'high' : 'low' },
        });
      }
    }
  }
  return { type: 'FeatureCollection', features };
}

// ---------------------------------------------------------------------------
// Animated wind particles drawn on a 2D canvas above the map (screen space, so trails
// stay crisp at any zoom). Occluded particles on the far side of the globe are skipped.

interface Particle {
  lon: number;
  lat: number;
  age: number;
  x: number;
  y: number;
  visible: boolean;
}

export class WindParticles {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private raf = 0;
  private running = false;
  private moving = false;
  private lastFrame = 0;
  private readonly onMoveStart = () => {
    this.moving = true;
    this.clear();
  };
  private readonly onMoveEnd = () => {
    this.moving = false;
    this.reseedAll();
  };
  private readonly onResize = () => this.resize();

  constructor(
    private map: MlMap,
    private getSampler: () => ModelSampler | null,
  ) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'wind-canvas';
    map.getContainer().appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.canvas.hidden = false;
    this.resize();
    this.map.on('movestart', this.onMoveStart);
    this.map.on('moveend', this.onMoveEnd);
    this.map.on('resize', this.onResize);
    this.reseedAll();
    const loop = (t: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      if (t - this.lastFrame < 30) return; // ~30 fps is plenty
      this.lastFrame = t;
      if (!this.moving) this.step();
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.map.off('movestart', this.onMoveStart);
    this.map.off('moveend', this.onMoveEnd);
    this.map.off('resize', this.onResize);
    this.clear();
    this.canvas.hidden = true;
  }

  private resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const { clientWidth: w, clientHeight: h } = this.map.getContainer();
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round(Math.min(4000, Math.max(800, (w * h) / 450)));
    this.particles = Array.from({ length: count }, () => ({ lon: 0, lat: 0, age: 0, x: 0, y: 0, visible: false }));
    this.reseedAll();
  }

  private clear() {
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  private reseedAll() {
    this.clear();
    for (const p of this.particles) this.seed(p, true);
  }

  private seed(p: Particle, randomAge = false) {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    for (let tries = 0; tries < 6; tries++) {
      const sx = Math.random() * w;
      const sy = Math.random() * h;
      const ll = this.map.unproject([sx, sy]);
      if (!Number.isFinite(ll.lat) || Math.abs(ll.lat) > 84) continue;
      const pt = this.map.project(ll);
      if (Math.abs(pt.x - sx) > 2 || Math.abs(pt.y - sy) > 2) continue; // off-globe
      p.lon = ll.lng;
      p.lat = ll.lat;
      p.x = pt.x;
      p.y = pt.y;
      p.visible = true;
      p.age = randomAge ? Math.floor(Math.random() * 80) : 0;
      return;
    }
    p.visible = false;
    p.age = 70 + Math.floor(Math.random() * 10);
  }

  /** Far side of the globe must not show particles. Uses MapLibre's own test when available. */
  private occlusionTest(): (ll: LngLat) => boolean {
    const t = (this.map as unknown as { _camera?: { transform?: { isLocationOccluded?: (l: LngLat) => boolean } } })._camera
      ?.transform;
    if (t?.isLocationOccluded) return (ll) => t.isLocationOccluded!(ll);
    const c = this.map.getCenter();
    const rad = Math.PI / 180;
    const sinC = Math.sin(c.lat * rad);
    const cosC = Math.cos(c.lat * rad);
    // fallback: great-circle angle from the view centre > ~85°
    return (ll) =>
      sinC * Math.sin(ll.lat * rad) + cosC * Math.cos(ll.lat * rad) * Math.cos((ll.lng - c.lng) * rad) < 0.09;
  }

  private step() {
    const g = this.getSampler();
    if (!g) return;
    const ctx = this.ctx;
    // Fade previous trails
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';

    const zoom = this.map.getZoom();
    const degPerMs = (0.11 * 360) / (512 * 2 ** zoom); // degrees per frame per (m/s)
    const occluded = this.occlusionTest();
    const buckets: Path2D[] = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
    const ll = new LngLat(0, 0);

    for (const p of this.particles) {
      if (++p.age > 90 || !p.visible) {
        this.seed(p);
        continue;
      }
      const u = g.sample('u', p.lat, p.lon);
      const v = g.sample('v', p.lat, p.lon);
      const speed = Math.hypot(u, v);
      if (Number.isNaN(speed)) {
        p.visible = false;
        continue;
      }
      const cosLat = Math.max(0.15, Math.cos((p.lat * Math.PI) / 180));
      p.lon += (u * degPerMs) / cosLat;
      p.lat += v * degPerMs;
      if (Math.abs(p.lat) > 84) {
        p.visible = false;
        continue;
      }
      ll.lng = p.lon;
      ll.lat = p.lat;
      if (occluded(ll)) {
        p.visible = false;
        continue;
      }
      const pt = this.map.project(ll);
      if (Math.abs(pt.x - p.x) < 40 && Math.abs(pt.y - p.y) < 40) {
        const b = speed < 4 ? 0 : speed < 9 ? 1 : speed < 15 ? 2 : 3;
        buckets[b].moveTo(p.x, p.y);
        buckets[b].lineTo(pt.x, pt.y);
      }
      p.x = pt.x;
      p.y = pt.y;
    }
    const colors = ['rgba(255,255,255,0.35)', 'rgba(255,255,255,0.6)', 'rgba(255,240,200,0.85)', 'rgba(255,190,120,0.95)'];
    buckets.forEach((path, i) => {
      ctx.strokeStyle = colors[i];
      ctx.stroke(path);
    });
  }
}

// ---------------------------------------------------------------------------
// Day/night terminator

export function nightPolygon(date = new Date()): Feature<Polygon> {
  const rad = Math.PI / 180;
  const dayOfYear = (Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - Date.UTC(date.getUTCFullYear(), 0, 0)) / 86400000;
  // Approximate solar declination & equation of time
  const g = (360 / 365.25) * (dayOfYear + date.getUTCHours() / 24) * rad;
  const decl =
    (0.396372 - 22.91327 * Math.cos(g) + 4.02543 * Math.sin(g) - 0.387205 * Math.cos(2 * g) + 0.051967 * Math.sin(2 * g) - 0.154527 * Math.cos(3 * g) + 0.084798 * Math.sin(3 * g)) *
    rad;
  const eqTime = 0.004297 + 0.107029 * Math.cos(g) - 1.837877 * Math.sin(g) - 0.837378 * Math.cos(2 * g) - 2.340475 * Math.sin(2 * g); // minutes
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const subLon = -((utcMinutes + eqTime - 720) / 4); // where the sun is overhead

  const ring: [number, number][] = [];
  const tanDecl = Math.tan(Math.abs(decl) < 0.001 ? 0.001 : decl);
  for (let lon = -180; lon <= 180; lon += 2) {
    const ha = (lon - subLon) * rad;
    const lat = Math.atan(-Math.cos(ha) / tanDecl) / rad;
    ring.push([lon, lat]);
  }
  // Night covers the pole that is tilted away from the sun.
  const pole = decl > 0 ? -90 : 90;
  ring.push([180, pole], [-180, pole], ring[0]);
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: {} };
}
