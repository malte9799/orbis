import * as THREE from 'three';
import { WGS84_ELLIPSOID } from '3d-tiles-renderer';
import { TileBoundingVolume } from '3d-tiles-renderer/src/three/renderer/math/TileBoundingVolume.js';
import { ExtendedFrustum } from '3d-tiles-renderer/src/three/renderer/math/ExtendedFrustum.js';
import { parseTile, type TileData } from './parseTile';
import type { WorkerIn, WorkerOut } from './tileWorker';

// Tile engine v2 for OGC 3D Tiles (REPLACE refinement; what the photo meshes and city models use).
//
// The idea, in short: the network is the only thing that may be slow.
//  - Each frame the tileset is walked once. The tiles that are good enough for the view are the *wanted* ones.
//  - A wanted tile is drawn the moment it is loaded, no matter whether its siblings are there. Until then the
//    nearest loaded ancestor stands in. Parents and children overlap for a while; deeper tiles get a
//    polygon offset, so they win against their parents.
//  - Requests go to the tiles in view, in the middle of the screen first, straight to the wanted level (only
//    one coarse ancestor is fetched as a cover while nothing at all is there). What drops out of view is cancelled.
//  - Fetching, decoding and the Cache API sit in workers; the main thread builds meshes within a time budget.

type State = 0 | 1 | 2 | 3; // none, loading, loaded, failed

interface Node {
  id: number;
  parent: Node | null;
  children: Node[];
  depth: number;
  ge: number;
  add: boolean;
  bv: TileBoundingVolume;
  centre: THREE.Vector3;
  tf: THREE.Matrix4;
  uri: string | null;
  external: boolean;
  expanded: boolean;
  jsonLoading: boolean;
  state: State;
  group: THREE.Group | null;
  bytes: number;
  lastSeen: number;
  low: { centre: THREE.Vector3; point: THREE.Vector3 } | null;
  // per frame
  err: number;
  ndc: number;
}

interface Job {
  node: Node;
  id: number;
  worker: number;
  since: number;
  unwanted: number;
}

interface Want {
  node: Node;
  tier: number;
}

export interface EngineParams {
  errorTarget: number;
  /** pixels of error forgiven for distant tiles, and the distance scale of that (1 / metres) */
  falloff: number;
  density: number;
}

const MAX_INFLIGHT = 24;
const MAX_JSON = 6;
const BUILD_BUDGET_MS = 4;
const BUILD_MAX = 4;
const KEEP_MS = 1500;
const WORKERS = Math.max(2, Math.min(4, (navigator.hardwareConcurrency ?? 4) - 1));

const dirOf = (u: string) => u.slice(0, u.lastIndexOf('/') + 1);

export class TileEngine {
  readonly group = new THREE.Group();
  /** raw root tile (bounding volume and transform), for the outline */
  root: { boundingVolume?: unknown; transform?: number[] } | null = null;
  opacity = 100;
  readonly stats = { loaded: 0, failed: 0, queued: 0, downloading: 0, parsing: 0, active: 0, visible: 0, refused: 0, bytes: 0, built: 0, buildMs: 0, maxBuildMs: 0 };

  private top: Node | null = null;
  private nextId = 1;
  private frame = 0;
  private loaded = new Set<Node>();
  private drawn = new Set<Node>();
  private inflight = new Map<number, Job>();
  private jsonInflight = 0;
  private ready: { node: Node; data: TileData }[] = [];
  private workers: Worker[] = [];
  private workerLoad: number[] = [];
  private broken = false;
  private jobId = 1;
  private cam = new THREE.Vector3();
  private frustum = new ExtendedFrustum();
  private viewProj = new THREE.Matrix4();
  private denom = 1;
  private wants = new Map<number, Want>();
  private disposed = false;
  private bytesLoaded = 0;
  private budget = Math.min(2.5e9, Math.max(0.6e9, ((navigator as { deviceMemory?: number }).deviceMemory ?? 4) * 0.25e9));
  private p!: EngineParams;

  constructor(
    private url: string,
    private hooks: { repaint(): void; note(msg: string): void; /** uploads a texture to the GPU now (the layer's renderer) */ upload?(t: THREE.Texture): void },
  ) {
    this.group.matrixAutoUpdate = false;
    try {
      for (let i = 0; i < WORKERS; i++) {
        const w = new Worker(new URL('./tileWorker.ts', import.meta.url), { type: 'module' });
        w.onmessage = (e: MessageEvent<WorkerOut>) => this.onWorker(e.data);
        w.onerror = () => this.workerFailed();
        this.workers.push(w);
        this.workerLoad.push(0);
      }
    } catch {
      this.broken = true;
    }
    void this.loadRoot();
  }

  // ---- tileset -------------------------------------------------------------------------------------------

  private async loadRoot() {
    try {
      const json = await (await fetch(this.url)).json();
      this.root = { boundingVolume: json.root?.boundingVolume, transform: json.root?.transform };
      this.top = this.makeNode(json.root, dirOf(this.url), null, new THREE.Matrix4(), 0);
      this.hooks.repaint();
    } catch (e) {
      this.hooks.note(`Tileset nicht ladbar: ${(e as Error).message}`);
    }
  }

  private makeNode(raw: Record<string, any>, base: string, parent: Node | null, parentTf: THREE.Matrix4, depth: number): Node { // eslint-disable-line @typescript-eslint/no-explicit-any
    const tf = parentTf.clone();
    if (raw.transform) tf.multiply(new THREE.Matrix4().fromArray(raw.transform));
    const bv = new TileBoundingVolume();
    const b = raw.boundingVolume ?? {};
    if (b.region) bv.setRegionData(WGS84_ELLIPSOID, ...(b.region as [number, number, number, number, number, number]));
    else if (b.box) bv.setObbData(b.box, tf);
    else if (b.sphere) bv.setSphereData(b.sphere[0], b.sphere[1], b.sphere[2], b.sphere[3], tf);
    else if (parent) {
      bv.sphere = parent.bv.sphere;
      bv.obb = parent.bv.obb;
      bv.regionObb = parent.bv.regionObb;
    }
    const centre = new THREE.Vector3();
    if (bv.sphere) centre.copy(bv.sphere.center);
    else {
      const o = bv.obb ?? bv.regionObb;
      if (o) o.box.getCenter(centre).applyMatrix4(o.transform);
    }
    const content = raw.content ?? raw.contents?.[0];
    const rawUri: string | undefined = content?.uri ?? content?.url;
    const uri = rawUri ? new URL(rawUri, base).href : null;
    const refine = String(raw.refine ?? (parent ? (parent.add ? 'ADD' : 'REPLACE') : 'REPLACE')).toUpperCase();
    const node: Node = {
      id: this.nextId++, parent, children: [], depth, ge: raw.geometricError ?? 0, add: refine === 'ADD', bv, centre, tf, uri,
      external: !!uri && /\.json($|\?)/.test(uri.split('#')[0]), expanded: false, jsonLoading: false, state: 0, group: null, bytes: 0, lastSeen: 0, low: null, err: 0, ndc: 0,
    };
    for (const c of raw.children ?? []) node.children.push(this.makeNode(c, base, node, tf, depth + 1));
    return node;
  }

  private async expand(n: Node) {
    if (n.jsonLoading || !n.uri) return;
    n.jsonLoading = true;
    this.jsonInflight++;
    try {
      const json = await (await fetch(n.uri)).json();
      if (this.disposed) return;
      const child = this.makeNode(json.root, dirOf(n.uri), n, n.tf, n.depth + 1);
      // the external tileset's root stands where the node is: its own (non-json) content is the child's
      n.children = [child];
      n.expanded = true;
      this.hooks.repaint();
    } catch {
      n.state = 3;
      this.stats.failed++;
    } finally {
      this.jsonInflight--;
      n.jsonLoading = false;
    }
  }

  // ---- per frame -----------------------------------------------------------------------------------------

  /** `lod` is the map's camera in ENU metres; the group's own matrix turns ECEF into that frame. */
  update(lod: THREE.PerspectiveCamera, size: { width: number; height: number }, params: EngineParams) {
    if (this.disposed) return;
    this.p = params;
    this.frame++;
    const g = this.group.matrix; // set by the layer: ECEF → east/north/up around the anchor
    this.cam.copy(lod.position).applyMatrix4(new THREE.Matrix4().copy(g).invert());
    this.viewProj.copy(lod.projectionMatrix).multiply(lod.matrixWorldInverse).multiply(g);
    this.frustum.setFromProjectionMatrix(this.viewProj);
    this.denom = 2 / lod.projectionMatrix.elements[5] / size.height;

    this.build();
    if (!this.top) return;
    this.wants.clear();
    this.drawn.clear();
    this.visit(this.top, false, []);

    for (const n of this.loaded) {
      const on = this.drawn.has(n);
      if (n.group && n.group.visible !== on) n.group.visible = on;
    }
    this.schedule();
    this.evict();
    this.stats.loaded = this.loaded.size;
    this.stats.active = this.stats.visible = this.drawn.size;
    this.stats.downloading = this.inflight.size;
    this.stats.parsing = this.ready.length;
    this.stats.queued = Math.max(0, this.wants.size - this.inflight.size);
    this.stats.bytes = this.bytesLoaded;
  }

  private errorOf(n: Node, dist: number): number {
    let err = dist === 0 ? Infinity : n.ge / (dist * this.denom);
    if (Number.isFinite(err) && this.p.falloff > 0) {
      const f = dist * this.p.density;
      err -= this.p.falloff * (1 - Math.exp(-f * f));
    }
    return err;
  }

  /** Walks one subtree. Returns whether its area is covered by something drawn. */
  private visit(n: Node, loadedAncestor: boolean, stack: Node[]): boolean {
    if (!n.bv.intersectsFrustum(this.frustum)) return true; // out of view: nothing to cover
    n.lastSeen = this.frame;
    const dist = n.bv.distanceToPoint(this.cam);
    n.err = this.errorOf(n, dist);
    const hasContent = !!n.uri && !n.external;
    const pending = n.external && !n.expanded && n.state !== 3;
    const refine = (n.children.length > 0 || pending) && (n.err > this.p.errorTarget || !hasContent);

    if (!refine) {
      if (!hasContent) return true;
      if (n.state === 2) {
        this.drawn.add(n);
        return true;
      }
      if (n.state !== 3) this.want(n, loadedAncestor ? 1 : 0, stack);
      return false;
    }
    if (pending) {
      if (this.jsonInflight < MAX_JSON) void this.expand(n);
      return false;
    }
    const covered = hasContent && n.state === 2;
    const anc = loadedAncestor || covered;
    let all = true;
    stack.push(n);
    for (const c of n.children) if (!this.visit(c, anc, stack)) all = false;
    stack.pop();
    if (n.add) {
      if (covered) this.drawn.add(n);
      return true;
    }
    if (all) return true;
    if (covered) {
      this.drawn.add(n); // stands in for the children that are not there yet
      return true;
    }
    return false;
  }

  private want(n: Node, tier: number, stack: Node[]) {
    this.rank(n);
    const put = (x: Node, t: number) => {
      const w = this.wants.get(x.id);
      if (!w || w.tier > t) {
        this.rank(x);
        this.wants.set(x.id, { node: x, tier: t });
      }
    };
    put(n, tier);
    if (tier === 0) {
      // nothing covers this area yet: a coarse ancestor (error up to 16 × target) is fetched first as a cover
      const cover = stack.find((a) => a.uri && !a.external && a.state !== 3 && a.err <= this.p.errorTarget * 16);
      if (cover && cover !== n) put(cover, 0);
    }
  }

  private rank(n: Node) {
    const v = TMP4.set(n.centre.x, n.centre.y, n.centre.z, 1).applyMatrix4(this.viewProj);
    n.ndc = v.w > 0 ? Math.hypot(v.x / v.w, v.y / v.w) : 10;
  }

  // ---- requests --------------------------------------------------------------------------------------------

  private key(w: Want) {
    return w.tier * 1e6 + w.node.ndc * 1e3 + w.node.depth;
  }

  private schedule() {
    const now = performance.now();
    const list = [...this.wants.values()].sort((a, b) => this.key(a) - this.key(b));
    const wantedIds = new Set(list.map((w) => w.node.id));
    // drop what is no longer needed (after a grace period, so a wobbling camera does not cancel everything)
    for (const job of this.inflight.values()) {
      if (wantedIds.has(job.node.id)) job.unwanted = 0;
      else if (!job.unwanted) job.unwanted = now;
      else if (now - job.unwanted > KEEP_MS) this.cancel(job);
    }
    for (const w of list) {
      if (w.node.state !== 0) continue;
      if (this.inflight.size >= MAX_INFLIGHT) {
        // full: the worst job gives way to a better candidate
        let worst: Job | null = null;
        let worstKey = -1;
        for (const j of this.inflight.values()) {
          const jw = this.wants.get(j.node.id);
          const k = jw ? this.key(jw) : Infinity;
          if (k > worstKey) {
            worstKey = k;
            worst = j;
          }
        }
        if (worst && worstKey > this.key(w) + 500) this.cancel(worst);
        else break;
      }
      this.start(w.node);
    }
  }

  private start(n: Node) {
    if (!n.uri) return;
    n.state = 1;
    const id = this.jobId++;
    let wi = 0;
    for (let i = 1; i < this.workerLoad.length; i++) if (this.workerLoad[i] < this.workerLoad[wi]) wi = i;
    const job: Job = { node: n, id, worker: wi, since: performance.now(), unwanted: 0 };
    this.inflight.set(id, job);
    if (!this.broken && this.workers.length) {
      this.workerLoad[wi]++;
      this.workers[wi].postMessage({ type: 'load', id, url: n.uri, transform: n.tf.toArray() } satisfies WorkerIn);
    } else void this.runOnMain(job);
  }

  private cancel(job: Job) {
    this.inflight.delete(job.id);
    job.node.state = 0;
    if (!this.broken && this.workers[job.worker]) {
      this.workerLoad[job.worker] = Math.max(0, this.workerLoad[job.worker] - 1);
      this.workers[job.worker].postMessage({ type: 'cancel', id: job.id } satisfies WorkerIn);
    }
  }

  private async runOnMain(job: Job) {
    try {
      const res = await fetch(job.node.uri!);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { data } = await parseTile(await res.arrayBuffer(), job.node.tf.toArray());
      this.finish(job.id, data);
    } catch (e) {
      this.fail(job.id, String((e as Error).message ?? e), false);
    }
  }

  private onWorker(m: WorkerOut) {
    const job = this.inflight.get(m.id);
    if (m.type === 'done') {
      if (job) this.workerLoad[job.worker] = Math.max(0, this.workerLoad[job.worker] - 1);
      this.finish(m.id, m.data);
    } else {
      if (job) this.workerLoad[job.worker] = Math.max(0, this.workerLoad[job.worker] - 1);
      // a worker that cannot decode here (no document, no ImageBitmap …) is given up for the main thread
      if (/document|ImageBitmap|createImageBitmap/i.test(m.error) && job) {
        this.broken = true;
        job.node.state = 1;
        void this.runOnMain(job);
        return;
      }
      this.fail(m.id, m.error, !!m.aborted);
    }
  }

  private workerFailed() {
    if (this.broken) return;
    this.broken = true;
    for (const job of [...this.inflight.values()]) void this.runOnMain(job);
  }

  private finish(id: number, data: TileData) {
    const job = this.inflight.get(id);
    if (!job) return; // cancelled meanwhile
    this.inflight.delete(id);
    this.ready.push({ node: job.node, data });
    this.hooks.repaint();
  }

  private fail(id: number, error: string, aborted: boolean) {
    const job = this.inflight.get(id);
    if (!job) return;
    this.inflight.delete(id);
    if (aborted) {
      job.node.state = 0;
      return;
    }
    job.node.state = 3;
    this.stats.failed++;
    this.hooks.note(`Kachel: ${error}`);
  }

  // ---- meshes ----------------------------------------------------------------------------------------------

  /** Builds meshes of finished tiles, within a time budget so that a burst of tiles does not stall a frame. */
  private build() {
    const t0 = performance.now();
    let n = 0;
    while (this.ready.length && n < BUILD_MAX && performance.now() - t0 < BUILD_BUDGET_MS) {
      const { node, data } = this.ready.shift()!;
      if (this.disposed) return;
      const m0 = performance.now();
      this.make(node, data);
      const took = performance.now() - m0;
      this.stats.buildMs += took;
      this.stats.maxBuildMs = Math.max(this.stats.maxBuildMs, took);
      n++;
    }
    if (this.ready.length) this.hooks.repaint(); // more to build next frame
  }

  private make(node: Node, data: TileData) {
    const g = new THREE.Group();
    g.matrixAutoUpdate = false;
    g.matrix.copy(node.tf).multiply(new THREE.Matrix4().fromArray(data.matrix));
    g.visible = false;
    const o = this.opacity / 100;
    for (const m of data.meshes) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(m.position, 3));
      if (m.normal) geo.setAttribute('normal', new THREE.BufferAttribute(m.normal, 3));
      if (m.uv) geo.setAttribute('uv', new THREE.BufferAttribute(m.uv, 2));
      if (m.index) geo.setIndex(new THREE.BufferAttribute(m.index, 1));
      if (!m.normal && !m.unlit) geo.computeVertexNormals();
      let map: THREE.Texture | null = null;
      if (m.image) {
        map = new THREE.Texture(m.image as unknown as HTMLImageElement);
        map.flipY = false;
        map.colorSpace = THREE.SRGBColorSpace;
        map.wrapS = map.wrapT = THREE.RepeatWrapping;
        map.needsUpdate = true;
        this.hooks.upload?.(map); // upload now, inside the build budget, not while drawing
      }
      const base = { map, color: new THREE.Color().setRGB(m.color[0], m.color[1], m.color[2]), side: m.doubleSided ? THREE.DoubleSide : THREE.FrontSide, transparent: o < 1, opacity: o };
      const mat = m.unlit ? new THREE.MeshBasicMaterial(base) : new THREE.MeshStandardMaterial({ ...base, metalness: 0, roughness: 1 });
      // deeper tiles win against their parents while those are still shown underneath
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = -node.depth * 0.5;
      mat.polygonOffsetUnits = -node.depth;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      g.add(mesh);
    }
    node.group = g;
    node.state = 2;
    node.bytes = data.bytes;
    node.low = { centre: new THREE.Vector3(...data.centre), point: new THREE.Vector3(...data.low) };
    this.bytesLoaded += data.bytes;
    this.loaded.add(node);
    this.group.add(g);
    this.stats.built++;
  }

  // ---- memory ------------------------------------------------------------------------------------------------

  private evict() {
    if (this.bytesLoaded <= this.budget) return;
    const old = [...this.loaded].filter((n) => !this.drawn.has(n) && n.lastSeen < this.frame - 5).sort((a, b) => a.lastSeen - b.lastSeen);
    for (const n of old) {
      if (this.bytesLoaded <= this.budget * 0.8) break;
      this.unload(n);
    }
  }

  private unload(n: Node) {
    if (!n.group) return;
    this.group.remove(n.group);
    n.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.dispose();
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.map?.dispose();
      mat.dispose();
    });
    this.bytesLoaded -= n.bytes;
    n.group = null;
    n.low = null;
    n.state = 0;
    this.loaded.delete(n);
  }

  // ---- for the layer ---------------------------------------------------------------------------------------

  /** lowest point of the drawn tile nearest to `c` (ECEF), for the ground height */
  nearestLow(c: THREE.Vector3): THREE.Vector3 | null {
    let best = Infinity;
    let low: THREE.Vector3 | null = null;
    for (const n of this.drawn) {
      if (!n.low) continue;
      const d = n.low.centre.distanceTo(c);
      if (d < best) {
        best = d;
        low = n.low.point;
      }
    }
    return low;
  }

  /**
   * The ground under a point (ECEF): the lowest vertex within a few metres of it (horizontally) of the finest
   * tile drawn there, returned as a point on the vertical through `c`. Unlike the lowest vertex of a whole tile
   * this does not change with the level of detail by tens of metres, so the layer does not jump while tiles
   * are swapped. Searches wider (15 m, 60 m, 250 m, 1 km) when nothing is that close.
   */
  groundAt(c: THREE.Vector3): THREE.Vector3 | null {
    let best: Node | null = null;
    for (const n of this.drawn) {
      if (!n.group || n.bv.distanceToPoint(c) > 50) continue;
      if (!best || n.depth > best.depth) best = n;
    }
    if (!best?.group) return this.nearestLow(c);
    const up = c.clone().normalize();
    const e = best.group.matrix.elements;
    const meshes = best.group.children as THREE.Mesh[];
    for (const radius of [15, 60, 250, 1000]) {
      const r2 = radius * radius;
      let hmin = Infinity;
      for (const mesh of meshes) {
        const a = mesh.geometry.getAttribute('position').array as Float32Array;
        for (let i = 0; i < a.length; i += 3) {
          const x = a[i], y = a[i + 1], z = a[i + 2];
          const dx = e[0] * x + e[4] * y + e[8] * z + e[12] - c.x;
          const dy = e[1] * x + e[5] * y + e[9] * z + e[13] - c.y;
          const dz = e[2] * x + e[6] * y + e[10] * z + e[14] - c.z;
          const h = dx * up.x + dy * up.y + dz * up.z;
          if (h < hmin && dx * dx + dy * dy + dz * dz - h * h < r2) hmin = h;
        }
      }
      if (hmin !== Infinity) return c.clone().addScaledVector(up, hmin);
    }
    return this.nearestLow(c);
  }

  setOpacity(percent: number) {
    this.opacity = percent;
    const o = percent / 100;
    for (const n of this.loaded) {
      n.group?.traverse((m) => {
        const mat = (m as THREE.Mesh).material as THREE.Material | undefined;
        if (mat) {
          mat.transparent = o < 1;
          mat.opacity = o;
          mat.needsUpdate = true;
        }
      });
    }
  }

  dispose() {
    this.disposed = true;
    for (const job of [...this.inflight.values()]) this.cancel(job);
    for (const n of [...this.loaded]) this.unload(n);
    for (const w of this.workers) w.terminate();
    this.workers = [];
    this.ready = [];
  }
}

const TMP4 = new THREE.Vector4();
