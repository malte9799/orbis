import { LngLat } from 'maplibre-gl';
import { occlusionTest } from './overlay';
import type { CustomLayerInterface, CustomRenderMethodInput, Map as MlMap } from 'maplibre-gl';

// WebGL radar layer. Instead of stacking one coloured raster layer per time step, it keeps the
// radar *values* of two neighbouring steps as textures and mixes them in the fragment shader
// before the colour scale is applied. Between two steps the rain moves: a motion field is
// estimated per tile (block matching, see computeFlow), the old step is shifted forward and the
// new one backwards by it before they are mixed. The colours stay on one scale. It works with
// MapLibre's mercator and globe projections (projectTile of the prelude).

export interface GlFrame {
  /** valid time [ms] */
  time: number;
  /** unique key, used for the tile cache */
  key: string;
  maxzoom: number;
  /** value bytes of one tile (size × size); bytes ≥ 250 mean "no measurement"; null = nothing there */
  fetchTile(z: number, x: number, y: number): Promise<{ bytes: Uint8Array; size: number } | null>;
}

const NODATA_MIN = 250;
const MIN_Z = 4;
const MAX_TILES = 300;
const MAX_CACHE = 720;
const MAX_PARALLEL = 4;
/** a tile that failed (rate limit, network) is asked for again after this */
const RETRY_MS = 20000;

interface Entry {
  state: 'loading' | 'ready' | 'empty' | 'error';
  /** when a failed tile may be requested again */
  retryAt: number;
  bytes: Uint8Array | null;
  size: number;
  tex: WebGLTexture | null;
  used: number;
}

const FRAG = `#version 300 es
precision highp float;
uniform sampler2D u_a;
uniform sampler2D u_b;
uniform sampler2D u_lut;
uniform sampler2D u_flow;
uniform float u_wa;
uniform float u_wb;
uniform float u_opacity;
in vec2 v_uv;
out vec4 outColor;

// cubic B-spline weights
vec4 cubic(float v) {
  vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - v;
  vec4 s = n * n * n;
  float x = s.x;
  float y = s.y - 4.0 * s.x;
  float z = s.z - 4.0 * s.y + 6.0 * s.x;
  float w = 6.0 - x - y - z;
  return vec4(x, y, z, w) * (1.0 / 6.0);
}

// bicubic sample out of four bilinear fetches: round edges even when a texel covers many pixels
vec2 bicubic(sampler2D tex, vec2 uv) {
  vec2 size = vec2(textureSize(tex, 0));
  vec2 inv = 1.0 / size;
  uv = uv * size - 0.5;
  vec2 fxy = fract(uv);
  uv -= fxy;
  vec4 xc = cubic(fxy.x);
  vec4 yc = cubic(fxy.y);
  vec4 c = uv.xxyy + vec2(-0.5, 1.5).xyxy;
  vec4 s = vec4(xc.xz + xc.yw, yc.xz + yc.yw);
  vec4 o = (c + vec4(xc.yw, yc.yw) / s) * inv.xxyy;
  vec2 s0 = texture(tex, o.xz).rg;
  vec2 s1 = texture(tex, o.yz).rg;
  vec2 s2 = texture(tex, o.xw).rg;
  vec2 s3 = texture(tex, o.yw).rg;
  float sx = s.x / (s.x + s.y);
  float sy = s.z / (s.z + s.w);
  return mix(mix(s3, s2, sx), mix(s1, s0, sx), sy);
}

void main() {
  float w = u_wa + u_wb;
  if (w <= 0.0) discard;
  float r = u_wb / w;
  // motion of the rain between the two steps (zero when not known, and towards the tile edges
  // so that neighbouring tiles agree): the old step is carried forward, the new one back
  vec2 f = texture(u_flow, v_uv).rg;
  f *= smoothstep(0.0, 0.08, min(min(v_uv.x, 1.0 - v_uv.x), min(v_uv.y, 1.0 - v_uv.y)));
  vec2 a = bicubic(u_a, v_uv - f * r);
  vec2 b = bicubic(u_b, v_uv + f * (1.0 - r));
  // mix the values first, colour afterwards. Both steps are already carried to the same moment
  // by the motion field, so a linear mix on the (sqrt-coded) bytes keeps cells at their strength.
  // (An extra "lift" against dimming made the picture swell up in the middle of every step.)
  float v = clamp((a.r * u_wa + b.r * u_wb) / w, 0.0, 1.0);
  float ok = (a.g * u_wa + b.g * u_wb) / w;
  float m = smoothstep(0.25, 0.75, ok);
  vec4 c = texture(u_lut, vec2((v * 255.0 + 0.5) / 256.0, 0.5));
  float al = c.a * m * u_opacity;
  outColor = vec4(c.rgb * al, al);
}`;

const vert = (prelude: string, define: string) => `#version 300 es
${prelude}
${define}
in vec2 a_local;
uniform vec3 u_tile; // mercator x, y of the tile's north-west corner and its size
out vec2 v_uv;
void main() {
  v_uv = a_local;
  gl_Position = projectTile(u_tile.xy + a_local * u_tile.z);
}`;


// ---- motion between two steps ---------------------------------------------------------------
const FLOW_N = 128; // values are compared at 128 × 128 per tile
const FLOW_G = 16; // one vector per 8 × 8 values
const FLOW_R = 8; // search radius in those values (≈ 19 km at zoom 7 for 1.2 km texels)

function downsample(bytes: Uint8Array, size: number): Float32Array {
  const out = new Float32Array(FLOW_N * FLOW_N);
  const f = size / FLOW_N;
  for (let y = 0; y < FLOW_N; y++) {
    for (let x = 0; x < FLOW_N; x++) {
      let sum = 0;
      for (let j = 0; j < f; j++) {
        for (let i = 0; i < f; i++) {
          const v = bytes[(y * f + j) * size + x * f + i];
          sum += v >= NODATA_MIN ? 0 : v;
        }
      }
      out[y * FLOW_N + x] = sum / (f * f);
    }
  }
  return out;
}

/**
 * Where does the rain of `a` appear in `b`? Block matching on a coarse grid: for every 16 × 16
 * window the shift with the smallest squared difference. Vectors without a clear match take the
 * tile's dominant motion (weather moves coherently), then the field is smoothed. Result: for each
 * of 16 × 16 cells a (dx, dy) in texture units (0..1 of the tile), content of a at p is at p + d in b.
 */
function computeFlow(a: Uint8Array, sa: number, b: Uint8Array, sb: number): Float32Array {
  const A = downsample(a, sa);
  const B = downsample(b, sb);
  const N = FLOW_N;
  const cell = N / FLOW_G;
  const half = cell; // window = 2 cells wide (overlapping), centred on the cell
  const vx = new Float32Array(FLOW_G * FLOW_G);
  const vy = new Float32Array(FLOW_G * FLOW_G);
  const wgt = new Float32Array(FLOW_G * FLOW_G); // confidence × energy
  let sumX = 0;
  let sumY = 0;
  let sumW = 0;
  for (let gy = 0; gy < FLOW_G; gy++) {
    for (let gx = 0; gx < FLOW_G; gx++) {
      const x0 = gx * cell + cell / 2 - half;
      const y0 = gy * cell + cell / 2 - half;
      let energy = 0;
      for (let j = 0; j < 2 * half; j++) {
        for (let i = 0; i < 2 * half; i++) {
          const x = x0 + i;
          const y = y0 + j;
          if (x < 0 || y < 0 || x >= N || y >= N) continue;
          energy += A[y * N + x] + B[y * N + x];
        }
      }
      if (energy < 2 * half * 2 * half * 1.5) continue; // nearly empty window
      let best = Infinity;
      let bsx = 0;
      let bsy = 0;
      let zero = 0;
      for (let sy = -FLOW_R; sy <= FLOW_R; sy++) {
        for (let sx = -FLOW_R; sx <= FLOW_R; sx++) {
          let ssd = 0;
          for (let j = 0; j < 2 * half; j += 2) {
            const y = y0 + j;
            if (y < 0 || y >= N) continue;
            const yy = y + sy;
            for (let i = 0; i < 2 * half; i += 2) {
              const x = x0 + i;
              if (x < 0 || x >= N) continue;
              const xx = x + sx;
              const bv = xx < 0 || yy < 0 || xx >= N || yy >= N ? 0 : B[yy * N + xx];
              const d = A[y * N + x] - bv;
              ssd += d * d;
            }
          }
          if (sx === 0 && sy === 0) zero = ssd;
          ssd += (sx * sx + sy * sy) * 0.4 * (energy / (4 * half * half)); // prefer small moves
          if (ssd < best) {
            best = ssd;
            bsx = sx;
            bsy = sy;
          }
        }
      }
      const gain = zero > 0 ? (zero - best) / zero : 0;
      if (gain < 0.15) continue; // no clearer than standing still
      const k = gy * FLOW_G + gx;
      vx[k] = bsx;
      vy[k] = bsy;
      wgt[k] = gain * energy;
      sumX += bsx * wgt[k];
      sumY += bsy * wgt[k];
      sumW += wgt[k];
    }
  }
  // fall back to the dominant motion where nothing was found
  const mx = sumW > 0 ? sumX / sumW : 0;
  const my = sumW > 0 ? sumY / sumW : 0;
  for (let k = 0; k < vx.length; k++) {
    if (wgt[k] === 0) {
      vx[k] = mx;
      vy[k] = my;
    }
  }
  // 3 × 3 smoothing
  const out = new Float32Array(FLOW_G * FLOW_G * 2);
  for (let gy = 0; gy < FLOW_G; gy++) {
    for (let gx = 0; gx < FLOW_G; gx++) {
      let sx = 0;
      let sy = 0;
      let n = 0;
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          const x = gx + i;
          const y = gy + j;
          if (x < 0 || y < 0 || x >= FLOW_G || y >= FLOW_G) continue;
          sx += vx[y * FLOW_G + x];
          sy += vy[y * FLOW_G + x];
          n++;
        }
      }
      const k = (gy * FLOW_G + gx) * 2;
      out[k] = sx / n / N;
      out[k + 1] = sy / n / N;
    }
  }
  return out;
}

export class RadarGl implements CustomLayerInterface {
  readonly id = 'orbis-radar-gl';
  readonly type = 'custom' as const;
  readonly renderingMode = '2d' as const;

  private map: MlMap | null = null;
  private frames: GlFrame[] = [];
  private time = 0;
  private visible = true;
  private tiles = new Map<string, Entry>();
  private programs = new Map<string, WebGLProgram>();
  private lutTex: WebGLTexture | null = null;
  private flows = new Map<string, { data: Float32Array; tex: WebGLTexture | null; used: number }>();
  private zeroFlowTex: WebGLTexture | null = null;
  private emptyTex: WebGLTexture | null = null;
  /** subdivided tile meshes by edge length: a flat quad would not follow the globe */
  private meshes = new Map<number, { vao: WebGLVertexArrayObject; vbo: WebGLBuffer; ibo: WebGLBuffer; count: number }>();
  private inflight = 0;
  private queue: (() => void)[] = [];
  /** zoom and range of the tiles drawn last, for sample() */
  private lastZ = MIN_Z;
  /** tiles of the shown pair that are still on their way */
  private waiting = 0;

  constructor(
    private lut: Uint8ClampedArray,
    private opacity = 0.9,
  ) {}

  // ---- control ---------------------------------------------------------------------------
  setFrames(frames: GlFrame[]) {
    this.frames = [...frames].sort((a, b) => a.time - b.time);
    this.map?.triggerRepaint();
  }

  setTime(ms: number) {
    this.time = ms;
    this.map?.triggerRepaint();
  }

  /** True while tiles of the two shown steps are still loading (the player waits for them). */
  get isLoading() {
    return this.waiting > 0;
  }

  setVisible(on: boolean) {
    this.visible = on;
    this.map?.triggerRepaint();
  }

  /** the two steps around the current time and the position between them */
  private pair(): { a: GlFrame | null; b: GlFrame | null; ratio: number; c: GlFrame | null } {
    const f = this.frames;
    if (!f.length) return { a: null, b: null, ratio: 0, c: null };
    if (this.time <= f[0].time) return { a: f[0], b: null, ratio: 0, c: f[1] ?? null };
    for (let i = 0; i < f.length - 1; i++) {
      if (this.time >= f[i].time && this.time < f[i + 1].time) {
        return { a: f[i], b: f[i + 1], ratio: (this.time - f[i].time) / (f[i + 1].time - f[i].time), c: f[i + 2] ?? null };
      }
    }
    return { a: f[f.length - 1], b: null, ratio: 0, c: null };
  }

  /** Rain value [byte] under a point of the step shown, mixed like the shader does; null = none */
  sample(lng: number, lat: number): number | null {
    const { a, b, ratio } = this.pair();
    if (!a) return null;
    const z = this.lastZ;
    const n = 2 ** z;
    const fx = ((lng + 180) / 360) * n;
    const r = (lat * Math.PI) / 180;
    const fy = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
    const x = Math.floor(fx);
    const y = Math.floor(fy);
    const read = (f: GlFrame | null) => {
      const e = f && this.tiles.get(`${f.key}/${z}/${x}/${y}`);
      if (!e?.bytes) return null;
      const px = Math.min(e.size - 1, Math.floor((fx - x) * e.size));
      const py = Math.min(e.size - 1, Math.floor((fy - y) * e.size));
      const v = e.bytes[py * e.size + px];
      return v >= NODATA_MIN ? null : v;
    };
    const va = read(a);
    const vb = read(b);
    if (va === null && vb === null) return null;
    if (vb === null) return va;
    if (va === null) return vb;
    return va * (1 - ratio) + vb * ratio;
  }

  // ---- gl --------------------------------------------------------------------------------
  onAdd(map: MlMap, gl: WebGL2RenderingContext) {
    this.map = map;
    const mk = (data: ArrayBufferView | null, w: number, h: number, internal: number, format: number, filter: number) => {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, gl.UNSIGNED_BYTE, data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    };
    this.lutTex = mk(new Uint8Array(this.lut.buffer, this.lut.byteOffset, this.lut.byteLength), 256, 1, gl.RGBA8, gl.RGBA, gl.LINEAR);
    this.emptyTex = mk(new Uint8Array(2), 1, 1, gl.RG8, gl.RG, gl.NEAREST);
    {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, 1, 1, 0, gl.RG, gl.FLOAT, new Float32Array(2));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      this.zeroFlowTex = t;
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  onRemove(_map: MlMap, gl: WebGL2RenderingContext) {
    for (const e of this.tiles.values()) if (e.tex) gl.deleteTexture(e.tex);
    this.tiles.clear();
    for (const p of this.programs.values()) gl.deleteProgram(p);
    this.programs.clear();
    if (this.lutTex) gl.deleteTexture(this.lutTex);
    if (this.emptyTex) gl.deleteTexture(this.emptyTex);
    if (this.zeroFlowTex) gl.deleteTexture(this.zeroFlowTex);
    for (const f of this.flows.values()) if (f.tex) gl.deleteTexture(f.tex);
    this.flows.clear();
    for (const m of this.meshes.values()) {
      gl.deleteBuffer(m.vbo);
      gl.deleteBuffer(m.ibo);
      gl.deleteVertexArray(m.vao);
    }
    this.meshes.clear();
  }

  private program(gl: WebGL2RenderingContext, args: CustomRenderMethodInput): WebGLProgram {
    const key = args.shaderData.variantName;
    let p = this.programs.get(key);
    if (p) return p;
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader');
      return s;
    };
    p = gl.createProgram()!;
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vert(args.shaderData.vertexShaderPrelude, args.shaderData.define)));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.bindAttribLocation(p, 0, 'a_local');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link');
    this.programs.set(key, p);
    return p;
  }

  // ---- tiles -----------------------------------------------------------------------------
  private entry(f: GlFrame, z: number, x: number, y: number): Entry {
    const key = `${f.key}/${z}/${x}/${y}`;
    let e = this.tiles.get(key);
    if (e?.state === 'error' && performance.now() >= e.retryAt) {
      this.tiles.delete(key);
      e = undefined;
    }
    if (!e) {
      e = { state: 'loading', bytes: null, size: 0, tex: null, used: 0, retryAt: 0 };
      this.tiles.set(key, e);
      const entry = e;
      const start = () => {
        this.inflight++;
        f.fetchTile(z, x, y)
          .then((t) => {
            if (t) {
              entry.bytes = t.bytes;
              entry.size = t.size;
              entry.state = 'ready';
            } else entry.state = 'empty';
          })
          .catch(() => {
            // rate limit or network: not "no rain" – try again later
            entry.state = 'error';
            entry.retryAt = performance.now() + RETRY_MS;
          })
          .finally(() => {
            this.inflight--;
            this.queue.shift()?.();
            this.map?.triggerRepaint();
          });
      };
      if (this.inflight < MAX_PARALLEL) start();
      else this.queue.push(start);
    }
    return e;
  }

  private upload(gl: WebGL2RenderingContext, e: Entry): WebGLTexture | null {
    if (e.tex || !e.bytes) return e.tex;
    const n = e.size * e.size;
    const rg = new Uint8Array(n * 2);
    for (let i = 0; i < n; i++) {
      const v = e.bytes[i];
      if (v < NODATA_MIN) {
        rg[i * 2] = v;
        rg[i * 2 + 1] = 255;
      }
    }
    const t = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG8, e.size, e.size, 0, gl.RG, gl.UNSIGNED_BYTE, rg);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    e.tex = t;
    return t;
  }

  private evict(gl: WebGL2RenderingContext) {
    if (this.flows.size > 600) {
      const old = [...this.flows.entries()].sort((p, q) => p[1].used - q[1].used).slice(0, 150);
      for (const [k, f] of old) {
        if (f.tex) gl.deleteTexture(f.tex);
        this.flows.delete(k);
      }
    }
    if (this.tiles.size <= MAX_CACHE) return;
    const old = [...this.tiles.entries()].sort((a, b) => a[1].used - b[1].used).slice(0, this.tiles.size - MAX_CACHE + 40);
    for (const [k, e] of old) {
      if (e.state === 'loading') continue;
      if (e.tex) gl.deleteTexture(e.tex);
      this.tiles.delete(k);
    }
  }

  /** (n+1)² vertices in tile-local 0..1 and 2·n² triangles, with its own VAO */
  private mesh(gl: WebGL2RenderingContext, n: number) {
    let m = this.meshes.get(n);
    if (m) return m;
    const verts = new Float32Array((n + 1) * (n + 1) * 2);
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= n; i++) {
        verts[(j * (n + 1) + i) * 2] = i / n;
        verts[(j * (n + 1) + i) * 2 + 1] = j / n;
      }
    }
    const idx = new Uint16Array(n * n * 6);
    let k = 0;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const a = j * (n + 1) + i;
        const b = a + 1;
        const c = a + n + 1;
        const d = c + 1;
        idx.set([a, b, c, b, d, c], k);
        k += 6;
      }
    }
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    const ibo = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    m = { vao, vbo, ibo, count: idx.length };
    this.meshes.set(n, m);
    return m;
  }

  // ---- draw ------------------------------------------------------------------------------
  render(gl: WebGL2RenderingContext, args: CustomRenderMethodInput) {
    const map = this.map;
    if (!map || !this.visible) return;
    const { a, b, ratio } = this.pair();
    if (!a) return;

    // One zoom level below the map's: a quarter of the tiles (RainViewer rate-limits hard), and
    // the bicubic sampling keeps the edges round. Never above the source's own maximum.
    const z = Math.max(MIN_Z, Math.min(a.maxzoom, Math.round(map.getZoom()) - 1));
    this.lastZ = z;
    const n = 2 ** z;
    const bounds = map.getBounds();
    const clampLat = (v: number) => Math.max(-85.0511, Math.min(85.0511, v));
    const tx = (lon: number) => Math.floor(((lon + 180) / 360) * n);
    const ty = (lat: number) => {
      const r = (clampLat(lat) * Math.PI) / 180;
      return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
    };
    const wide = bounds.getEast() - bounds.getWest() >= 359;
    let x0 = wide ? 0 : Math.max(0, tx(bounds.getWest()));
    let x1 = wide ? n - 1 : Math.min(n - 1, tx(bounds.getEast()));
    const y0 = Math.max(0, ty(bounds.getNorth()));
    const y1 = Math.min(n - 1, ty(bounds.getSouth()));
    if (x1 < x0) [x0, x1] = [0, n - 1]; // crosses the antimeridian: take the whole row
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > MAX_TILES) return;

    const program = this.program(gl, args);
    gl.useProgram(program);
    const pd = args.defaultProjectionData;
    const u = (name: string) => gl.getUniformLocation(program, name);
    gl.uniformMatrix4fv(u('u_projection_matrix'), false, pd.mainMatrix as unknown as Float32List);
    gl.uniform4f(u('u_projection_tile_mercator_coords'), ...pd.tileMercatorCoords);
    gl.uniform4f(u('u_projection_clipping_plane'), ...pd.clippingPlane);
    gl.uniform1f(u('u_projection_transition'), pd.projectionTransition);
    gl.uniformMatrix4fv(u('u_projection_fallback_matrix'), false, pd.fallbackMatrix as unknown as Float32List);
    gl.uniform1i(u('u_a'), 0);
    gl.uniform1i(u('u_b'), 1);
    gl.uniform1i(u('u_lut'), 2);
    gl.uniform1i(u('u_flow'), 3);
    gl.uniform1f(u('u_opacity'), this.opacity);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.lutTex);

    // coarse zooms: large tiles, many segments so that they follow the globe
    const mesh = this.mesh(gl, z <= 3 ? 32 : z === 4 ? 16 : z === 5 ? 8 : 4);
    gl.bindVertexArray(mesh.vao);
    gl.disable(gl.DEPTH_TEST);

    const now = performance.now();
    let waiting = 0;
    let flowBudget = 4;
    // globe: tiles entirely behind the horizon are neither fetched nor drawn
    const occluded = occlusionTest(map);
    const tileLon = (v: number) => (v / n) * 360 - 180;
    const tileLat = (v: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * v) / n))) * 180) / Math.PI;
    const tileHidden = (x: number, y: number) => {
      for (let i = 0; i <= 2; i++) {
        for (let j = 0; j <= 2; j++) {
          if (!occluded(new LngLat(tileLon(x + i / 2), tileLat(y + j / 2)))) return false;
        }
      }
      return true;
    };
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        if (tileHidden(x, y)) continue;
        const ea = this.entry(a, z, x, y);
        const eb = b ? this.entry(b, z, x, y) : null;
        ea.used = now;
        if (eb) eb.used = now;
        if (ea.state === 'loading') waiting++;
        if (eb?.state === 'loading') waiting++;
        const ta = ea.state === 'ready' ? this.upload(gl, ea) : null;
        const tb = eb && eb.state === 'ready' ? this.upload(gl, eb) : null;
        if (!ta && !tb) continue;
        // motion field of this tile for this pair of steps (a few per frame, the rest follows)
        let flowTex = this.zeroFlowTex;
        if (ta && tb && b && ea.bytes && eb?.bytes) {
          const fk = `${a.key}>${b.key}/${z}/${x}/${y}`;
          let fl = this.flows.get(fk);
          if (!fl && flowBudget > 0) {
            flowBudget--;
            fl = { data: computeFlow(ea.bytes, ea.size, eb.bytes, eb.size), tex: null, used: now };
            this.flows.set(fk, fl);
          } else if (!fl) {
            map.triggerRepaint(); // more tiles wait for their motion field
          }
          if (fl) {
            fl.used = now;
            if (!fl.tex) {
              const t = gl.createTexture()!;
              gl.activeTexture(gl.TEXTURE3);
              gl.bindTexture(gl.TEXTURE_2D, t);
              gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, FLOW_G, FLOW_G, 0, gl.RG, gl.FLOAT, fl.data);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
              gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
              fl.tex = t;
            }
            flowTex = fl.tex;
          }
        }
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, flowTex);
        gl.uniform1f(u('u_wa'), ta ? 1 - ratio : 0);
        gl.uniform1f(u('u_wb'), tb ? ratio : 0);
        // a step that has not arrived yet must not dim the other one
        if (!ta) gl.uniform1f(u('u_wb'), 1);
        if (!tb) gl.uniform1f(u('u_wa'), 1);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, ta ?? this.emptyTex);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, tb ?? this.emptyTex);
        gl.uniform3f(u('u_tile'), x / n, y / n, 1 / n);
        gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
      }
    }
    this.waiting = waiting;
    // leave the context as MapLibre expects it
    for (const unit of [gl.TEXTURE3, gl.TEXTURE2, gl.TEXTURE1, gl.TEXTURE0]) {
      gl.activeTexture(unit);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }
    gl.bindVertexArray(null);
    this.evict(gl);
  }
}
