import * as THREE from 'three';
import { WGS84_ELLIPSOID } from '3d-tiles-renderer';
import { TileBoundingVolume } from '3d-tiles-renderer/src/three/renderer/math/TileBoundingVolume.js';
import { ExtendedFrustum } from '3d-tiles-renderer/src/three/renderer/math/ExtendedFrustum.js';
import { parseTile, type TileData } from './parseTile';
import { tileWorkerPool } from './workerPool';

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
  uris: string[];
  externalUris: string[];
  expanded: boolean;
  jsonLoading: boolean;
  expansionFailed: boolean;
  state: State;
  group: THREE.Group | null;
  bytes: number;
  lastSeen: number;
  low: { centre: THREE.Vector3; point: THREE.Vector3 } | null;
  // per frame
  err: number;
  ndc: number;
  visitCursor: number;
}

interface Job {
  node: Node;
  id: number;
  since: number;
  unwanted: number;
  cancelWorker?: () => void;
}

interface Want {
  node: Node;
  tier: number;
}

interface BuildTask {
  node: Node;
  contents: TileData[];
  group: THREE.Group;
  content: number;
  mesh: number;
  bytes: number;
  centre: THREE.Vector3;
  low: THREE.Vector3 | null;
  lowHeight: number;
  uploadsPending: number;
}

interface PendingTexture {
  texture: THREE.Texture;
  task: BuildTask;
}

export interface EngineParams {
  errorTarget: number;
  /** pixels of error forgiven for distant tiles, and the distance scale of that (1 / metres) */
  falloff: number;
  density: number;
}

const MAX_INFLIGHT = 8;
const MAX_JSON = 6;
// National tilesets can expose hundreds of thousands of leaf tiles at a modest zoom.
// Bound frame traversal and candidate work instead of enumerating and sorting the whole visible tree.
const MAX_VISITS_PER_FRAME = 2500;
const MAX_WANTS = 256;
const BUILD_BUDGET_MS = 4;
const BUILD_MAX = 4;
const KEEP_MS = 1500;
const DEVICE_MEMORY_GB = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
const GLOBAL_TILE_BUDGET = Math.min(1.5e9, Math.max(0.5e9, DEVICE_MEMORY_GB * 0.2e9));
let globalTileBytes = 0;

const dirOf = (u: string) => u.slice(0, u.lastIndexOf('/') + 1);

export class TileEngine {
  readonly group = new THREE.Group();
  /** raw root tile (bounding volume and transform), for the outline */
  root: { boundingVolume?: unknown; transform?: number[] } | null = null;
  opacity = 100;
  readonly stats = { loaded: 0, failed: 0, queued: 0, downloading: 0, parsing: 0, uploading: 0, active: 0, visible: 0, refused: 0, bytes: 0, globalBytes: 0, built: 0, buildMs: 0, maxBuildMs: 0 };

  private top: Node | null = null;
  private nextId = 1;
  private frame = 0;
  private loaded = new Set<Node>();
  private drawn = new Set<Node>();
  private inflight = new Map<number, Job>();
  private jsonInflight = 0;
  private ready: BuildTask[] = [];
  private pendingUploads: PendingTexture[] = [];
  private broken = false;
  private jobId = 1;
  private cam = new THREE.Vector3();
  private frustum = new ExtendedFrustum();
  private viewProj = new THREE.Matrix4();
  private denom = 1;
  private upAxis: 'y' | 'z' = 'y';
  private wants = new Map<number, Want>();
  private visitsThisFrame = 0;
  private disposed = false;
  private bytesLoaded = 0;
  private groundCache: { x: number; y: number; z: number; signature: string; height: number | null } | null = null;
  private budget = Math.min(768e6, GLOBAL_TILE_BUDGET * 0.75);
  private p!: EngineParams;

  constructor(
    private url: string,
    private hooks: { repaint(): void; note(msg: string): void; /** uploads a texture to the GPU now (the layer's renderer) */ upload?(t: THREE.Texture): void },
    private maxTexture = 2048,
    private maxAnisotropy = 1,
  ) {
    this.group.matrixAutoUpdate = false;
    void this.loadRoot();
  }

  // ---- tileset -------------------------------------------------------------------------------------------

  private async loadRoot() {
    try {
      const response = await fetch(this.url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      this.upAxis = String(json.asset?.gltfUpAxis ?? 'y').toLowerCase() === 'z' ? 'z' : 'y';
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
    const contents = raw.content ? [raw.content] : Array.isArray(raw.contents) ? raw.contents : [];
    const contentUris = contents.map((content: { uri?: string; url?: string }) => content?.uri ?? content?.url).filter((u: unknown): u is string => typeof u === 'string');
    const externalUris = contentUris.filter((u) => /\.json($|[?#])/i.test(u)).map((u) => new URL(u, base).href);
    const uris = contentUris.filter((u) => !/\.json($|[?#])/i.test(u)).map((u) => new URL(u, base).href);
    const refine = String(raw.refine ?? (parent ? (parent.add ? 'ADD' : 'REPLACE') : 'REPLACE')).toUpperCase();
    const node: Node = {
      id: this.nextId++, parent, children: [], depth, ge: raw.geometricError ?? 0, add: refine === 'ADD',
      // A region is only a geographic bounding volume; it does not define a content transform. In particular,
      // Basel's legacy Z-up tiles use ECEF content coordinates/RTC centers and no tile.transform.
      bv, centre, tf,
      uris, externalUris,
      expanded: externalUris.length === 0, jsonLoading: false, expansionFailed: false, state: 0, group: null, bytes: 0, lastSeen: 0, low: null, err: 0, ndc: 0, visitCursor: 0,
    };
    for (const c of raw.children ?? []) node.children.push(this.makeNode(c, base, node, tf, depth + 1));
    return node;
  }

  private async expand(n: Node) {
    if (n.jsonLoading || !n.externalUris.length) return;
    n.jsonLoading = true;
    this.jsonInflight++;
    try {
      const roots = await Promise.all(n.externalUris.map(async (uri) => {
        const response = await fetch(uri);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return { json: await response.json(), base: dirOf(uri) };
      }));
      if (this.disposed) return;
      n.children.push(...roots.map(({ json, base }) => this.makeNode(json.root, base, n, n.tf, n.depth + 1)));
      n.expanded = true;
      this.hooks.repaint();
    } catch {
      n.expansionFailed = true;
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

    this.uploadTexture();
    this.build();
    if (!this.top) return;
    this.wants.clear();
    this.drawn.clear();
    this.visitsThisFrame = 0;
    const visible: Node[] = [];
    this.visit(this.top, false, [], visible);
    for (const n of visible) this.drawn.add(n);

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
    this.stats.uploading = this.pendingUploads.length;
    this.stats.queued = Math.max(0, this.wants.size - this.inflight.size);
    this.stats.bytes = this.bytesLoaded;
    this.stats.globalBytes = globalTileBytes;
  }

  private errorOf(n: Node, dist: number): number {
    let err = dist === 0 ? Infinity : n.ge / (dist * this.denom);
    if (Number.isFinite(err) && this.p.falloff > 0) {
      const f = dist * this.p.density;
      err -= this.p.falloff * (1 - Math.exp(-f * f));
    }
    return err;
  }

  /** Relax detail near the screen edge and when the shared decoded/GPU budget is tight. */
  private errorTarget(n: Node): number {
    const edge = Math.max(0, Math.min(1, (n.ndc - 0.12) / 0.95));
    const foveated = edge * edge * this.p.errorTarget * 0.8;
    const pressure = Math.max(0, Math.min(1, (globalTileBytes / GLOBAL_TILE_BUDGET - 0.65) / 0.35));
    return (this.p.errorTarget + foveated) * (1 + pressure * 0.75);
  }

  /** Walks one subtree. Returns whether its area is covered by something drawn. */
  private visit(n: Node, loadedAncestor: boolean, stack: Node[], visible: Node[]): boolean {
    if (this.visitsThisFrame >= MAX_VISITS_PER_FRAME) {
      // Keep a loaded coarse tile visible while its descendants wait for a later frame.
      if (n.uris.length && n.state === 2) {
        visible.push(n);
        return true;
      }
      return false;
    }
    this.visitsThisFrame++;
    if (!n.bv.intersectsFrustum(this.frustum)) return true; // out of view: nothing to cover
    n.lastSeen = this.frame;
    const dist = n.bv.distanceToPoint(this.cam);
    this.rank(n);
    n.err = this.errorOf(n, dist);
    const hasContent = n.uris.length > 0;
    const pending = n.externalUris.length > 0 && !n.expanded && !n.expansionFailed;
    const refine = pending || (n.children.length > 0 && (n.err > this.errorTarget(n) || !hasContent));

    if (!refine) {
      if (!hasContent) return true;
      if (n.state === 2) {
        visible.push(n);
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
    const descendants: Node[] = [];
    const childCount = n.children.length;
    const start = childCount ? n.visitCursor % childCount : 0;
    let visitedChildren = 0;
    for (let offset = 0; offset < childCount && this.visitsThisFrame < MAX_VISITS_PER_FRAME; offset++) {
      const c = n.children[(start + offset) % childCount];
      visitedChildren++;
      if (!this.visit(c, anc, stack, descendants)) all = false;
    }
    if (childCount) n.visitCursor = (start + Math.max(1, visitedChildren)) % childCount;
    if (visitedChildren < childCount) all = false;
    stack.pop();
    if (n.add) {
      if (covered) visible.push(n);
      visible.push(...descendants);
      return true;
    }
    if (all) {
      visible.push(...descendants);
      return true;
    }
    if (covered) {
      // REPLACE is atomic: retain the parent until every visible child subtree is ready. Drawing both
      // levels caused z-fighting on roof surfaces during zoom transitions (notably swissBUILDINGS3D/3DBAG).
      visible.push(n);
      return true;
    }
    visible.push(...descendants);
    return false;
  }

  private want(n: Node, tier: number, stack: Node[]) {
    this.rank(n);
    const put = (x: Node, t: number) => {
      const w = this.wants.get(x.id);
      if (!w || w.tier > t) {
        this.rank(x);
        const candidate = { node: x, tier: t };
        if (w) {
          this.wants.set(x.id, candidate);
        } else if (this.wants.size < MAX_WANTS) {
          this.wants.set(x.id, candidate);
        } else {
          let worstId = -1;
          let worstKey = -Infinity;
          for (const [id, current] of this.wants) {
            const key = this.key(current);
            if (key > worstKey) { worstKey = key; worstId = id; }
          }
          if (this.key(candidate) < worstKey) {
            this.wants.delete(worstId);
            this.wants.set(x.id, candidate);
          }
        }
      }
    };
    put(n, tier);
    if (tier === 0) {
      // nothing covers this area yet: a coarse ancestor (error up to 16 × target) is fetched first as a cover
      const cover = stack.find((a) => a.uris.length > 0 && a.state !== 3 && a.err <= this.errorTarget(a) * 16);
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
    if (!n.uris.length) return;
    n.state = 1;
    const id = this.jobId++;
    const job: Job = { node: n, id, since: performance.now(), unwanted: 0 };
    this.inflight.set(id, job);
    if (!this.broken) {
      const task = tileWorkerPool.load(n.uris, n.tf.toArray(), this.maxTexture, this.upAxis);
      job.cancelWorker = task.cancel;
      void task.promise.then((data) => this.finish(job.id, data)).catch((error: Error) => {
        if (!this.inflight.has(job.id)) return;
        if (error.name === 'AbortError') this.fail(job.id, error.message, true);
        else if (/Worker unavailable|document|ImageBitmap|createImageBitmap/i.test(error.message)) {
          this.broken = /Worker unavailable/.test(error.message);
          void this.runOnMain(job);
        } else this.fail(job.id, error.message, false);
      });
    } else void this.runOnMain(job);
  }

  private cancel(job: Job) {
    this.inflight.delete(job.id);
    job.node.state = 0;
    job.cancelWorker?.();
  }

  private async runOnMain(job: Job) {
    try {
      const results = await Promise.allSettled(job.node.uris.map(async (uri) => {
        const res = await fetch(uri);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return (await parseTile(await res.arrayBuffer(), job.node.tf.toArray(), this.maxTexture, this.upAxis)).data;
      }));
      const data = results.filter((r): r is PromiseFulfilledResult<TileData> => r.status === 'fulfilled').map((r) => r.value);
      const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
      if (failed) {
        for (const content of data) this.closeContent(content);
        throw failed.reason;
      }
      this.finish(job.id, data);
    } catch (e) {
      this.fail(job.id, String((e as Error).message ?? e), false);
    }
  }

  private finish(id: number, data: TileData[]) {
    const job = this.inflight.get(id);
    if (!job) {
      for (const content of data) this.closeContent(content);
      return;
    }
    this.inflight.delete(id);
    const group = new THREE.Group();
    group.matrixAutoUpdate = false;
    group.matrix.copy(job.node.tf);
    group.visible = false;
    const centre = new THREE.Vector3();
    let count = 0;
    let low: THREE.Vector3 | null = null;
    let lowHeight = Infinity;
    let bytes = 0;
    for (const content of data) {
      centre.add(new THREE.Vector3(...content.centre));
      count++;
      const candidate = new THREE.Vector3(...content.low);
      if (candidate.length() < lowHeight) { lowHeight = candidate.length(); low = candidate; }
      bytes += content.bytes;
    }
    if (count) centre.divideScalar(count);
    this.ready.push({ node: job.node, contents: data, group, content: 0, mesh: 0, bytes, centre, low, lowHeight, uploadsPending: 0 });
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
    let idle = 0;
    while (this.ready.length && n < BUILD_MAX && idle < this.ready.length && performance.now() - t0 < BUILD_BUDGET_MS) {
      if (this.disposed) return;
      const task = this.ready[0];
      const content = task.contents[task.content];
      if (!content) {
        if (task.uploadsPending) {
          this.ready.push(this.ready.shift()!);
          idle++;
          continue;
        }
        this.ready.shift();
        const { node } = task;
        node.group = task.group;
        node.state = 2;
        node.bytes = task.bytes;
        node.low = task.low ? { centre: task.centre, point: task.low } : null;
        this.bytesLoaded += task.bytes;
        globalTileBytes += task.bytes;
        this.loaded.add(node);
        this.group.add(task.group);
        this.stats.built++;
        idle = 0;
        continue;
      }
      const meshData = content.meshes[task.mesh];
      if (!meshData) { task.content++; task.mesh = 0; idle = 0; continue; }
      const m0 = performance.now();
      task.group.add(this.makeMesh(meshData, task.node.depth, task));
      const took = performance.now() - m0;
      this.stats.buildMs += took;
      this.stats.maxBuildMs = Math.max(this.stats.maxBuildMs, took);
      task.mesh++;
      if (task.mesh >= content.meshes.length) { task.content++; task.mesh = 0; }
      n++;
      idle = 0;
    }
    if (this.ready.length) this.hooks.repaint(); // more to build next frame
  }

  private uploadTexture() {
    const pending = this.pendingUploads.shift();
    if (!pending) return;
    try { this.hooks.upload?.(pending.texture); } finally { pending.task.uploadsPending = Math.max(0, pending.task.uploadsPending - 1); }
  }

  private makeMesh(m: TileData['meshes'][number], depth: number, task: BuildTask): THREE.Mesh {
    const o = this.opacity / 100;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(m.position, 3));
    if (m.normal) geo.setAttribute('normal', new THREE.BufferAttribute(m.normal, 3));
    if (m.uv) geo.setAttribute('uv', new THREE.BufferAttribute(m.uv, 2));
    if (m.index) geo.setIndex(new THREE.BufferAttribute(m.index, 1));
    const mats = m.materials.map((source) => {
      const maps = Object.fromEntries(source.maps.map((entry) => {
        const texture = new THREE.Texture(entry.image);
        texture.flipY = false;
        texture.colorSpace = entry.srgb ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
        texture.wrapS = entry.wrapS as THREE.Wrapping;
        texture.wrapT = entry.wrapT as THREE.Wrapping;
        texture.magFilter = entry.magFilter as THREE.MagnificationTextureFilter;
        texture.minFilter = entry.minFilter as THREE.MinificationTextureFilter;
        texture.anisotropy = Math.min(8, this.maxAnisotropy);
        texture.needsUpdate = true;
        if (this.hooks.upload) {
          task.uploadsPending++;
          this.pendingUploads.push({ texture, task });
        }
        return [entry.slot, texture];
      })) as Record<string, THREE.Texture>;
      const base = {
        ...maps,
        color: new THREE.Color().setRGB(...source.color),
        side: source.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
        transparent: o < 1 || source.transparent,
        opacity: source.opacity * o,
        alphaTest: source.alphaTest,
      };
      const material = source.unlit ? new THREE.MeshBasicMaterial(base) : new THREE.MeshStandardMaterial({
        ...base,
        emissive: new THREE.Color().setRGB(...source.emissive),
        emissiveIntensity: source.emissiveIntensity,
        metalness: source.metalness,
        roughness: source.roughness,
      });
      material.userData.sourceOpacity = source.opacity;
      material.userData.sourceTransparent = source.transparent;
      return material;
    });
    if (!mats.length) mats.push(new THREE.MeshBasicMaterial({ color: 0xffffff }));
    for (const group of m.groups) geo.addGroup(group.start, group.count, Math.min(group.materialIndex, mats.length - 1));
    if (!m.groups.length && mats.length > 1) geo.addGroup(0, m.index?.length ?? m.position.length / 3, 0);
    const mat = mats.length > 1 ? mats : mats[0];
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    for (const material of mats) {
      material.polygonOffset = true;
      material.polygonOffsetFactor = -depth * 0.5;
      material.polygonOffsetUnits = -depth;
    }
    return mesh;
  }

  private closeContent(data: TileData) {
    for (const mesh of data.meshes) for (const material of mesh.materials) for (const map of material.maps) map.image.close();
  }

  // ---- memory ------------------------------------------------------------------------------------------------

  private evict() {
    if (this.bytesLoaded <= this.budget && globalTileBytes <= GLOBAL_TILE_BUDGET) return;
    const old = [...this.loaded].filter((n) => !this.drawn.has(n) && n.lastSeen < this.frame - 5).sort((a, b) => a.lastSeen - b.lastSeen);
    for (const n of old) {
      if (this.bytesLoaded <= this.budget * 0.8 && globalTileBytes <= GLOBAL_TILE_BUDGET * 0.9) break;
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
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        const m = material as THREE.MeshStandardMaterial;
        for (const slot of ['map', 'normalMap', 'emissiveMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'alphaMap'] as const) {
          const texture = m[slot];
          if (!texture) continue;
          texture.dispose();
          if (typeof ImageBitmap !== 'undefined' && texture.image instanceof ImageBitmap) texture.image.close();
        }
        material.dispose();
      }
    });
    this.bytesLoaded -= n.bytes;
    globalTileBytes = Math.max(0, globalTileBytes - n.bytes);
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
    const signature = [...this.drawn].map((n) => n.id).sort((a, b) => a - b).join(',');
    const up = c.clone().normalize();
    const cached = this.groundCache;
    if (cached && cached.signature === signature && Math.hypot(c.x - cached.x, c.y - cached.y, c.z - cached.z) < 4) {
      return cached.height === null ? null : c.clone().addScaledVector(up, cached.height);
    }
    const remember = (point: THREE.Vector3 | null) => {
      this.groundCache = { x: c.x, y: c.y, z: c.z, signature, height: point ? point.clone().sub(c).dot(up) : null };
      return point;
    };
    let best: Node | null = null;
    for (const n of this.drawn) {
      if (!n.group || n.bv.distanceToPoint(c) > 50) continue;
      if (!best || n.depth > best.depth) best = n;
    }
    if (!best?.group) return remember(this.nearestLow(c));
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
      if (hmin !== Infinity) return remember(c.clone().addScaledVector(up, hmin));
    }
    return remember(this.nearestLow(c));
  }

  setOpacity(percent: number) {
    this.opacity = percent;
    const o = percent / 100;
    for (const n of this.loaded) {
      n.group?.traverse((m) => {
        const material = (m as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        for (const mat of Array.isArray(material) ? material : material ? [material] : []) {
          mat.transparent = o < 1 || Boolean(mat.userData.sourceTransparent);
          mat.opacity = Number(mat.userData.sourceOpacity ?? 1) * o;
          mat.needsUpdate = true;
        }
      });
    }
  }

  dispose() {
    this.disposed = true;
    for (const job of [...this.inflight.values()]) this.cancel(job);
    for (const n of [...this.loaded]) this.unload(n);
    for (const task of this.ready) {
      task.group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          const m = material as THREE.MeshStandardMaterial;
          for (const slot of ['map', 'normalMap', 'emissiveMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'alphaMap'] as const) {
            const texture = m[slot];
            texture?.dispose();
            if (texture && typeof ImageBitmap !== 'undefined' && texture.image instanceof ImageBitmap) texture.image.close();
          }
          material.dispose();
        }
      });
      for (const content of task.contents) this.closeContent(content);
    }
    for (const pending of this.pendingUploads) pending.texture.dispose();
    this.pendingUploads = [];
    this.ready = [];
    this.groundCache = null;
  }
}

const TMP4 = new THREE.Vector4();
