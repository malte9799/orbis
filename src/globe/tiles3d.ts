import * as THREE from 'three';
import { MercatorCoordinate, type CustomLayerInterface, type Map as MlMap } from 'maplibre-gl';
import { TilesRenderer } from '3d-tiles-renderer';
import { CesiumIonAuthPlugin, GLTFExtensionsPlugin, GoogleCloudAuthPlugin } from '3d-tiles-renderer/plugins';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { TILES_SOURCES, type TilesSourceDef } from './tiles3dSources';
import { fixTile } from './gltf1';
import { TileEngine } from './tiles/engine';
import { plateauAt, type PlateauSet } from './plateau';

// OGC 3D Tiles (Google Photorealistic 3D Tiles or any tileset.json) as a MapLibre custom layer.
// Three coordinate frames meet here:
//  - ECEF (metres from the Earth's centre): what the tiles are stored in
//  - ENU (east/north/up metres around an anchor near the map centre): `tiles.group` is placed in it,
//    and the tile selection (level of detail, frustum) runs in it with a camera copied from the map
//  - MapLibre mercator, relative to the map centre (Float32 precision, see planes3d.ts): the scene
//    is only moved there for the draw call (`world`)

const A = 6378137;
const E2 = 0.00669437999014;
/**
 * the ENU frame is re-anchored when the map centre moved further than this (metres). The frame is flat, the Earth
 * is not: the ground sinks d²/2R below it (0.3 m at 2 km, 8 m at 10 km), which put whole cities under the map.
 */
const REANCHOR_M = 1500;
const RAD = Math.PI / 180;

const SEL_KEY = 'orbis.tiles3d.sel';
/** map source and layer of the coverage outline */
const OUTLINE = 'tiles3d-outline';
/** Google asks for its logo at the bottom left and the providers of the tiles in view at the right */
const GOOGLE_LOGO = 'https://www.gstatic.com/images/branding/googlelogo/svg/googlelogo_clr_74x24px.svg';

function loadSelected(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(SEL_KEY) ?? 'null');
    if (Array.isArray(v)) return v.filter((x) => typeof x === 'string');
  } catch {
    /* storage blocked */
  }
  return ['reearth'];
}

/** What the layer shows: the sources come from the debug bar at the bottom edge, keys and opacity from the settings. */
const state = { selected: loadSelected(), keys: {} as Record<string, string | undefined>, opacity: 100, outline: true };

/** Pushes the API keys, the opacity (percent) and the coverage outline switch of the Karte's layer settings to the layer on `map`. */
export function setTiles3dOptions(map: MlMap, keys: Record<string, string | undefined>, opacity: number, outline = true) {
  state.keys = keys;
  state.opacity = opacity;
  state.outline = outline;
  map.triggerRepaint();
}

/** Sets which sources are shown (the debug page; the bar does the same by its chips). */
export function setTiles3dSelection(map: MlMap, ids: string[]) {
  state.selected = ids;
  map.triggerRepaint();
}

/**
 * Debug bar along the bottom edge: one chip per tile source, to try them out one by one. A chip
 * switches its source on or off; switching on also flies to a place where it has data. It goes
 * away again once the sources are settled.
 */
function mountSourceBar(map: MlMap): HTMLDivElement {
  const bar = document.createElement('div');
  bar.style.cssText =
    'position:absolute;left:0;right:0;bottom:0;z-index:5;display:flex;gap:6px;padding:6px 8px;overflow-x:auto;white-space:nowrap;background:rgba(10,14,22,.82);backdrop-filter:blur(6px);scrollbar-width:thin';
  const chips = new Map<string, HTMLButtonElement>();
  const paint = () => {
    for (const [id, b] of chips) {
      const on = state.selected.includes(id);
      b.style.background = on ? '#3a6cf0' : 'rgba(255,255,255,.08)';
      b.style.color = on ? '#fff' : '#c9d1e0';
    }
  };
  for (const src of TILES_SOURCES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = src.label;
    b.title = src.hint + (src.key ? ' (Schlüssel in den Einstellungen)' : '');
    b.style.cssText = 'flex:none;border:0;border-radius:12px;padding:4px 10px;font:600 12px sans-serif;cursor:pointer';
    b.addEventListener('click', () => {
      const on = !state.selected.includes(src.id);
      state.selected = on ? [...state.selected, src.id] : state.selected.filter((x) => x !== src.id);
      try {
        localStorage.setItem(SEL_KEY, JSON.stringify(state.selected));
      } catch {
        /* storage blocked */
      }
      paint();
      if (on) {
        map.flyTo({ center: [src.at[0], src.at[1]], zoom: src.at[2], speed: 1.4, essential: true });
        // the app resets the pitch of a fly, so the tilt follows once it has arrived
        map.once('moveend', () => map.easeTo({ pitch: 60, duration: 600 }));
      }
      map.triggerRepaint();
    });
    chips.set(src.id, b);
    bar.appendChild(b);
  }
  paint();
  // clicks and wheel on the bar must not reach the map underneath
  for (const t of ['mousedown', 'wheel', 'touchstart', 'dblclick'] as const) bar.addEventListener(t, (e) => e.stopPropagation(), { passive: true });
  map.getContainer().appendChild(bar);
  return bar;
}

function ecef(lon: number, lat: number, h: number): THREE.Vector3 {
  const sl = Math.sin(lat * RAD);
  const n = A / Math.sqrt(1 - E2 * sl * sl);
  const cl = Math.cos(lat * RAD);
  return new THREE.Vector3((n + h) * cl * Math.cos(lon * RAD), (n + h) * cl * Math.sin(lon * RAD), (n * (1 - E2) + h) * sl);
}

/** east/north/up axes (in ECEF) at a position */
function enuAxes(lon: number, lat: number) {
  const sλ = Math.sin(lon * RAD),
    cλ = Math.cos(lon * RAD),
    sφ = Math.sin(lat * RAD),
    cφ = Math.cos(lat * RAD);
  return {
    e: new THREE.Vector3(-sλ, cλ, 0),
    n: new THREE.Vector3(-sφ * cλ, -sφ * sλ, cφ),
    u: new THREE.Vector3(cφ * cλ, cφ * sλ, sφ),
  };
}

interface Entry {
  /** the library's renderer (engine v1) … */
  tiles?: TilesRenderer;
  /** … or our own engine (v2, see tiles/engine.ts) */
  engine?: TileEngine;
  attribution: string;
  links?: TilesSourceDef['links'];
  logos?: TilesSourceDef['logos'];
  opacity: number;
  /** height of the ground above the ellipsoid (metres): the tiles are lowered by it, see groundHeight */
  ground: number;
  /** the map centre in the tiles' own frame (ECEF), for loading the tiles around it first */
  centre: THREE.Vector3;
  /** metres a tile level counts in the loading order (see `rank`): coarse levels first, near tiles first within one */
  depthWeight: number;
  /** what the group is actually lowered by: the ground minus the map terrain under the centre */
  offset: number;
  checked: number;
  /** the ground height of engine v2 was measured at least once */
  groundSet?: boolean;
  /** the offset was measured against the map's terrain at least once (see render) */
  terrainSet?: boolean;
  /** lowest point (metres above the ellipsoid) and centre of every loaded tile */
  lows: Map<unknown, { centre: THREE.Vector3; low: number }>;
}

/** geodetic position of an ECEF point: longitude and latitude in degrees, height in metres above the WGS84 ellipsoid */
function geodetic(x: number, y: number, z: number): [number, number, number] {
  const p = Math.hypot(x, y);
  let lat = Math.atan2(z, p * (1 - E2));
  let h = 0;
  for (let i = 0; i < 5; i++) {
    const n = A / Math.sqrt(1 - E2 * Math.sin(lat) ** 2);
    h = p / Math.cos(lat) - n;
    lat = Math.atan2(z, p * (1 - (E2 * n) / (n + h)));
  }
  return [(Math.atan2(y, x) * 180) / Math.PI, (lat * 180) / Math.PI, h];
}

const heightOf = (x: number, y: number, z: number) => geodetic(x, y, z)[2];

/** convex hull of 2D points (monotone chain), counter-clockwise, closed */
function hull(pts: [number, number][]): [number, number][] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const build = (list: [number, number][]) => {
    const out: [number, number][] = [];
    for (const q of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], q) <= 0) out.pop();
      out.push(q);
    }
    out.pop();
    return out;
  };
  const ring = [...build(p), ...build(p.reverse())];
  return [...ring, ring[0]];
}

/**
 * Outline of the area a tileset covers, as a closed ring of [lon, lat], from the bounding volume of
 * its root tile (region, oriented box or sphere; the root's transform applied).
 */
function footprint(tiles: TilesRenderer): [number, number][] | null {
  const root = tiles.root as unknown as { boundingVolume?: { region?: number[]; box?: number[]; sphere?: number[] }; transform?: number[] } | null;
  const bv = root?.boundingVolume;
  if (!bv) return null;
  const deg = 180 / Math.PI;
  if (bv.region) {
    const [w, s, e, n] = bv.region.map((v) => v * deg);
    return [[w, s], [e, s], [e, n], [w, n], [w, s]];
  }
  const T = root?.transform;
  const apply = (x: number, y: number, z: number): [number, number, number] => (T ? [T[0] * x + T[4] * y + T[8] * z + T[12], T[1] * x + T[5] * y + T[9] * z + T[13], T[2] * x + T[6] * y + T[10] * z + T[14]] : [x, y, z]);
  if (bv.box) {
    const b = bv.box;
    const pts: [number, number][] = [];
    for (const i of [-1, 1]) for (const j of [-1, 1]) for (const k of [-1, 1]) {
      const [x, y, z] = apply(b[0] + i * b[3] + j * b[6] + k * b[9], b[1] + i * b[4] + j * b[7] + k * b[10], b[2] + i * b[5] + j * b[8] + k * b[11]);
      const g = geodetic(x, y, z);
      pts.push([g[0], g[1]]);
    }
    return hull(pts);
  }
  if (bv.sphere) {
    const [cx, cy, cz, r] = bv.sphere;
    const [lon, lat] = geodetic(...apply(cx, cy, cz));
    const ring: [number, number][] = [];
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * 2 * Math.PI;
      ring.push([lon + (Math.cos(a) * r) / (111320 * Math.cos(lat / deg)), lat + (Math.sin(a) * r) / 110574]);
    }
    return ring;
  }
  return null;
}

/**
 * Tilesets with heights above the ellipsoid (Re:Earth, Cesium, Google) would float tens of metres
 * above MapLibre's flat ground (the geoid lies ~45 m above the ellipsoid in Germany, plus the terrain
 * height). The tiles themselves tell where the ground is: the lowest vertex of the loaded tile nearest
 * to the map centre is the ground there (building bases / terrain). Tilesets that start at 0
 * (basemap.de) give ~0. Returns the ECEF centre and the lowest height of a loaded tile.
 */
function lowestPoint(scene: THREE.Object3D, parent: THREE.Matrix4 | null): { centre: THREE.Vector3; low: number } | null {
  scene.updateMatrixWorld(true);
  const toGroup = parent ? parent.clone().invert() : new THREE.Matrix4();
  let sum = new THREE.Vector3();
  let n = 0;
  const v = new THREE.Vector3();
  const meshes: { m: THREE.Matrix4; pos: THREE.BufferAttribute }[] = [];
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    const pos = mesh.isMesh ? (mesh.geometry.getAttribute('position') as THREE.BufferAttribute | undefined) : undefined;
    if (pos) meshes.push({ m: toGroup.clone().multiply(mesh.matrixWorld), pos });
  });
  if (!meshes.length) return null;
  // centre: mean of a sample of the vertices (also fixes the local "up" for the cheap lowest-vertex search)
  for (const { m, pos } of meshes) {
    const step = Math.max(1, Math.floor(pos.count / 50));
    for (let i = 0; i < pos.count; i += step) {
      sum.add(v.fromBufferAttribute(pos, i).applyMatrix4(m));
      n++;
    }
  }
  const centre = sum.divideScalar(n);
  const up = centre.clone().normalize();
  let lowest = Infinity;
  const lowV = new THREE.Vector3();
  for (const { m, pos } of meshes) {
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      const h = v.dot(up);
      if (h < lowest) {
        lowest = h;
        lowV.copy(v);
      }
    }
  }
  return { centre, low: heightOf(lowV.x, lowV.y, lowV.z) };
}

function groundHeight(e: Entry, lon: number, lat: number): number | null {
  const c = ecef(lon, lat, 0);
  let best = Infinity;
  let ground: number | null = null;
  for (const tile of e.tiles!.activeTiles) {
    const l = e.lows.get(tile);
    if (!l) continue;
    const d = l.centre.distanceTo(c);
    if (d < best) {
      best = d;
      ground = l.low;
    }
  }
  return ground;
}

/**
 * Our own engine (v2) for sources without a key; the library's renderer (v1) for the rest (Google and Cesium
 * need their auth plugins) and as a switch back: localStorage 'orbis.tiles3d.engine' = 'v1'.
 */
function useV2(src: TilesSourceDef): boolean {
  try {
    return !src.key && !!src.url && localStorage.getItem('orbis.tiles3d.engine') !== 'v1';
  } catch {
    return false;
  }
}

export class Tiles3DLayer implements CustomLayerInterface {
  readonly id = 'tiles3d';
  readonly type = 'custom' as const;
  readonly renderingMode = '3d' as const;
  private map!: MlMap;
  private renderer?: THREE.WebGLRenderer;
  private entries = new Map<string, Entry>();
  private scene = new THREE.Scene();
  private world = new THREE.Group();
  /** copy of the map camera in ENU metres (tile selection only) */
  private lod = new THREE.PerspectiveCamera(36.87, 1, 1, 1e7);
  private camera = new THREE.Camera();
  private proj = new THREE.Matrix4();
  private anchor: { lon: number; lat: number; mc: MercatorCoordinate } | null = null;
  private attribution?: HTMLDivElement;
  private attributionRight?: HTMLDivElement;
  private attributionKey = '';
  private outlineKey = '';
  private outlineAt = 0;
  private attributionAt = 0;
  private bar?: HTMLDivElement;
  private draco?: DRACOLoader;
  private synced = '';
  private plateau: PlateauSet[] = [];
  private plateauBusy = false;
  private plateauAt = 0;
  private plateauFor: [number, number] | null = null;
  private contextLost = false;
  private readonly onContextLost = (event: Event) => {
    event.preventDefault();
    this.contextLost = true;
  };
  private readonly onContextRestored = () => {
    this.contextLost = false;
    this.renderer?.resetState();
    this.map?.triggerRepaint();
  };

  constructor(
    private hooks: { note(msg: string): void } = { note: () => {} },
    /** `bar: false` leaves out the debug bar (the debug page has its own list) */
    private opts: { bar?: boolean } = {},
  ) {
    // the scene is in east/north/up axes: a low sun from the south-west gives the walls their shading
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(-0.5, -0.7, 0.9);
    this.scene.add(sun);
    this.world.matrixAutoUpdate = false;
    this.scene.add(this.world);
    this.lod.matrixAutoUpdate = false;
  }

  onAdd(map: MlMap, gl: WebGL2RenderingContext) {
    this.map = map;
    map.getCanvas().addEventListener('webglcontextlost', this.onContextLost);
    map.getCanvas().addEventListener('webglcontextrestored', this.onContextRestored);
    this.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
    this.renderer.autoClear = false;
    // Google tiles are Draco-compressed, Re:Earth's meshopt-compressed
    this.draco = new DRACOLoader().setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    this.attribution = document.createElement('div');
    this.attribution.style.cssText = 'position:absolute;left:8px;bottom:44px;z-index:2;pointer-events:none;color:#fff;font:600 12px sans-serif;text-shadow:0 0 3px #000';
    map.getCanvasContainer().appendChild(this.attribution);
    this.attributionRight = document.createElement('div');
    this.attributionRight.style.cssText = 'position:absolute;right:8px;bottom:44px;z-index:2;max-width:45%;text-align:right;pointer-events:none;color:#fff;font:600 11px sans-serif;text-shadow:0 0 3px #000';
    map.getCanvasContainer().appendChild(this.attributionRight);
    if (this.opts.bar ?? import.meta.env.DEV) this.bar = mountSourceBar(map);
    // the coverage of the shown sources: a pale outline of the root volume of every tileset
    if (!map.getSource(OUTLINE)) map.addSource(OUTLINE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    if (!map.getLayer(OUTLINE)) map.addLayer({ id: OUTLINE, type: 'line', source: OUTLINE, layout: { 'line-join': 'round' }, paint: { 'line-color': '#ffd23f', 'line-width': 1.5, 'line-opacity': 0.4, 'line-dasharray': [3, 2] } });
  }

  onRemove() {
    for (const id of [...this.entries.keys()]) this.drop(id);
    const canvas = this.map.getCanvas();
    canvas.removeEventListener('webglcontextlost', this.onContextLost);
    canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    this.draco?.dispose();
    this.renderer?.dispose();
    this.attribution?.remove();
    this.attributionRight?.remove();
    if (this.map.getLayer(OUTLINE)) this.map.removeLayer(OUTLINE);
    if (this.map.getSource(OUTLINE)) this.map.removeSource(OUTLINE);
    this.bar?.remove();
    this.renderer = undefined;
    this.synced = '';
  }

  private create(id: string, src: TilesSourceDef): Entry | null {
    const token = src.key ? state.keys[src.key]?.trim() : undefined;
    if (src.key && !token) {
      this.hooks.note(`${src.label}: Schlüssel fehlt (Einstellungen → 3D-Kacheln)`);
      return null;
    }
    if (useV2(src)) return this.createV2(src);
    const url = src.url;
    const tiles = (url ? new TilesRenderer(url) : new TilesRenderer()) as TilesRenderer & { registerPlugin(p: unknown): void };
    tiles.registerPlugin(new GLTFExtensionsPlugin({ dracoLoader: this.draco, meshoptDecoder: MeshoptDecoder, autoDispose: false }));
    // some tilesets (Re:Earth) use root-relative uris ("/v5-add/…"), which the renderer would not resolve
    if (url) {
      const origin = new URL(url).origin;
      tiles.registerPlugin({ preprocessURL: (u: string) => (u.startsWith('/') && !u.startsWith('//') ? origin + u : u) });
    }
    // The spec writes "REPLACE" / "ADD"; Lille has "replace". The renderer compares exactly, so such a tile
    // is no REPLACE tile for it: its parent is not kept while the children load and vanishes at once.
    tiles.registerPlugin({
      preprocessNode: (tile: { refine?: string }) => {
        if (typeof tile.refine === 'string') tile.refine = tile.refine.toUpperCase();
      },
    });
    // glTF 1.0 and unlit materials not listed as an extension would lose the whole tile (see gltf1.ts)
    tiles.registerPlugin({
      fetchData: (u: string, opts: RequestInit) =>
        /\.(b3dm|glb)(\?|$)/.test(u) ? fetch(u, opts).then(async (r) => (r.ok ? new Response(fixTile(await r.arrayBuffer()), { status: 200 }) : r)) : null,
    });
    if (id === 'google') tiles.registerPlugin(new GoogleCloudAuthPlugin({ apiToken: token!, autoRefreshToken: true, logoUrl: GOOGLE_LOGO }));
    if (id === 'ion') tiles.registerPlugin(new CesiumIonAuthPlugin({ apiToken: token!, assetId: '96188', autoRefreshToken: true }));
    tiles.group.matrixAutoUpdate = false;
    tiles.errorTarget = 6;
    // With siblings loaded too, a coarse tile is only replaced once ALL its children are there, also those
    // outside the view: on deep hierarchies (Esri meshes: 18 levels) the better tiles then sit loaded but
    // unseen for many seconds, while the queue is busy with tiles nobody looks at.
    tiles.loadSiblings = false;
    // Photo meshes weigh ~4 MB per tile (textures decompressed). With the default 430 MB the cache is
    // full after ~100 tiles, and the tiles of the next level are refused while their parents are already
    // hidden: holes when zooming in. Budget by the device's memory instead.
    const budget = Math.min(2.5e9, Math.max(0.6e9, ((navigator as { deviceMemory?: number }).deviceMemory ?? 4) * 0.25e9));
    tiles.lruCache.maxBytesSize = budget;
    tiles.lruCache.minBytesSize = budget * 0.75;
    tiles.setCamera(this.lod);
    const entry: Entry = { tiles, attribution: src.attribution, links: src.links, logos: src.logos, opacity: 100, ground: 0, centre: new THREE.Vector3(), depthWeight: 300, offset: 0, checked: 0, lows: new Map() };
    // Loading order: what is needed and lies around the map centre first. By default the tiles with the
    // largest error come first wherever they are, so the surroundings load while the view stays empty.
    // A coarse tile is swapped for its children only when all of them are there, so each level has to come
    // in as a whole: levels count like a distance (entry.depthWeight), coarse before fine, near before far.
    const rank = (t: { traversal?: { used?: boolean }; internal?: { depth?: number }; engineData?: { boundingVolume?: { distanceToPoint(p: THREE.Vector3): number } } }) =>
      (t.traversal?.used ? 0 : 1e9) + (t.engineData?.boundingVolume?.distanceToPoint(entry.centre) ?? 1e8) + (t.internal?.depth ?? 0) * entry.depthWeight;
    const queued = (tiles as unknown as { queuedTiles: unknown }).queuedTiles as { priority?: number }[];
    queued.sort = function (this: typeof queued) {
      for (const t of this) t.priority = 1e12 - rank(t as never); // the download and parse queues take the higher value first
      return Array.prototype.sort.call(this, (a, b) => rank(a as never) - rank(b as never)); // the requests go front to back
    } as typeof queued.sort;
    tiles.addEventListener('needs-update', () => this.map.triggerRepaint());
    tiles.addEventListener('tiles-load-end', () => this.map.triggerRepaint());
    tiles.addEventListener('load-model', (ev) => {
      const { scene, tile } = ev as unknown as { scene: THREE.Object3D; tile: unknown };
      this.applyOpacity(scene, entry.opacity);
      // Lit PBR materials with metalness (Madrid: 0.5) look nearly black here: there is no environment to mirror.
      scene.traverse((o) => {
        const mat = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        for (const x of Array.isArray(mat) ? mat : mat ? [mat] : []) {
          const std = x as THREE.MeshStandardMaterial;
          if (std.isMeshStandardMaterial) {
            std.metalness = 0;
            std.roughness = 1;
          }
        }
      });
      const low = lowestPoint(scene, scene.parent ? scene.parent.matrixWorld : null);
      if (low) entry.lows.set(tile, low);
    });
    tiles.addEventListener('dispose-model', (ev) => entry.lows.delete((ev as unknown as { tile: unknown }).tile));
    tiles.addEventListener('load-error', (e) => this.hooks.note(`${src.label}: ${(e as unknown as { error?: Error }).error?.message ?? 'Kachel konnte nicht geladen werden'}`));
    this.world.add(tiles.group);
    if (this.anchor) this.place(entry);
    return entry;
  }

  private createV2(src: TilesSourceDef): Entry {
    const engine = new TileEngine(src.url!, { repaint: () => this.map.triggerRepaint(), note: (m) => this.hooks.note(`${src.label}: ${m}`), upload: (t) => this.renderer?.initTexture(t) });
    engine.setOpacity(state.opacity);
    const entry: Entry = { engine, attribution: src.attribution, links: src.links, logos: src.logos, opacity: state.opacity, ground: 0, centre: new THREE.Vector3(), depthWeight: 300, offset: 0, checked: 0, lows: new Map() };
    this.world.add(engine.group);
    if (this.anchor) this.place(entry);
    return entry;
  }

  private drop(id: string) {
    const e = this.entries.get(id);
    if (!e) return;
    this.world.remove(e.engine?.group ?? e.tiles!.group);
    (e.engine ?? e.tiles)!.dispose();
    this.entries.delete(id);
  }

  private applyOpacity(root: THREE.Object3D, percent: number) {
    const o = percent / 100;
    root.traverse((m) => {
      const mat = (m as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      for (const x of Array.isArray(mat) ? mat : mat ? [mat] : []) {
        x.transparent = o < 1;
        x.opacity = o;
        x.needsUpdate = true;
      }
    });
  }

  /** the tile renderer of a shown source (for the debug page) */
  tilesOf(id: string) {
    const e = this.entries.get(id);
    return e?.tiles ?? e?.engine;
  }

  /** per shown source: how its tiles are doing (for the debug page) */
  debugInfo() {
    return [...this.entries].map(([id, e]) => {
      const s = ((e.engine ?? e.tiles) as unknown as { stats: Record<string, number> }).stats;
      return { id, engine: e.engine ? 'v2' : 'v1', loaded: s.loaded, failed: s.failed, queued: s.queued, downloading: s.downloading, active: s.active, visible: s.visible, ground: Math.round(e.ground), offset: Math.round(e.offset), ring: footprint((e.engine ?? e.tiles) as unknown as TilesRenderer) };
    });
  }

  /** the tile sources to show now: the chosen ones, with "PLATEAU" expanded to the tilesets around the map centre */
  private wanted(): [string, TilesSourceDef][] {
    const out: [string, TilesSourceDef][] = [];
    for (const id of state.selected) {
      const src = TILES_SOURCES.find((x) => x.id === id);
      if (!src) continue;
      // only sources with a checked licence in the public app (the others: dev server, see TilesSourceDef.open)
      if (!import.meta.env.DEV && !src.open) continue;
      if (!src.dynamic) out.push([id, src]);
      else if (id === 'plateau') for (const p of this.plateau) out.push([`plateau:${p.url}`, { ...src, id: `plateau:${p.url}`, label: `PLATEAU ${p.name}`, url: p.url }]);
    }
    return out;
  }

  /** Looks up the PLATEAU tilesets around the map centre (once the centre moved a bit; the catalog loads on first use). */
  private pollPlateau() {
    const c = this.map.getCenter();
    const now = performance.now();
    if (this.plateauBusy || this.map.getZoom() < 11 || now - this.plateauAt < 1500) return;
    if (this.plateauFor && Math.hypot(c.lng - this.plateauFor[0], c.lat - this.plateauFor[1]) < 0.003) return;
    this.plateauBusy = true;
    this.plateauAt = now;
    this.plateauFor = [c.lng, c.lat];
    plateauAt(c.lng, c.lat)
      .then((list) => {
        // keep the ones already shown while they are still close, at most 6 at a time
        const keep = this.plateau.filter((p) => !list.some((l) => l.url === p.url));
        this.plateau = [...list, ...keep].slice(0, 6);
        this.map.triggerRepaint();
      })
      .catch(() => this.hooks.note('PLATEAU-Katalog nicht erreichbar'))
      .finally(() => (this.plateauBusy = false));
  }

  /** follows the Karte's choice: creates or drops tile renderers, updates the opacity and the attribution */
  private sync() {
    const want = this.wanted();
    const sig = `${want.map(([k]) => k).join(',')}|${Object.entries(state.keys).filter(([k]) => k === 'cesiumIon' || k === 'googleTiles').join(';')}`;
    if (sig !== this.synced) {
      this.synced = sig;
      this.hooks.note('');
      for (const id of [...this.entries.keys()]) if (!want.some(([k]) => k === id)) this.drop(id);
      for (const [id, src] of want) {
        if (this.entries.has(id)) continue;
        const e = this.create(id, src);
        if (e) this.entries.set(id, e);
      }
      this.attributionKey = '';
    }
    this.paintAttribution();
    this.paintOutline();
    for (const e of this.entries.values()) {
      if (e.opacity === state.opacity) continue;
      e.opacity = state.opacity;
      if (e.engine) e.engine.setOpacity(e.opacity);
      else e.tiles!.forEachLoadedModel((scene) => this.applyOpacity(scene, e.opacity));
    }
  }

  /** The coverage outline: the footprint of every tileset shown, unless the Karte switched it off. */
  private paintOutline() {
    const now = performance.now();
    if (now - this.outlineAt < 700) return;
    this.outlineAt = now;
    const rings = state.outline ? this.debugInfo().flatMap((i) => (i.ring ? [i.ring] : [])) : [];
    const key = JSON.stringify(rings);
    if (key === this.outlineKey) return;
    this.outlineKey = key;
    (this.map.getSource(OUTLINE) as { setData(d: unknown): void } | undefined)?.setData({
      type: 'FeatureCollection',
      features: rings.map((r) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: r } })),
    });
  }

  /**
   * Attribution: the text, links and logos of every source shown, and what the renderer collects from the tiles in
   * view (Google: the logo and the providers of the imagery; Cesium ion: its logo and credits).
   */
  private paintAttribution() {
    const now = performance.now();
    if (now - this.attributionAt < 500 && this.attributionKey) return;
    this.attributionAt = now;
    type Dyn = { type: string; value: string };
    const dyn: Dyn[] = [];
    for (const e of this.entries.values()) {
      const got = (e.tiles as unknown as { getAttributions?(t: Dyn[]): Dyn[] } | undefined)?.getAttributions?.([]) ?? [];
      for (const d of got) if (typeof d.value === 'string' && d.value) dyn.push({ type: d.type, value: d.value });
    }
    const list = [...this.entries.values()].map((e) => ({ t: e.attribution, l: e.links, g: e.logos }));
    const key = JSON.stringify([list, dyn]);
    if (key === this.attributionKey) return;
    this.attributionKey = key;
    const left = this.attribution!;
    const right = this.attributionRight!;
    left.replaceChildren();
    right.replaceChildren();
    const logo = (src: string, alt: string, href?: string) => {
      const img = document.createElement('img');
      img.src = src;
      img.alt = alt;
      img.style.cssText = 'height:18px;vertical-align:middle;margin-right:6px;background:#fff;border-radius:3px;padding:1px 4px';
      if (!href) return img;
      const a = document.createElement('a');
      a.href = href;
      a.target = '_blank';
      a.rel = 'noopener';
      a.style.pointerEvents = 'auto';
      a.appendChild(img);
      return a;
    };
    for (const d of dyn) if (d.type === 'image') left.appendChild(logo(d.value, 'Logo'));
    for (const e of list) for (const g of e.g ?? []) left.appendChild(logo(g.src, g.alt, g.href));
    const text = [...new Set(list.map((e) => e.t).filter(Boolean))].join(' · ');
    if (text) left.appendChild(document.createTextNode(text));
    for (const e of list)
      for (const l of e.l ?? []) {
        const a = document.createElement('a');
        a.href = l.href;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = l.text;
        a.style.cssText = 'color:inherit;pointer-events:auto;margin-left:6px;text-decoration:underline';
        left.appendChild(a);
      }
    // strings and html credits of the tiles (the html is reduced to its text)
    const credits = [...new Set(dyn.filter((d) => d.type !== 'image').map((d) => (d.type === 'html' ? (new DOMParser().parseFromString(d.value, 'text/html').body.textContent ?? '') : d.value).trim()).filter(Boolean))];
    if (credits.length) right.textContent = credits.join(' · ');
  }

  /** ENU anchor at the map centre; each `tiles.group` carries the ECEF → ENU transform */
  private reanchor(lon: number, lat: number) {
    this.anchor = { lon, lat, mc: MercatorCoordinate.fromLngLat([lon, lat], 0) };
    for (const e of this.entries.values()) this.place(e);
  }

  private place(entry: Entry) {
    const { lon, lat } = this.anchor!;
    const group = entry.engine?.group ?? entry.tiles!.group;
    const { e, n, u } = enuAxes(lon, lat);
    const p = ecef(lon, lat, 0);
    const m = new THREE.Matrix4().makeBasis(e, n, u).invert(); // rotation ECEF → ENU (basis is orthonormal)
    m.multiply(new THREE.Matrix4().makeTranslation(-p.x, -p.y, -p.z));
    m.premultiply(new THREE.Matrix4().makeTranslation(0, 0, -entry.offset)); // ENU "up" is z
    group.matrix.copy(m);
    group.matrixWorldNeedsUpdate = true;
  }

  render(_gl: WebGL2RenderingContext, args: { defaultProjectionData: { mainMatrix: ArrayLike<number> } }) {
    const renderer = this.renderer;
    if (!renderer || this.contextLost) return;
    if (state.selected.includes('plateau')) this.pollPlateau();
    else if (this.plateau.length) this.plateau = [];
    this.sync();
    if (!this.entries.size) return;
    const map = this.map;
    const c = map.getCenter();
    const a = this.anchor;
    if (!a || Math.hypot((c.lng - a.lon) * 111320 * Math.cos(a.lat * RAD), (c.lat - a.lat) * 110574) > REANCHOR_M) this.reanchor(c.lng, c.lat);
    const anchor = this.anchor!;
    const s = anchor.mc.meterInMercatorCoordinateUnits();

    // 1. tile selection in ENU metres: camera position from the map, looking at the centre
    // the eye is the point at w = 0 of the projection: inverse(main matrix) · (0, 0, 1, 0)
    const eye = new THREE.Vector4(0, 0, 1, 0).applyMatrix4(new THREE.Matrix4().fromArray(args.defaultProjectionData.mainMatrix as number[]).invert());
    const cam = { x: eye.x / eye.w, y: eye.y / eye.w, z: eye.z / eye.w };
    const [lx, ly] = [(cam.x - anchor.mc.x) / s, -(cam.y - anchor.mc.y) / s];
    this.world.matrix.identity();
    this.world.updateMatrixWorld(true);
    this.lod.position.set(lx, ly, cam.z / s);
    this.lod.up.set(0, 0, 1);
    const look = MercatorCoordinate.fromLngLat(c, 0);
    const target = new THREE.Vector3((look.x - anchor.mc.x) / s, -(look.y - anchor.mc.y) / s, 0);
    this.lod.lookAt(target);
    this.lod.updateMatrix();
    this.lod.matrixWorld.copy(this.lod.matrix);
    this.lod.matrixWorldInverse.copy(this.lod.matrixWorld).invert();
    const canvas = map.getCanvas();
    this.lod.aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    this.lod.fov = ((map as unknown as { transform?: { fov: number } }).transform?.fov ?? 0.6435) / RAD;
    this.lod.updateProjectionMatrix();
    // Distant tiles may be coarser: the further from the camera, the more of the screen-space error is
    // forgiven (up to the whole target). In a tilted view the horizon then needs few, coarse tiles, and a
    // coarse tile is swapped for its children as soon as the ones near the centre are there. The curve is
    // scaled by the camera's distance to the map centre, so it works at every zoom.
    const falloffDensity = 1 / (this.lod.position.distanceTo(target) * 1.5);
    const now = performance.now();
    for (const e of this.entries.values()) {
      e.centre.copy(ecef(c.lng, c.lat, e.ground));
      if (e.engine) {
        e.engine.update(this.lod, { width: canvas.clientWidth, height: canvas.clientHeight }, { errorTarget: 6, falloff: 6, density: falloffDensity });
        if (now - e.checked > 400) {
          e.checked = now;
          // the ground under the map centre; it follows slowly, so a change of the level of detail does not make the tiles jump
          // not while tiles are still arriving (the level of detail under the centre is changing), and a change under
          // 2 m is ignored: the layer must not rise and fall when one zooms or pans
          // the ground under the map centre; changes follow slowly, so a change of the level of detail does not
          // make the tiles jump: shifting by 2 m and more is smoothed, and only a wild change (> 100 m) is applied
          // at once. Measured even while tiles stream in — waiting for quiet meant the layer floated for minutes.
          const gp = e.engine.groundAt(ecef(c.lng, c.lat, 0));
          let measured: number | null = null;
          if (gp) {
            const g = heightOf(gp.x, gp.y, gp.z);
            measured = g;
            if (!e.groundSet || Math.abs(g - e.ground) > 100) e.ground = g;
            else if (Math.abs(g - e.ground) > 2) e.ground += (g - e.ground) * 0.2;
            e.groundSet = true;
          }
          let offset = e.ground;
          if (map.getTerrain()) {
            // On the map's 3D terrain the layer is aligned to it: the tiles' ground and the terrain are measured at the
            // same spot and moment, and only their difference (about the geoid height, it hardly changes from place
            // to place) is kept, slowly. Lowering by the terrain under the *moving* centre while the ground lags
            // behind made the layer rise and fall when panning over a slope.
            const t = measured === null ? null : map.queryTerrainElevation(c);
            // MapLibre yields 0 while the DEM tile under the centre has not arrived; taking that as elevation sank
            // the whole layer by its ground height. A real difference of ground against terrain is a geoid-sized
            // thing (at most ~100 m), never hundreds of metres.
            const usable = t != null && (t !== 0 || (measured ?? 0) <= 100) && measured !== null && Math.abs(measured - t) < 150;
            if (usable) {
              const raw = measured! - t;
              if (!e.terrainSet || Math.abs(raw - e.offset) > 30) e.offset = raw;
              else if (Math.abs(raw - e.offset) > 1) e.offset += (raw - e.offset) * 0.15;
              e.terrainSet = true;
              this.place(e);
            }
            offset = e.offset;
          } else e.terrainSet = false;
          if (!e.terrainSet && Math.abs(offset - e.offset) > 0.05) {
            e.offset = offset;
            this.place(e);
          }
        }
        continue;
      }
      const tiles = e.tiles!;
      e.depthWeight = Math.max(30, 0.5 / falloffDensity / 1.5); // ~half the camera's distance to the centre
      tiles.errorFalloff = tiles.errorTarget;
      tiles.errorFalloffDensity = falloffDensity;
      tiles.setResolution(this.lod, canvas.clientWidth, canvas.clientHeight);
      tiles.update();
      if (now - e.checked > 400) {
        e.checked = now;
        const g = groundHeight(e, c.lng, c.lat);
        if (g !== null) e.ground = g;
        // with map terrain the ground of the map is not at 0 but at the terrain height under the centre
        const terrain = map.getTerrain() ? (map.queryTerrainElevation(c) ?? 0) : 0;
        if (Math.abs(e.ground - terrain - e.offset) > 0.5) {
          e.offset = e.ground - terrain;
          this.place(e);
        }
      }
    }

    // 2. draw: ENU metres → mercator relative to the map centre (north = -y, 1 m = s)
    const centre = MercatorCoordinate.fromLngLat(c, 0);
    // The north → -y flip of this mapping is moved from the object matrix into the projection:
    // three flips the face winding of objects whose matrix mirrors, which MapLibre's matrix already
    // accounts for, and every model would show its insides.
    this.world.matrix.makeTranslation(anchor.mc.x - centre.x, -(anchor.mc.y - centre.y), 0).multiply(new THREE.Matrix4().makeScale(s, s, s));
    this.world.updateMatrixWorld(true);
    this.proj
      .fromArray(args.defaultProjectionData.mainMatrix as number[])
      .multiply(new THREE.Matrix4().makeTranslation(centre.x, centre.y, 0))
      .multiply(new THREE.Matrix4().makeScale(1, -1, 1));
    this.camera.projectionMatrix.copy(this.proj);
    this.camera.projectionMatrixInverse.copy(this.proj).invert();
    renderer.resetState();
    renderer.render(this.scene, this.camera);
  }
}
