import * as THREE from 'three';
import { WGS84_ELLIPSOID } from '3d-tiles-renderer';
import { TileBoundingVolume } from '3d-tiles-renderer/src/three/renderer/math/TileBoundingVolume.js';
import { ExtendedFrustum } from '3d-tiles-renderer/src/three/renderer/math/ExtendedFrustum.js';
import { parseTile, type TileData } from './parseTile';
import { available as impAvailable, childAvailable as impChild, coordsOfMorton, fetchSubtree, hasContent as impContent, levelTileCount, morton, parseScheme, useTemplate, type ImplicitScheme, type SubtreeBits } from './implicit';
import type { WorkerIn, WorkerOut } from './tileWorker';

// Tile engine v2 for OGC 3D Tiles (REPLACE refinement; what the photo meshes and city models use).
// Implicit tiling (3D Tiles 1.1, quadtree on a region root) is also covered: the chunks of subtree
// availability files become real tiles on demand (`./implicit.ts`).
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
  /** radius of the bounding volume around `centre` (m) */
  radius: number;
  tf: THREE.Matrix4;
  uri: string | null;
  external: boolean;
  expanded: boolean;
  jsonLoading: boolean;
  /** implicit tiles: their coordinates in the tileset's implicit tree; only chunk roots expand */
  imp?: { level: number; x: number; y: number };
  /** whether an implicit chunk root's own chunk is already materialised */
  impDone?: boolean;
  state: State;
  /** failed attempts and the time (ms) before which the next one must not start */
  tries: number;
  retryAt: number;
  group: THREE.Group | null;
  bytes: number;
  lastSeen: number;
  low: { centre: THREE.Vector3; point: THREE.Vector3 } | null;
  // per frame
  err: number;
  ndc: number;
  dist: number;
  /** next child index to resume when a frame traversal is capped */
  visitCursor: number;
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
// National tilesets can expose hundreds of thousands of leaf tiles at a modest zoom.
// Bound frame traversal and candidate work instead of enumerating and sorting the whole visible tree.
const MAX_VISITS_PER_FRAME = 2500;
const MAX_WANTS = 256;
const BUILD_BUDGET_MS = 4;
const BUILD_MAX = 4;
const KEEP_MS = 1500;
const MAX_TRIES = 3;
/** metres a region bounding volume is made taller by, up and down */
const REGION_PAD = 150;
/** how many levels below a wanted tile that is not there yet may stand in for it */
const STAND_IN_LEVELS = 3;
const RETRY_MS = 2000;
const SCHEDULE_MS = 100;
const WORKERS = Math.max(2, Math.min(4, (navigator.hardwareConcurrency ?? 4) - 1));

/** three's GLTFLoader decodes pictures with a TextureLoader (needs a document) in Safari and old Firefox: no use in a worker */
const WORKER_DECODE = (() => {
  const ua = navigator.userAgent;
  const safari = /safari/i.test(ua) && !/chrome|chromium|android|crios|fxios|edg/i.test(ua);
  const firefox = /firefox\/(\d+)/i.exec(ua);
  return !safari && !(firefox && +firefox[1] < 98);
})();

// One worker pool and one memory budget for all engines: several sources shown together must not each bring their own.
const pool = { workers: [] as Worker[], load: [] as number[], refs: 0, broken: false, owners: new Map<number, TileEngine>() };
let jobCounter = 1;
let totalBytes = 0;
const BUDGET = Math.min(2.5e9, Math.max(0.6e9, ((navigator as { deviceMemory?: number }).deviceMemory ?? 4) * 0.25e9));

function acquirePool() {
  if (pool.refs++ > 0) return;
  pool.broken = !WORKER_DECODE;
  if (pool.broken) return;
  try {
    for (let i = 0; i < WORKERS; i++) {
      const w = new Worker(new URL('./tileWorker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e: MessageEvent<WorkerOut>) => pool.owners.get(e.data.id)?.onWorker(e.data);
      w.onerror = () => {
        if (pool.broken) return;
        pool.broken = true;
        for (const o of new Set(pool.owners.values())) o.workerFailed();
      };
      pool.workers.push(w);
      pool.load.push(0);
    }
  } catch {
    pool.broken = true;
  }
}

function releasePool() {
  if (--pool.refs > 0) return;
  for (const w of pool.workers) w.terminate();
  pool.workers = [];
  pool.load = [];
  pool.owners.clear();
}

const dirOf = (u: string) => u.slice(0, u.lastIndexOf('/') + 1);

export class TileEngine {
  readonly group = new THREE.Group();
  /** raw root tile (bounding volume and transform), for the outline */
  /** the tileset's glTF content is already z-up (`asset.gltfUpAxis`) */
  zUp = false;
  /** the tileset has untextured 'floor' meshes (SKYLINE_o3dml_Floor) that are no part of the picture: a grey plane around the photos */
  private skipFloor = false;
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
  private ready: { node: Node; data: TileData; group: THREE.Group; meshIndex: number }[] = [];
  private cam = new THREE.Vector3();
  /** the camera's viewing direction and half the vertical field of view, in the tiles' frame (for the loading order) */
  private fwd = new THREE.Vector3(0, 0, -1);
  private halfFov = 0.5;
  private frustum = new ExtendedFrustum();
  private viewProj = new THREE.Matrix4();
  private denom = 1;
  private wants = new Map<number, Want>();
  private visitsThisFrame = 0;
  private disposed = false;
  private bytesLoaded = 0;
  private p!: EngineParams;
  /** implicit tiling (3D Tiles 1.1) of the tileset, if it is the kind that defines its whole tree implicitly */
  private scheme: ImplicitScheme | null = null;
  /** the implicit root's region (radians): the bounding volumes of the tiles derive from it */
  private impRegion: number[] | null = null;
  /** subtree files by URL; they are small, and more than one tile of a chunk shares the request */
  private subtreeCache = new Map<string, Promise<SubtreeBits | null>>();

  constructor(
    private url: string,
    private hooks: { repaint(): void; note(msg: string): void; /** uploads a texture to the GPU now (the layer's renderer) */ upload?(t: THREE.Texture): void },
  ) {
    this.group.matrixAutoUpdate = false;
    acquirePool();
    void this.loadRoot();
  }

  // ---- tileset -------------------------------------------------------------------------------------------

  private async loadRoot() {
    try {
      const json = await (await fetch(this.url)).json();
      this.skipFloor = ((json.extensionsUsed ?? []) as string[]).some((x) => /floor/i.test(x));
      this.zUp = String(json.asset?.gltfUpAxis ?? 'Y').toUpperCase() === 'Z';
      this.root = { boundingVolume: json.root?.boundingVolume, transform: json.root?.transform };
      this.top = this.makeNode(json.root, dirOf(this.url), null, new THREE.Matrix4(), 0);
      if (json.root?.implicitTiling) {
        this.scheme = parseScheme(json.root, dirOf(this.url));
        if (this.scheme) this.impRegion = json.root.boundingVolume.region as number[];
        else this.hooks.note('Implizites Tiling nicht lesbar (kein Quadtree auf Region)');
      }
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
    if (b.region) {
      // the declared heights are often off by tens of metres (orthometric against ellipsoidal, a roof above the tile's
      // top): the content then lies outside its own box and the tile is culled while it is in view
      const r = b.region as [number, number, number, number, number, number];
      bv.setRegionData(WGS84_ELLIPSOID, r[0], r[1], r[2], r[3], r[4] - REGION_PAD, r[5] + REGION_PAD);
    }
    else if (b.box) bv.setObbData(b.box, tf);
    else if (b.sphere) bv.setSphereData(b.sphere[0], b.sphere[1], b.sphere[2], b.sphere[3], tf);
    else if (parent) {
      bv.sphere = parent.bv.sphere;
      bv.obb = parent.bv.obb;
      bv.regionObb = parent.bv.regionObb;
    }
    const centre = new THREE.Vector3();
    let radius = 0;
    if (bv.sphere) {
      centre.copy(bv.sphere.center);
      radius = bv.sphere.radius;
    } else {
      const o = bv.obb ?? bv.regionObb;
      if (o) {
        o.box.getCenter(centre).applyMatrix4(o.transform);
        radius = o.box.getSize(new THREE.Vector3()).length() / 2;
      }
    }
    const content = raw.content ?? raw.contents?.[0];
    const imp = !!raw.implicitTiling;
    const rawUri: string | undefined = imp ? undefined : content?.uri ?? content?.url; // implicit roots park their template; the chunks decide the content
    const uri = rawUri ? new URL(rawUri, base).href : null;
    const refine = String(raw.refine ?? (parent ? (parent.add ? 'ADD' : 'REPLACE') : 'REPLACE')).toUpperCase();
    const node: Node = {
      id: this.nextId++, parent, children: [], depth, ge: raw.geometricError ?? 0, add: refine === 'ADD', bv, centre, radius, tf, uri,
      external: !!uri && /\.json($|\?)/.test(uri.split('#')[0]), expanded: false, jsonLoading: false, state: 0, tries: 0, retryAt: 0, group: null, bytes: 0, lastSeen: 0, low: null, err: 0, ndc: 0, dist: 0, visitCursor: 0,
    };
    if (imp) {
      node.imp = { level: 0, x: 0, y: 0 };
      node.impDone = false;
    }
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
      this.giveUp(n, 'Unter-Tileset nicht ladbar');
    } finally {
      this.jsonInflight--;
      n.jsonLoading = false;
    }
  }

  // ---- implicit tiling (3D Tiles 1.1) ----------------------------------------------------------------------

  /** the availability of one chunk, cached by its URL (subtree files are tiny and may be asked for twice) */
  private impSubtree(imp: { level: number; x: number; y: number }): Promise<SubtreeBits | null> {
    const s = this.scheme!;
    const url = useTemplate(s.subtreeUri, imp);
    let p = this.subtreeCache.get(url);
    if (!p) {
      p = fetchSubtree(url).catch(() => null);
      this.subtreeCache.set(url, p);
    }
    return p;
  }

  /** one implicit tile below `parent`: region subdivision of the root's region, error from the root's error */
  private impTile(parent: Node, level: number, x: number, y: number, uri: string | null): Node {
    const s = this.scheme!;
    const reg = this.impRegion!;
    const size = 2 ** level;
    const raw = { // eslint-disable-line @typescript-eslint/no-explicit-any
      geometricError: s.rootGe / size,
      boundingVolume: { region: [reg[0] + (reg[2] - reg[0]) * x / size, reg[1] + (reg[3] - reg[1]) * y / size, reg[0] + (reg[2] - reg[0]) * (x + 1) / size, reg[1] + (reg[3] - reg[1]) * (y + 1) / size, reg[4], reg[5]] },
      content: uri ? { uri } : undefined,
    };
    const node = this.makeNode(raw, dirOf(this.url), parent, parent.tf, parent.depth + 1);
    parent.children.push(node); // makeNode only expands the raw children; here the tree is derived
    return node;
  }

  /** materialises an implicit chunk: its subtree's bits become real tiles; the chunk roots below stay pending */
  private async expandImplicit(n: Node) {
    const s = this.scheme!;
    const imp = n.imp!;
    n.jsonLoading = true;
    this.jsonInflight++;
    try {
      const bits = await this.impSubtree(imp);
      if (!bits) throw new Error('Subtree nicht ladbar');
      if (this.disposed) return;
      // the chunk root's own content comes from the bits of its relative level 0
      if (impContent(bits, 0, 0) && s.contentUri) n.uri = useTemplate(s.contentUri, imp);
      // the tiles of the levels below the chunk root; children without parents are ignored (sparse bits)
      let level: { lx: number; ly: number; node: Node }[] = [{ lx: 0, ly: 0, node: n }];
      for (let r = 1; r < s.subtreeLevels; r++) {
        const next: typeof level = [];
        for (let m = 0; m < levelTileCount(r); m++) {
          if (!impAvailable(bits, r, m)) continue;
          const [lx, ly] = coordsOfMorton(r, m);
          // the parent is the tile with the last bit pair dropped (quadtree)
          const p = level.find((e) => e.lx === lx >> 1 && e.ly === ly >> 1);
          if (!p) continue;
          const node = this.impTile(p.node, imp.level + r, imp.x * 2 ** r + lx, imp.y * 2 ** r + ly, impContent(bits, r, m) && s.contentUri ? useTemplate(s.contentUri, { level: imp.level + r, x: imp.x * 2 ** r + lx, y: imp.y * 2 ** r + ly }) : null);
          next.push({ lx, ly, node });
        }
        level = next;
      }
      // the deepest chunk level's tiles own the next chunk's roots, as child bits say
      if (s.subtreeLevels > 1) {
        for (const { lx, ly, node } of level) {
          for (let d = 0; d < 4; d++) {
            const clx = (lx << 1) + (d & 1);
            const cly = (ly << 1) + (d >> 1);
            if (!impChild(bits, morton(clx, cly))) continue;
            const child = this.impTile(node, imp.level + s.subtreeLevels, imp.x * 2 ** s.subtreeLevels + clx, imp.y * 2 ** s.subtreeLevels + cly, null);
            child.imp = { level: imp.level + s.subtreeLevels, x: imp.x * 2 ** s.subtreeLevels + clx, y: imp.y * 2 ** s.subtreeLevels + cly };
            child.impDone = false;
          }
        }
      }
      n.impDone = true;
      this.hooks.repaint();
    } catch (e) {
      this.giveUp(n, `Implizite Kacheln: ${(e as Error).message}`);
    } finally {
      n.jsonLoading = false;
      this.jsonInflight--;
    }
  }

  /** a failed load: tried again (with a growing pause) a few times before the tile is given up for good */
  private giveUp(n: Node, error: string) {
    n.tries++;
    // a missing tile will not appear by asking again
    if (n.tries < MAX_TRIES && !/HTTP (404|403|410)/.test(error)) {
      n.state = 0;
      n.retryAt = performance.now() + RETRY_MS * 2 ** (n.tries - 1);
      setTimeout(() => !this.disposed && this.hooks.repaint(), RETRY_MS * 2 ** (n.tries - 1) + 50);
      return;
    }
    n.state = 3;
    this.stats.failed++;
    this.hooks.note(`Kachel: ${error}`);
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
    const v = lod.matrixWorldInverse.elements;
    this.fwd.set(-v[2], -v[6], -v[10]).transformDirection(new THREE.Matrix4().copy(g).invert());
    this.halfFov = Math.atan(1 / lod.projectionMatrix.elements[5]);
    this.denom = 2 / lod.projectionMatrix.elements[5] / size.height;

    this.build();
    if (!this.top) return;
    this.wants.clear();
    this.drawn.clear();
    this.visitsThisFrame = 0;
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
    if (this.visitsThisFrame >= MAX_VISITS_PER_FRAME) {
      // Keep a loaded coarse tile visible while its descendants wait for a later frame.
      if (n.uri && !n.external && n.state === 2) {
        this.drawn.add(n);
        return true;
      }
      return false;
    }
    this.visitsThisFrame++;
    if (!n.bv.intersectsFrustum(this.frustum)) return true; // out of view: nothing to cover
    n.lastSeen = this.frame;
    const dist = n.bv.distanceToPoint(this.cam);
    n.err = this.errorOf(n, dist);
    const hasContent = !!n.uri && !n.external;
    const pending = ((n.external && !n.expanded) || (!!n.imp && n.impDone === false)) && n.state !== 3;
    const waiting = n.retryAt > performance.now();
    // A node that only points to another tileset has no content of its own. With REPLACE it stands where its parent
    // would be replaced, so it is expanded as soon as it is reached (the parent's content stands in meanwhile; if
    // it is skipped for its small error, the parent is not replaced and draws nothing, a hole). With ADD it obeys
    // the error criterion: otherwise the whole tree of an external tileset (a world-wide quadtree of them) is
    // walked and fetched.
    const refine = (n.children.length > 0 || pending) && (n.err > this.p.errorTarget || (!hasContent && (!n.external || !n.add)));

    if (!refine) {
      if (!hasContent) return true;
      if (n.state === 2) {
        this.drawn.add(n);
        return true;
      }
      if (n.state !== 3) this.want(n, loadedAncestor ? 1 : 0, stack);
      // zooming out: what is loaded below the wanted tile stands in until it is there
      return n.children.length > 0 && this.drawBelow(n, STAND_IN_LEVELS);
    }
    if (pending) {
      // implicit chunk roots obey the error criterion (they are ADD): a coarse parent's content is enough, so
      // the engine does not walk every chunk of the world; the tileset root is always fine enough to open
      if (this.jsonInflight < MAX_JSON && !waiting && (!n.imp || n.err > this.p.errorTarget)) void (n.external ? this.expand(n) : this.expandImplicit(n));
      return false;
    }
    // ADD: the content of a tile is drawn together with that of its children, so it is needed as well
    if (n.add && hasContent && n.state === 0 && n.retryAt <= performance.now()) this.want(n, loadedAncestor ? 1 : 0, stack);
    const covered = hasContent && n.state === 2;
    const anc = loadedAncestor || covered;
    let all = true;
    stack.push(n);
    const childCount = n.children.length;
    const start = childCount ? n.visitCursor % childCount : 0;
    let visitedChildren = 0;
    for (let offset = 0; offset < childCount && this.visitsThisFrame < MAX_VISITS_PER_FRAME; offset++) {
      const c = n.children[(start + offset) % childCount];
      visitedChildren++;
      if (!this.visit(c, anc, stack)) all = false;
    }
    if (childCount) n.visitCursor = (start + Math.max(1, visitedChildren)) % childCount;
    if (visitedChildren < childCount) all = false;
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

  /** Draws the loaded tiles below `n` (up to `levels` down) in its place; returns whether they cover its whole area. */
  private drawBelow(n: Node, levels: number): boolean {
    let all = true;
    const childCount = n.children.length;
    const start = childCount ? n.visitCursor % childCount : 0;
    let visitedChildren = 0;
    for (let offset = 0; offset < childCount && this.visitsThisFrame < MAX_VISITS_PER_FRAME; offset++) {
      const c = n.children[(start + offset) % childCount];
      visitedChildren++;
      this.visitsThisFrame++;
      if (!c.bv.intersectsFrustum(this.frustum)) continue;
      c.lastSeen = this.frame;
      if (c.state === 2) this.drawn.add(c);
      else if (!c.uri && !c.children.length) continue; // empty: nothing to cover
      else if (levels > 1 && c.children.length && this.drawBelow(c, levels - 1)) continue;
      else all = false;
    }
    if (childCount) n.visitCursor = (start + Math.max(1, visitedChildren)) % childCount;
    if (visitedChildren < childCount) all = false;
    return all;
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
      const cover = stack.find((a) => a.uri && !a.external && a.state !== 3 && a.err <= this.p.errorTarget * 16);
      if (cover && cover !== n) put(cover, 0);
    }
  }

  /**
   * Loading order: first the distance (the nearer the sooner), then the angle between the viewing direction and
   * the tile (the nearest edge of its bounding sphere, so a tile the view axis passes through counts as 0 however
   * large it is), in half fields of view; see `key`.
   */
  private rank(n: Node) {
    const dx = n.centre.x - this.cam.x, dy = n.centre.y - this.cam.y, dz = n.centre.z - this.cam.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist <= n.radius) {
      n.ndc = 0; // the camera is inside
      n.dist = dist;
      return;
    }
    const ang = Math.acos(Math.min(1, Math.max(-1, (dx * this.fwd.x + dy * this.fwd.y + dz * this.fwd.z) / dist)));
    n.ndc = Math.max(0, ang - Math.asin(n.radius / dist)) / this.halfFov;
    n.dist = dist;
  }

  // ---- requests --------------------------------------------------------------------------------------------

  private key(w: Want) {
    // near first: ten times the distance costs ~400, the whole way from the view axis to the screen edge only ~150,
    // so what is right in front of the lens (a steep view) beats the middle of a far-away picture
    const n = w.node;
    return w.tier * 1e6 + Math.log2(1 + Math.max(0, n.dist - n.radius)) * 120 + n.ndc * 150 + n.depth;
  }

  private lastSchedule = 0;

  private schedule() {
    const now = performance.now();
    if (now - this.lastSchedule < SCHEDULE_MS) return;
    this.lastSchedule = now;
    const list = [...this.wants.values()].sort((a, b) => this.key(a) - this.key(b));
    const wantedIds = new Set(list.map((w) => w.node.id));
    // drop what is no longer needed (after a grace period, so a wobbling camera does not cancel everything)
    for (const job of this.inflight.values()) {
      if (wantedIds.has(job.node.id)) job.unwanted = 0;
      else if (!job.unwanted) job.unwanted = now;
      else if (now - job.unwanted > KEEP_MS) this.cancel(job);
    }
    let worst: Job | null = null;
    let worstKey = -1;
    for (const w of list) {
      if (w.node.state !== 0 || w.node.retryAt > now) continue;
      if (this.inflight.size >= MAX_INFLIGHT) {
        // full: the worst job gives way to a better candidate
        if (!worst) {
          worstKey = -1;
          for (const j of this.inflight.values()) {
            const jw = this.wants.get(j.node.id);
            const k = jw ? this.key(jw) : Infinity;
            if (k > worstKey) {
              worstKey = k;
              worst = j;
            }
          }
        }
        if (worst && worstKey > this.key(w) + 500) {
          this.cancel(worst);
          worst = null;
        } else break;
      }
      this.start(w.node);
    }
  }

  private start(n: Node) {
    if (!n.uri) return;
    n.state = 1;
    const id = jobCounter++;
    let wi = 0;
    for (let i = 1; i < pool.load.length; i++) if (pool.load[i] < pool.load[wi]) wi = i;
    const job: Job = { node: n, id, worker: wi, since: performance.now(), unwanted: 0 };
    this.inflight.set(id, job);
    if (!pool.broken && pool.workers.length) {
      pool.load[wi]++;
      pool.owners.set(id, this);
      pool.workers[wi].postMessage({ type: 'load', id, url: n.uri, transform: n.tf.toArray(), zUp: this.zUp } satisfies WorkerIn);
    } else void this.runOnMain(job);
  }

  private cancel(job: Job) {
    this.inflight.delete(job.id);
    job.node.state = 0;
    if (pool.owners.delete(job.id) && pool.workers[job.worker]) {
      pool.load[job.worker] = Math.max(0, pool.load[job.worker] - 1);
      pool.workers[job.worker].postMessage({ type: 'cancel', id: job.id } satisfies WorkerIn);
    }
  }

  private async runOnMain(job: Job) {
    try {
      const res = await fetch(job.node.uri!);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { data } = await parseTile(await res.arrayBuffer(), job.node.tf.toArray(), undefined, this.zUp);
      this.finish(job.id, data);
    } catch (e) {
      this.fail(job.id, String((e as Error).message ?? e), false);
    }
  }

  onWorker(m: WorkerOut) {
    const job = this.inflight.get(m.id);
    pool.owners.delete(m.id);
    if (m.type === 'done') {
      if (job) pool.load[job.worker] = Math.max(0, pool.load[job.worker] - 1);
      this.finish(m.id, m.data);
    } else {
      if (job) pool.load[job.worker] = Math.max(0, pool.load[job.worker] - 1);
      // a tile the worker cannot decode here (no document, no ImageBitmap …) is done on the main thread
      if (/document|ImageBitmap|createImageBitmap/i.test(m.error) && job) {
        job.node.state = 1;
        void this.runOnMain(job);
        return;
      }
      this.fail(m.id, m.error, !!m.aborted);
    }
  }

  workerFailed() {
    for (const job of [...this.inflight.values()]) void this.runOnMain(job);
  }

  private finish(id: number, data: TileData) {
    const job = this.inflight.get(id);
    if (!job) return; // cancelled meanwhile
    this.inflight.delete(id);
    const group = new THREE.Group();
    group.matrixAutoUpdate = false;
    group.matrix.copy(job.node.tf).multiply(new THREE.Matrix4().fromArray(data.matrix));
    group.visible = false;
    this.ready.push({ node: job.node, data, group, meshIndex: 0 });
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
    this.giveUp(job.node, `${error} (${job.node.uri})`);
  }

  // ---- meshes ----------------------------------------------------------------------------------------------

  /** Builds meshes of finished tiles, within a time budget so that a burst of tiles does not stall a frame. */
  private build() {
    const t0 = performance.now();
    let n = 0;
    while (this.ready.length && n < BUILD_MAX && performance.now() - t0 < BUILD_BUDGET_MS) {
      const task = this.ready.shift()!;
      if (this.disposed) return;
      const m0 = performance.now();
      const complete = this.makeMesh(task);
      const took = performance.now() - m0;
      this.stats.buildMs += took;
      this.stats.maxBuildMs = Math.max(this.stats.maxBuildMs, took);
      n++;
      if (complete) {
        const { node, data, group } = task;
        node.group = group;
        node.state = 2;
        node.bytes = data.bytes;
        node.low = { centre: new THREE.Vector3(...data.centre), point: new THREE.Vector3(...data.low) };
        this.bytesLoaded += data.bytes;
        totalBytes += data.bytes;
        this.loaded.add(node);
        this.group.add(group);
        this.stats.built++;
      } else this.ready.push(task);
    }
    if (this.ready.length) this.hooks.repaint();
  }

  /** Add at most one mesh per work item so large content sets cannot monopolize one frame. */
  private makeMesh(task: { node: Node; data: TileData; group: THREE.Group; meshIndex: number }): boolean {
    const { node, data, group } = task;
    const m = data.meshes[task.meshIndex++];
    if (m && !(this.skipFloor && !m.image && !m.colors)) {
      const o = this.opacity / 100;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(m.position, 3));
      if (m.normal) geo.setAttribute('normal', new THREE.BufferAttribute(m.normal, 3));
      if (m.uv) geo.setAttribute('uv', new THREE.BufferAttribute(m.uv, 2));
      if (m.colors) geo.setAttribute('color', new THREE.BufferAttribute(m.colors, m.colorSize));
      if (m.index) geo.setIndex(new THREE.BufferAttribute(m.index, 1));
      if (!m.normal && !m.unlit) geo.computeVertexNormals();
      let map: THREE.Texture | null = null;
      if (m.image) {
        map = new THREE.Texture(m.image as unknown as HTMLImageElement);
        map.flipY = false;
        map.colorSpace = THREE.SRGBColorSpace;
        map.wrapS = map.wrapT = THREE.RepeatWrapping;
        map.needsUpdate = true;
        this.hooks.upload?.(map);
      }
      const base = { map, color: new THREE.Color().setRGB(m.color[0], m.color[1], m.color[2]), side: m.doubleSided ? THREE.DoubleSide : THREE.FrontSide, transparent: o < 1 || m.transparent, opacity: o, vertexColors: !!m.colors, alphaTest: m.alphaTest };
      const mat = m.unlit ? new THREE.MeshBasicMaterial(base) : new THREE.MeshStandardMaterial({ ...base, metalness: 0, roughness: 1 });
      mat.userData.blend = m.transparent;
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = -node.depth * 0.5;
      mat.polygonOffsetUnits = -node.depth;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      group.add(mesh);
    }
    return task.meshIndex >= data.meshes.length;
  }

  // ---- memory ------------------------------------------------------------------------------------------------

  private evict() {
    if (totalBytes <= BUDGET) return;
    const old = [...this.loaded].filter((n) => !this.drawn.has(n) && n.lastSeen < this.frame - 5).sort((a, b) => a.lastSeen - b.lastSeen);
    for (const n of old) {
      if (totalBytes <= BUDGET * 0.8) break;
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
      if (mat.map) {
        const image = mat.map.image;
        mat.map.dispose();
        if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) image.close();
      }
      mat.dispose();
    });
    this.bytesLoaded -= n.bytes;
    totalBytes -= n.bytes;
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
    // the layer asks every few hundred ms; a map that has hardly moved gets the last answer
    if (this.groundMemo && this.groundMemo.frame > this.frame - 120 && this.groundMemo.at.distanceToSquared(c) < 4) return this.groundMemo.out;
    const out = this.measureGround(c);
    this.groundMemo = { at: c.clone(), out, frame: this.frame };
    return out;
  }

  private groundMemo: { at: THREE.Vector3; out: THREE.Vector3 | null; frame: number } | null = null;

  private measureGround(c: THREE.Vector3): THREE.Vector3 | null {
    let best: Node | null = null;
    for (const n of this.drawn) {
      if (!n.group || n.bv.distanceToPoint(c) > 50) continue;
      if (!best || n.depth > best.depth) best = n;
    }
    if (!best?.group) return this.nearestLow(c);
    const up = c.clone().normalize();
    const e = best.group.matrix.elements;
    const meshes = best.group.children as THREE.Mesh[];
    // Not the single lowest vertex: that sinks by metres with every finer level of detail (gutters, cellars), and
    // the layer would rise and fall while one zooms. The lowest vertex of every 4 m cell is taken, and of those
    // a low percentile, which a finer mesh hardly changes.
    const t = new THREE.Vector3(0, 0, 1).cross(up);
    if (t.lengthSq() < 1e-9) t.set(1, 0, 0);
    t.normalize();
    const b = up.clone().cross(t);
    for (const radius of [15, 60, 250, 1000]) {
      const r2 = radius * radius;
      const cells = new Map<number, number>();
      for (const mesh of meshes) {
        const a = mesh.geometry.getAttribute('position').array as Float32Array;
        // at most ~20000 vertices per mesh are looked at
        const stride = 3 * Math.max(1, Math.floor(a.length / 3 / 20000));
        for (let i = 0; i < a.length; i += stride) {
          const x = a[i], y = a[i + 1], z = a[i + 2];
          const dx = e[0] * x + e[4] * y + e[8] * z + e[12] - c.x;
          const dy = e[1] * x + e[5] * y + e[9] * z + e[13] - c.y;
          const dz = e[2] * x + e[6] * y + e[10] * z + e[14] - c.z;
          const h = dx * up.x + dy * up.y + dz * up.z;
          if (dx * dx + dy * dy + dz * dz - h * h >= r2) continue;
          const key = Math.round((dx * t.x + dy * t.y + dz * t.z) / 4) * 4096 + Math.round((dx * b.x + dy * b.y + dz * b.z) / 4);
          const old = cells.get(key);
          if (old === undefined || h < old) cells.set(key, h);
        }
      }
      if (cells.size) {
        const hs = Float32Array.from(cells.values()).sort();
        return c.clone().addScaledVector(up, hs[Math.floor((hs.length - 1) * 0.1)]);
      }
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
          mat.transparent = o < 1 || mat.userData.blend === true;
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
    releasePool();
    // A tile can be removed while its decoded image is waiting for the next build frame.
    // Close those bitmaps too; they have not been attached to a GPU texture yet.
    for (const { data } of this.ready) for (const mesh of data.meshes) if (mesh.image && typeof ImageBitmap !== 'undefined' && mesh.image instanceof ImageBitmap) mesh.image.close();
    this.ready = [];
  }
}

