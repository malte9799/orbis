import { addProtocol, LngLat, type Map as MlMap } from 'maplibre-gl';
import type { Feature, Polygon } from 'geojson';
import { sampleGrid, type Grid } from '../api/openmeteo';
import { rampColor, TEMP_STOPS } from '../util';

// ---------------------------------------------------------------------------
// Model fields rendered as raster tiles through a custom protocol, so the coarse grid is
// bilinearly interpolated per pixel at every zoom level and MapLibre handles the globe warp.

export type FieldId = 'temp' | 'cloud' | 'precip' | 'pressure';

interface FieldDef {
  label: string;
  unit: string;
  key: keyof Pick<Grid, 'temp' | 'cloud' | 'precip' | 'pressure'>;
  /** returns rgba 0..255 */
  color(v: number): [number, number, number, number];
  legend: { stops: [number, string][]; ticks: number[] };
}

const CLOUD_STOPS: [number, string][] = [
  [0, '#000000'],
  [100, '#ffffff'],
];
const PRECIP_STOPS: [number, string][] = [
  [0.1, '#7fd3ff'],
  [1, '#2f9bff'],
  [3, '#2bd46f'],
  [6, '#ffe14d'],
  [10, '#ff8c1a'],
  [20, '#e8384f'],
  [40, '#b03ad6'],
];
const PRESSURE_STOPS: [number, string][] = [
  [960, '#5b2bd6'],
  [990, '#2f7fd8'],
  [1005, '#4fc3e8'],
  [1013, '#e9eef5'],
  [1022, '#f6c945'],
  [1035, '#e0462f'],
  [1050, '#9e1a3a'],
];

export const FIELDS: Record<FieldId, FieldDef> = {
  temp: {
    label: 'Temperatur',
    unit: '°C',
    key: 'temp',
    color: (v) => [...rampColor(TEMP_STOPS, v), 175] as [number, number, number, number],
    legend: { stops: TEMP_STOPS, ticks: [-30, -15, 0, 15, 30, 40] },
  },
  cloud: {
    label: 'Bewölkung',
    unit: '%',
    key: 'cloud',
    color: (v) => [255, 255, 255, Math.max(0, Math.min(1, (v - 10) / 90)) ** 1.3 * 215],
    legend: { stops: CLOUD_STOPS, ticks: [0, 25, 50, 75, 100] },
  },
  precip: {
    label: 'Niederschlag (Modell)',
    unit: 'mm/h',
    key: 'precip',
    color: (v) => (v < 0.1 ? [0, 0, 0, 0] : ([...rampColor(PRECIP_STOPS, v), 200] as [number, number, number, number])),
    legend: { stops: PRECIP_STOPS, ticks: [0.1, 3, 10, 20, 40] },
  },
  pressure: {
    label: 'Luftdruck',
    unit: 'hPa',
    key: 'pressure',
    color: (v) => [...rampColor(PRESSURE_STOPS, v), 150] as [number, number, number, number],
    legend: { stops: PRESSURE_STOPS, ticks: [970, 990, 1013, 1030, 1045] },
  },
};

let grid: Grid | null = null;
let protocolRegistered = false;
const TILE = 256;

export function setFieldGrid(g: Grid) {
  grid = g;
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
    const m = /^wxfield:\/\/(\w+)\/\w+\/(\d+)\/(\d+)\/(\d+)/.exec(params.url);
    const def = m ? FIELDS[m[1] as FieldId] : undefined;
    if (!m || !def || !grid) throw new Error('field not ready');
    const z = +m[2];
    const x = +m[3];
    const y = +m[4];
    const canvas = new OffscreenCanvas(TILE, TILE);
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(TILE, TILE);
    const field = grid[def.key];
    // Sample every 2nd pixel and fill 2×2 blocks – data is coarse, this halves the cost.
    for (let py = 0; py < TILE; py += 2) {
      const lat = tile2lat(y + (py + 1) / TILE, z);
      for (let px = 0; px < TILE; px += 2) {
        const lon = tile2lon(x + (px + 1) / TILE, z);
        const [r, g, b, a] = def.color(sampleGrid(grid, field, lat, lon));
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const o = ((py + dy) * TILE + px + dx) * 4;
            img.data[o] = r;
            img.data[o + 1] = g;
            img.data[o + 2] = b;
            img.data[o + 3] = a;
          }
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    return { data: await createImageBitmap(canvas) };
  });
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
    private getGrid: () => Grid | null,
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
    const g = this.getGrid();
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
      const u = sampleGrid(g, g.u, p.lat, p.lon);
      const v = sampleGrid(g, g.v, p.lat, p.lon);
      const speed = Math.hypot(u, v);
      const cosLat = Math.max(0.15, Math.cos((p.lat * Math.PI) / 180));
      p.lon += (u * degPerMs) / cosLat;
      p.lat += v * degPerMs;
      if (p.lon > 180) p.lon -= 360;
      if (p.lon < -180) p.lon += 360;
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
