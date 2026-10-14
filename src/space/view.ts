import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { propagate } from 'satellite.js';
import { loadSatellites, type Sat } from '../api/tracking';
import { escapeHtml, fmt, toast } from '../util';
import { BODIES, CRAFT, setPositionResolver, setSatLookup, type Body } from './bodies';
import { COUNTRY, LANDING_SITES, MoonDetail, flagDataUrl, surfaceDir } from './moon';
import {
  AU_KM,
  eciToEcliptic,
  gmst,
  len,
  moonGeocentric,
  orbitPath,
  sub,
  type Vec3,
} from './ephemeris';

// Interactive 3D solar system. Scene units are AU; a floating origin keeps the focused
// body at (0,0,0) so float32 precision on the GPU is fine from 100 AU down to metres.

export interface SpaceView {
  el: HTMLElement;
  activate(opts?: { focus?: string; lat?: number; lon?: number; site?: string }): void;
  deactivate(): void;
}

const ALL: Body[] = [...BODIES, ...CRAFT];
const byId = new Map(ALL.map((b) => [b.id, b]));

/** ecliptic (x, y, z) → three.js (x, z, -y) with y up = ecliptic north */
const toThree = (v: Vec3, out = new THREE.Vector3()) => out.set(v[0], v[2], -v[1]);

const SPEEDS: { label: string; f: number }[] = [
  { label: '−1 Jahr/s', f: -365.25 * 86400 },
  { label: '−1 Monat/s', f: -30 * 86400 },
  { label: '−1 Woche/s', f: -7 * 86400 },
  { label: '−1 Tag/s', f: -86400 },
  { label: '−1 Std/s', f: -3600 },
  { label: '−1 min/s', f: -60 },
  { label: 'Echtzeit', f: 1 },
  { label: '1 min/s', f: 60 },
  { label: '1 Std/s', f: 3600 },
  { label: '1 Tag/s', f: 86400 },
  { label: '1 Woche/s', f: 7 * 86400 },
  { label: '1 Monat/s', f: 30 * 86400 },
  { label: '1 Jahr/s', f: 365.25 * 86400 },
];
const REALTIME = 6;

const KIND_LABEL: Record<string, string> = {
  star: 'Stern',
  planet: 'Planet',
  dwarf: 'Zwergplanet',
  moon: 'Mond',
  craft: 'Raumsonde',
};

const TRAIL_DAYS: Record<string, number> = {
  voyager1: 365 * 44,
  voyager2: 365 * 35,
  newhorizons: 365 * 9,
  pioneer10: 365 * 45,
  pioneer11: 365 * 34,
  europaclipper: 365 * 6,
  juice: 365 * 8,
  bepicolombo: 365 * 8,
  parker: 88,
};

export function createSpaceView(onOpenEarthMap: (lat: number, lon: number) => void): SpaceView {
  const el = document.createElement('main');
  el.className = 'view space-view';
  el.innerHTML = `
    <div class="space-canvas"></div>
    <div class="space-labels"></div>
    <aside class="space-list panel">
      <div class="panel-scroll">
        <input class="space-filter" type="search" placeholder="Objekt suchen …" aria-label="Objekt suchen"/>
        <div class="space-list-items"></div>
        <h3>Anzeige</h3>
        <label class="row"><input type="checkbox" data-opt="orbits" checked/> Umlaufbahnen</label>
        <label class="row"><input type="checkbox" data-opt="labels" checked/> Beschriftungen</label>
        <label class="row"><input type="checkbox" data-opt="craft" checked/> Raumsonden</label>
        <label class="row"><input type="checkbox" data-opt="sats" checked/> Erdsatelliten (in Erdnähe)</label>
        <label class="row"><input type="checkbox" data-opt="sites" checked/> Landestellen auf dem Mond</label>
        <p class="small muted">Texturen: <a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noopener">Solar System Scope</a> (CC BY 4.0) ·
        Mond: NASA <a href="https://svs.gsfc.nasa.gov/4720" target="_blank" rel="noopener">CGI Moon Kit</a> (LRO LROC/LOLA) und
        <a href="https://trek.nasa.gov/moon/" target="_blank" rel="noopener">Moon Trek</a> ·
        Bahnen: JPL-Näherungsformeln · Satelliten: CelesTrak</p>
      </div>
    </aside>
    <button class="btn icon-btn space-list-toggle" aria-label="Objektliste" title="Objektliste">
      <svg viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
    </button>
    <section class="space-info" hidden></section>
    <div class="space-time">
      <button class="btn icon-btn" data-t="slower" title="Langsamer / rückwärts" aria-label="Langsamer">
        <svg viewBox="0 0 24 24"><path d="M11 6l-7 6 7 6zM20 6l-7 6 7 6z"/></svg></button>
      <button class="btn icon-btn sp-play" data-t="play" title="Pause" aria-label="Pause">
        <svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg></button>
      <button class="btn icon-btn" data-t="faster" title="Schneller" aria-label="Schneller">
        <svg viewBox="0 0 24 24"><path d="M13 6l7 6-7 6zM4 6l7 6-7 6z"/></svg></button>
      <div class="sp-clock"><b class="sp-date"></b><small class="sp-speed"></small></div>
      <input type="datetime-local" class="sp-date-input" aria-label="Datum wählen"/>
      <button class="btn small" data-t="now">Jetzt</button>
      <button class="btn small" data-t="overview" title="Ganzes Sonnensystem">Übersicht</button>
    </div>`;

  const canvasHost = el.querySelector<HTMLDivElement>('.space-canvas')!;
  const labelHost = el.querySelector<HTMLDivElement>('.space-labels')!;
  const info = el.querySelector<HTMLElement>('.space-info')!;
  const listEl = el.querySelector<HTMLDivElement>('.space-list-items')!;
  const listPanel = el.querySelector<HTMLElement>('.space-list')!;
  const filterEl = el.querySelector<HTMLInputElement>('.space-filter')!;
  const dateEl = el.querySelector<HTMLElement>('.sp-date')!;
  const speedEl = el.querySelector<HTMLElement>('.sp-speed')!;
  const dateInput = el.querySelector<HTMLInputElement>('.sp-date-input')!;
  const playBtn = el.querySelector<HTMLButtonElement>('.sp-play')!;
  if (window.innerWidth <= 720) listPanel.hidden = true;

  // ----- state -------------------------------------------------------------
  let simTime = Date.now();
  let speedIdx = REALTIME;
  let playing = true;
  let focusId = 'earth';
  const opts = { orbits: true, labels: true, craft: true, sats: true, sites: true };
  /** selected landing site on the Moon (info panel) */
  let siteId: string | null = null;

  // positions for the current frame (heliocentric, AU), resolved lazily with dependencies
  let frameCache = new Map<string, Vec3 | null>();
  const resolve = (id: string, ms: number): Vec3 | null => {
    if (ms === simTime) {
      if (frameCache.has(id)) return frameCache.get(id)!;
      const b = byId.get(id);
      const p = b ? b.position(ms, (pid) => resolve(pid, ms) ?? [0, 0, 0]) : null;
      frameCache.set(id, p);
      return p;
    }
    const b = byId.get(id);
    return b ? b.position(ms, (pid) => resolve(pid, ms) ?? [0, 0, 0]) : null;
  };
  setPositionResolver((id, ms) => resolve(id, ms) ?? [0, 0, 0]);

  // ----- three.js ----------------------------------------------------------
  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene;
  /** everything except the camera; rescaled per frame so the camera sits at distance 1 */
  let world: THREE.Group;
  let camera: THREE.PerspectiveCamera;
  let controls: OrbitControls;
  let sunLight: THREE.PointLight;
  let viewLight: THREE.DirectionalLight;
  let ambientLight: THREE.AmbientLight;
  const meshes = new Map<string, { group: THREE.Group; spin: THREE.Object3D; body: Body }>();
  const orbitLines = new Map<string, { line: THREE.Line; at: number }>();
  const moonLines = new Map<string, THREE.Line>();
  const trails = new Map<string, { line: THREE.Line; at: number }>();
  const labels = new Map<string, HTMLDivElement>();
  let satPoints: THREE.Points | null = null;
  let sats: Sat[] = [];
  let satsLoading = false;
  let satPositions: Vec3[] = [];
  let raf = 0;
  let lastFrame = 0;
  let active = false;

  // focus transition
  let origin: Vec3 = [0, 0, 0];
  let trans: { from: Vec3; to: string; t0: number; dur: number; d0: number; d1: number } | null = null;
  // camera swing to a spot on the Moon's surface
  let aim: { from: THREE.Vector3; lat: number; lon: number; t0: number; dur: number; d0: number; d1: number } | null = null;
  let moonDetail: MoonDetail | null = null;

  const radiusAU = (b: Body) => (b.model ? b.model.sizeM / 2000 : b.radiusKm) / AU_KM;

  // ----- NASA 3D models (glTF), loaded only when needed --------------------
  let gltfLoader: GLTFLoader | null = null;
  let envMap: THREE.Texture | null = null;
  const gltfCache = new Map<string, Promise<THREE.Object3D>>();
  const crafts = new Map<string, { group: THREE.Group; state: 'idle' | 'loading' | 'ready' | 'error'; detail: 'idle' | 'loading' | 'ready' | 'error'; base?: THREE.Object3D }>();

  // note: with gzip/brotli `total` is the compressed size while `loaded` counts decoded bytes, so clamp
  function loadModel(url: string, onProgress?: (frac: number) => void) {
    if (!gltfLoader) {
      const draco = new DRACOLoader().setDecoderPath('./draco/');
      gltfLoader = new GLTFLoader().setDRACOLoader(draco);
    }
    let p = gltfCache.get(url);
    if (!p) {
      p = gltfLoader
        .loadAsync(url, onProgress && ((e) => e.lengthComputable && e.total > 0 && onProgress(Math.min(0.99, e.loaded / e.total))))
        .then((g) => g.scene);
      gltfCache.set(url, p);
    }
    return p;
  }

  /** Normalise a loaded glTF scene to the craft's real size (centred, scaled to AU). */
  function placeModel(src: THREE.Object3D, b: Body, detail = false) {
    const obj = src.clone(true);
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    obj.position.sub(center); // centre the model on the craft's position
    const inner = new THREE.Group();
    inner.add(obj);
    inner.scale.setScalar(b.model!.sizeM / Math.max(size.x, size.y, size.z) / (AU_KM * 1000));
    if (detail) inner.rotation.y = b.model!.detailRotY ?? 0;
    obj.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      for (const mat of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        const std = mat as THREE.MeshStandardMaterial;
        if (detail && std.transparent && std.map) {
          // alpha-blended cut-outs (panels, truss) sort wrongly and flicker; treat them as hard-edged cut-outs
          std.transparent = false;
          std.alphaTest = 0.5;
          std.depthWrite = true;
          std.alphaToCoverage = true;
          std.needsUpdate = true;
        }
        if ('envMap' in std) {
          std.envMap = envMap;
          std.envMapIntensity = 0.55;
          std.needsUpdate = true;
        }
      }
      mesh.userData.id = b.id;
    });
    return inner;
  }

  /** Load (once) and place the model of a craft; scaled to its real size in AU. */
  function ensureCraftModel(b: Body) {
    let c = crafts.get(b.id);
    if (!c) {
      c = { group: new THREE.Group(), state: 'idle', detail: 'idle' };
      c.group.visible = false;
      world.add(c.group);
      crafts.set(b.id, c);
    }
    if (c.state !== 'idle' || !b.model) return c;
    c.state = 'loading';
    if (b.id === focusId) renderInfo();
    const entry = c;
    loadModel(b.model.url)
      .then((src) => {
        entry.base = placeModel(src, b);
        // the detailed model may already have arrived first
        if (entry.detail !== 'ready') entry.group.add(entry.base);
        entry.state = 'ready';
        if (b.id === focusId) renderInfo();
      })
      .catch((e) => {
        console.warn('Modell', b.id, e);
        entry.state = 'error';
        if (b.id === focusId) renderInfo();
      });
    return c;
  }

  // progress chip for detailed models that are being downloaded
  const loading = new Map<string, number>();
  const loadChip = document.createElement('div');
  loadChip.className = 'sp-loadchip';
  loadChip.hidden = true;
  el.append(loadChip);
  function drawLoad() {
    loadChip.hidden = loading.size === 0;
    loadChip.innerHTML = [...loading]
      .map(
        ([id, f]) =>
          `<div><span>${escapeHtml(byId.get(id)?.name ?? id)} · Detailmodell wird geladen${f > 0 ? ` … ${Math.round(f * 100)} %` : ' …'}</span><i style="width:${Math.round(f * 100)}%"></i></div>`,
      )
      .join('');
  }
  function showLoad(b: Body, f: number) {
    loading.set(b.id, f);
    drawLoad();
  }
  function hideLoad(b: Body) {
    loading.delete(b.id);
    drawLoad();
  }

  /** Fetch the big detailed model (if the craft has one) and swap it in; the small one stays until then. */
  function ensureDetailModel(b: Body) {
    const c = crafts.get(b.id);
    const url = b.model?.detailUrl;
    if (!c || !url || c.detail !== 'idle') return;
    c.detail = 'loading';
    showLoad(b, 0);
    if (b.id === focusId) renderInfo();
    loadModel(url, (f) => showLoad(b, f))
      .then((src) => {
        const inner = placeModel(src, b, true);
        if (c.base) c.group.remove(c.base);
        c.group.add(inner);
        c.detail = 'ready';
        hideLoad(b);
        if (b.id === focusId) renderInfo();
      })
      .catch((e) => {
        console.warn('Detailmodell', b.id, e);
        c.detail = 'error'; // keep showing the small model
        hideLoad(b);
        if (b.id === focusId) renderInfo();
      });
  }

  function updateCraftModels() {
    const pxPerRad = el.clientHeight / 2 / Math.tan((camera.fov * Math.PI) / 360);
    for (const b of CRAFT) {
      if (!b.model) continue;
      const p = resolve(b.id, simTime);
      const c = crafts.get(b.id);
      if (!p || !opts.craft) {
        if (c) c.group.visible = false;
        continue;
      }
      toThree(sub(p, origin), v3m);
      const dist = Math.max(1e-15, v3m.distanceTo(camera.position));
      const px = (radiusAU(b) / dist) * pxPerRad;
      // only fetch a model once it would be at least a few pixels big (or is selected)
      if (px < 1.5 && b.id !== focusId && !c) continue;
      const cc = c ?? ensureCraftModel(b);
      if (px >= 1.5 || b.id === focusId) ensureCraftModel(b);
      // the large model only once the craft is selected or clearly visible (tens of pixels)
      if (b.model.detailUrl && cc.state === 'ready' && (b.id === focusId || px >= 40)) ensureDetailModel(b);
      cc.group.visible = (cc.state === 'ready' || cc.detail === 'ready') && px > 0.5;
      cc.group.position.copy(v3m);
    }
  }
  const v3m = new THREE.Vector3();

  function init() {
    renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    canvasHost.appendChild(renderer.domElement);
    scene = new THREE.Scene();
    world = new THREE.Group();
    scene.add(world);
    camera = new THREE.PerspectiveCamera(45, 1, 1e-10, 2000);
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.zoomSpeed = 1.6;
    controls.enablePan = false;
    controls.rotateSpeed = 0.6;

    const loader = new THREE.TextureLoader();
    const load = (url: string) => {
      const t = loader.load(url);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      return t;
    };
    const stars = load('./textures/galaxy_starfield.jpg');
    stars.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = stars;
    scene.backgroundIntensity = 0.45;

    ambientLight = new THREE.AmbientLight(0xffffff, 0.07);
    world.add(ambientLight);
    // soft studio reflections for the metal/foil surfaces of the spacecraft models only
    envMap = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    ensureSats();
    sunLight = new THREE.PointLight(0xffffff, 3.2, 0, 0);
    world.add(sunLight);
    viewLight = new THREE.DirectionalLight(0xffffff, 0);
    scene.add(viewLight);
    scene.add(viewLight.target);

    const sphere = new THREE.SphereGeometry(1, 96, 48);
    for (const b of BODIES) {
      const group = new THREE.Group();
      const spin = new THREE.Group();
      let mat: THREE.Material;
      if (b.kind === 'star') {
        mat = new THREE.MeshBasicMaterial({ map: b.texture ? load(b.texture) : null, color: b.texture ? 0xffffff : b.color });
      } else {
        const stdOpts: THREE.MeshStandardMaterialParameters = { map: b.texture ? load(b.texture) : null, color: b.texture ? 0xffffff : b.color, roughness: 1, metalness: 0 };
        if (b.bumpMap) {
          const bump = loader.load(b.bumpMap);
          bump.anisotropy = 4;
          stdOpts.bumpMap = bump;
          stdOpts.bumpScale = b.bumpScale ?? 0.01;
        }
        mat = new THREE.MeshStandardMaterial(stdOpts);
      }
      const mesh = new THREE.Mesh(sphere, mat);
      const r = radiusAU(b);
      mesh.scale.setScalar(r);
      mesh.userData.id = b.id;
      spin.add(mesh);
      group.add(spin);
      group.rotation.x = -((b.tiltDeg ?? 0) * Math.PI) / 180;
      if (b.id === 'saturn') {
        const ringTex = load('./textures/saturnringcolortrans.png');
        ringTex.repeat.set(0.5, 1); // the image holds the ring twice side by side
        const ringR = 140_220 / AU_KM;
        const ring = new THREE.Mesh(
          new THREE.PlaneGeometry(2 * ringR, 2 * ringR),
          new THREE.MeshStandardMaterial({ map: ringTex, transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 1 }),
        );
        ring.rotation.x = -Math.PI / 2;
        group.add(ring);
      }
      if (b.kind === 'star') {
        const glow = new THREE.Sprite(
          new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffd27a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
        );
        glow.scale.setScalar(r * 9);
        group.add(glow);
      }
      world.add(group);
      meshes.set(b.id, { group, spin, body: b });
      if (b.id === 'moon') {
        moonDetail = new MoonDetail(mesh, {
          labelHost,
          onSite: selectSite,
          maxTextureSize: renderer.capabilities.maxTextureSize,
          anisotropy: Math.min(8, renderer.capabilities.getMaxAnisotropy()),
        });
      }
    }

    // labels
    for (const b of ALL) {
      const d = document.createElement('div');
      d.className = `sp-label kind-${b.kind}`;
      d.innerHTML = `<span class="sp-dot" style="background:${b.color}"></span><span class="sp-name">${escapeHtml(b.name)}</span>`;
      d.addEventListener('click', (e) => {
        e.stopPropagation();
        focus(b.id);
      });
      labelHost.appendChild(d);
      labels.set(b.id, d);
    }

    // satellites (points)
    const satGeo = new THREE.BufferGeometry();
    satGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
    satPoints = new THREE.Points(satGeo, new THREE.PointsMaterial({ color: 0xd1b3ff, size: 3, sizeAttenuation: false }));
    satPoints.visible = false;
    world.add(satPoints);

    // clicks on meshes / satellites
    const ray = new THREE.Raycaster();
    let down: { x: number; y: number } | null = null;
    renderer.domElement.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
    renderer.domElement.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      const rect = renderer!.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      ray.params.Points = { threshold: camera.position.length() * 0.01 };
      const hits = ray.intersectObjects(
        [...[...meshes.values()].map((m) => m.group), ...[...crafts.values()].filter((c) => c.group.visible).map((c) => c.group), ...(satPoints?.visible ? [satPoints] : [])],
        true,
      );
      for (const h of hits) {
        if (!shown(h.object)) continue;
        if (h.object.userData.site) {
          selectSite(h.object.userData.site);
          return;
        }
        if (h.object === satPoints && h.index != null) {
          showSatInfo(h.index);
          return;
        }
        const id = h.object.userData.id as string | undefined;
        if (id) {
          focus(id);
          return;
        }
      }
    });

    // zoom into Earth → weather map
    renderer.domElement.addEventListener(
      'wheel',
      (e) => {
        if (focusId !== 'earth' || trans || e.deltaY >= 0) return;
        const earth = byId.get('earth')!;
        if (camera.position.length() < radiusAU(earth) * 1.45) openEarthMap();
      },
      { passive: true },
    );

    // the user takes over: stop any automatic camera swing
    controls.addEventListener('start', () => (aim = null));

    new ResizeObserver(resize).observe(el);
    resize();
  }

  const shown = (o: THREE.Object3D | null) => {
    for (; o; o = o.parent) if (!o.visible) return false;
    return true;
  };

  function glowTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,240,200,1)');
    grad.addColorStop(0.2, 'rgba(255,210,120,0.6)');
    grad.addColorStop(0.5, 'rgba(255,170,60,0.15)');
    grad.addColorStop(1, 'rgba(255,150,40,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  function resize() {
    if (!renderer) return;
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  // ----- focus & camera ----------------------------------------------------
  function viewDistance(b: Body) {
    if (b.kind === 'star') return radiusAU(b) * 8;
    if (b.kind === 'craft') return b.model ? radiusAU(b) * 5 : 0.002;
    return radiusAU(b) * 4;
  }

  function minDistance(b: Body) {
    if (b.kind === 'craft') return b.model ? radiusAU(b) * 1.3 : 1e-6;
    // the Moon has close-up tiles, so it may be approached to ≈ 20 km altitude
    return radiusAU(b) * (b.id === 'earth' ? 1.3 : b.id === 'moon' ? 1.012 : 1.15);
  }

  function focus(id: string, dist?: number) {
    const b = byId.get(id);
    if (!b) return;
    const p = resolve(id, simTime);
    if (!p) {
      toast(`${b.name} existiert zum gewählten Zeitpunkt noch nicht (oder die Position ist unbekannt).`);
      return;
    }
    const from = origin;
    trans = { from, to: id, t0: performance.now(), dur: 1600, d0: camera.position.length(), d1: dist ?? viewDistance(b) };
    focusId = id;
    siteId = null;
    aim = null;
    if (moonDetail) moonDetail.selected = null;
    controls.minDistance = 0;
    renderInfo();
    renderList();
    updateHash();
  }

  /** Fly to a landing site on the Moon and show its info. */
  function selectSite(id: string) {
    const s = LANDING_SITES.find((x) => x.id === id);
    if (!s) return;
    const R = radiusAU(byId.get('moon')!);
    const far = focusId !== 'moon';
    if (far) focus('moon', R * 1.6);
    siteId = id;
    if (moonDetail) moonDetail.selected = id;
    // keep the altitude if already closer than the default
    const d = far ? R * 1.6 : camera.position.length();
    aim = { from: camera.position.clone().normalize(), lat: s.lat, lon: s.lon, t0: performance.now(), dur: 1800, d0: d, d1: Math.min(d, R * 1.6) };
    renderInfo();
    updateHash();
  }

  function overview() {
    trans = { from: origin, to: 'sun', t0: performance.now(), dur: 1800, d0: camera.position.length(), d1: 45 };
    focusId = 'sun';
    siteId = null;
    aim = null;
    controls.minDistance = 0;
    renderInfo();
    renderList();
    updateHash();
  }

  function updateHash() {
    const h = `#/weltall?focus=${focusId}${siteId ? `&site=${siteId}` : ''}`;
    if (location.hash !== h) history.replaceState(null, '', h);
  }

  /** Direction (three.js, world) of a geographic point on a body for the current time. */
  function surfaceDirOf(id: string, lat: number, lon: number) {
    const m = meshes.get(id)!;
    m.group.updateMatrixWorld(true);
    const mesh = m.spin.children[0];
    return surfaceDir(lat, lon).applyQuaternion(mesh.getWorldQuaternion(new THREE.Quaternion())).normalize();
  }
  const pxPerRad = () => el.clientHeight / 2 / Math.tan((camera.fov * Math.PI) / 360);

  function openEarthMap() {
    const m = meshes.get('earth')!;
    const mesh = m.spin.children[0];
    // the focused body sits at the scene origin, so the camera position is relative to it
    const local = mesh.worldToLocal(camera.position.clone()).normalize();
    // inverse of SphereGeometry parametrisation
    const lat = 90 - (Math.acos(Math.max(-1, Math.min(1, local.y))) * 180) / Math.PI;
    let lon = (Math.atan2(local.z, -local.x) * 180) / Math.PI - 180;
    lon = ((lon + 540) % 360) - 180;
    onOpenEarthMap(lat, lon);
  }

  // ----- per-frame update --------------------------------------------------
  function update(now: number) {
    const dt = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 0;
    lastFrame = now;
    if (playing) simTime += dt * 1000 * SPEEDS[speedIdx].f;
    frameCache = new Map();

    // origin (with smooth transition between focus targets)
    const target = resolve(focusId, simTime) ?? origin;
    if (trans) {
      const k = Math.min(1, (now - trans.t0) / trans.dur);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      origin = [trans.from[0] + (target[0] - trans.from[0]) * e, trans.from[1] + (target[1] - trans.from[1]) * e, trans.from[2] + (target[2] - trans.from[2]) * e];
      const d = Math.exp(Math.log(trans.d0) + (Math.log(trans.d1) - Math.log(trans.d0)) * e);
      camera.position.setLength(d);
      if (k >= 1) {
        trans = null;
        controls.minDistance = minDistance(byId.get(focusId)!);
      }
    } else {
      origin = target;
    }

    const tmp = new THREE.Vector3();
    // bodies
    for (const [id, m] of meshes) {
      const p = resolve(id, simTime);
      m.group.visible = !!p;
      if (!p) continue;
      toThree(sub(p, origin), m.group.position);
      const b = m.body;
      if (id === 'earth') m.spin.rotation.y = gmst(simTime);
      else if (id === 'moon') {
        const g = moonGeocentric(simTime);
        const d = toThree([-g[0], -g[1], -g[2]], tmp);
        m.spin.rotation.y = Math.atan2(-d.z, d.x);
      } else if (b.rotationHours) m.spin.rotation.y = ((simTime / 3600000 / b.rotationHours) % 1) * 2 * Math.PI;
    }

    if (aim) {
      const k = Math.min(1, (now - aim.t0) / aim.dur);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      const to = surfaceDirOf('moon', aim.lat, aim.lon);
      const q = new THREE.Quaternion().setFromUnitVectors(aim.from, to);
      const dir = aim.from.clone().applyQuaternion(new THREE.Quaternion().slerp(q, e));
      // during a focus transition that one sets the distance
      const d = trans ? camera.position.length() : Math.exp(Math.log(aim.d0) + (Math.log(aim.d1) - Math.log(aim.d0)) * e);
      camera.position.copy(dir.multiplyScalar(d));
      if (k >= 1 && !trans) aim = null;
    }
    toThree(sub([0, 0, 0], origin), sunLight.position);

    // close-up lighting: fade from sun to fixed directional light (Google Maps style)
    const focusBody = byId.get(focusId)!;
    if (focusBody.kind !== 'star') {
      const camDist = camera.position.length();
      const bodyR = radiusAU(focusBody);
      const closeStart = bodyR * 12;
      const closeEnd = bodyR * 3;
      const closeness = Math.max(0, Math.min(1, (closeStart - camDist) / (closeStart - closeEnd)));
      sunLight.intensity = 3.2 * (1 - closeness);
      ambientLight.intensity = 0.07 + 0.5 * closeness;
      viewLight.intensity = 2.5 * closeness;
      const lightDir = new THREE.Vector3(-0.5, 0.8, 0.3).applyQuaternion(camera.quaternion);
      viewLight.position.copy(lightDir);
      viewLight.target.position.set(0, 0, 0);
      viewLight.target.updateMatrixWorld();
    } else {
      sunLight.intensity = 3.2;
      ambientLight.intensity = 0.07;
      viewLight.intensity = 0;
    }

    // orbit lines (rebuilt when time moved far)
    for (const b of BODIES) {
      if (!b.orbit) continue;
      let o = orbitLines.get(b.id);
      if (!o || Math.abs(o.at - simTime) > 180 * 86400000) {
        if (o) world.remove(o.line);
        const pts = orbitPath(b.id, simTime).map((v) => toThree(v));
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color: b.color, transparent: true, opacity: 0.35 }),
        );
        world.add(line);
        o = { line, at: simTime };
        orbitLines.set(b.id, o);
      }
      o.line.visible = opts.orbits;
      toThree(sub([0, 0, 0], origin), o.line.position);
    }
    updateMoonOrbits();
    updateTrails();
    updateSatellites(now);
    updateCraftModels();

    adaptControls();
    controls.update();
    moonDetail?.update(camera, simTime, pxPerRad(), opts.sites);
    renderSplit();
    updateLabels();
    moonDetail?.updateLabels(camera, el.clientWidth, el.clientHeight, opts.labels);
    updateClock();
    if (!trans && now % 500 < 20) renderLiveInfo();
  }

  /** Near a surface, zoom and rotate in proportion to the altitude instead of the distance. */
  function adaptControls() {
    const b = byId.get(focusId)!;
    if (b.kind === 'craft' || trans) {
      controls.zoomSpeed = 1.6;
      controls.rotateSpeed = 0.6;
      return;
    }
    const r = radiusAU(b);
    const d = camera.position.length();
    const alt = Math.max(1e-12, d - r);
    controls.zoomSpeed = 1.6 * Math.min(1, (2.5 * alt) / d);
    controls.rotateSpeed = 0.6 * Math.min(1, alt / (2.5 * r));
  }

  /**
   * Depth precision: scene units are AU, so a spacecraft is ~1e-10 units big – far below what
   * a (logarithmic) depth buffer can resolve in 32-bit floats (1 + 1e-10 == 1). Each frame the
   * world is therefore rescaled so the camera sits at distance 1 from the focus, and drawn in
   * two depth ranges (far: planets/orbits, near: whatever is close, e.g. a model).
   */
  function renderSplit() {
    const r = renderer!;
    const dist = Math.max(1e-14, camera.position.length());
    const k = 1 / dist;
    const camPos = camera.position.clone();
    world.scale.setScalar(k);
    world.updateMatrixWorld(true);
    camera.position.multiplyScalar(k);
    camera.updateMatrixWorld();
    const SPLIT = 60;
    r.autoClear = false;
    r.clear();
    camera.near = SPLIT;
    camera.far = Math.max(SPLIT * 10, 6000 * k);
    camera.updateProjectionMatrix();
    r.render(scene, camera);
    r.clearDepth();
    const bg = scene.background;
    scene.background = null;
    camera.near = 1e-4;
    camera.far = SPLIT * 1.001;
    camera.updateProjectionMatrix();
    r.render(scene, camera);
    scene.background = bg;
    // back to AU units for label projection, picking and controls
    world.scale.setScalar(1);
    world.updateMatrixWorld(true);
    camera.position.copy(camPos);
    camera.near = dist * 1e-4;
    camera.far = 6000;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  function updateMoonOrbits() {
    const focusBody = byId.get(focusId)!;
    const parentOfInterest = focusBody.kind === 'moon' ? focusBody.parent : focusId;
    for (const b of BODIES) {
      if (b.kind !== 'moon' || !b.parent) continue;
      const show = opts.orbits && b.parent === parentOfInterest;
      let line = moonLines.get(b.id);
      if (!show) {
        if (line) line.visible = false;
        continue;
      }
      const parent = resolve(b.parent, simTime)!;
      if (!line) {
        line = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x8899bb, transparent: true, opacity: 0.4 }));
        world.add(line);
        moonLines.set(b.id, line);
      }
      // sample the moon's own motion over one orbit, relative to its planet
      const P = (b.periodDays ?? 1) * 86400000;
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= 96; k++) {
        const t = simTime + (k / 96) * P;
        const pp = resolve(b.parent, t);
        const mp = resolve(b.id, t);
        if (pp && mp) pts.push(toThree(sub(mp, pp)));
      }
      line.geometry.setFromPoints(pts);
      line.visible = true;
      toThree(sub(parent, origin), line.position);
    }
  }

  function updateTrails() {
    for (const c of CRAFT) {
      const days = TRAIL_DAYS[c.id];
      if (!days) continue;
      let t = trails.get(c.id);
      if (!t || Math.abs(t.at - simTime) > 20 * 86400000) {
        if (t) world.remove(t.line);
        const pts: THREE.Vector3[] = [];
        const span = days * 86400000;
        for (let k = 0; k <= 240; k++) {
          const ms = simTime - span + (k / 240) * span;
          const p = c.position(ms, (pid) => resolve(pid, ms) ?? [0, 0, 0]);
          if (p) pts.push(toThree(p));
        }
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color: c.color, transparent: true, opacity: 0.55 }),
        );
        world.add(line);
        t = { line, at: simTime };
        trails.set(c.id, t);
      }
      t.line.visible = opts.craft && pts0(t.line);
      toThree(sub([0, 0, 0], origin), t.line.position);
    }
  }
  const pts0 = (l: THREE.Line) => (l.geometry.getAttribute('position')?.count ?? 0) > 1;

  function ensureSats() {
    if (sats.length || satsLoading) return;
    satsLoading = true;
    loadSatellites()
      .then((s) => {
        sats = s;
        satById = new Map(s.map((x) => [x.id, x]));
      })
      .catch(() => toast('Satellitendaten (CelesTrak) konnten nicht geladen werden.'))
      .finally(() => (satsLoading = false));
  }
  let satById = new Map<string, Sat>();
  setSatLookup((norad, ms) => {
    const s = satById.get(norad);
    if (!s) return null;
    const pv = propagate(s.satrec, new Date(ms));
    if (!pv || typeof pv.position !== 'object') return null;
    const earth = resolve('earth', ms);
    if (!earth) return null;
    const e = eciToEcliptic([pv.position.x, pv.position.y, pv.position.z]);
    return [earth[0] + e[0], earth[1] + e[1], earth[2] + e[2]];
  });

  function updateSatellites(now: number) {
    const earth = resolve('earth', simTime)!;
    const near = len(sub(origin, earth)) < 0.02 && opts.sats;
    if (!satPoints) return;
    satPoints.visible = near && sats.length > 0;
    if (!near) return;
    ensureSats();
    if (!sats.length) return;
    if (now - (satPoints.userData.at ?? 0) < 250) {
      toThree(sub(earth, origin), satPoints.position);
      return;
    }
    satPoints.userData.at = now;
    const date = new Date(simTime);
    const arr = new Float32Array(sats.length * 3);
    satPositions = [];
    sats.forEach((s, i) => {
      const pv = propagate(s.satrec, date);
      const pos = pv && typeof pv.position === 'object' ? eciToEcliptic([pv.position.x, pv.position.y, pv.position.z]) : ([1e9, 0, 0] as Vec3);
      satPositions.push(pos);
      const v = toThree(pos);
      arr.set([v.x, v.y, v.z], i * 3);
    });
    satPoints.geometry.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    satPoints.geometry.computeBoundingSphere();
    toThree(sub(earth, origin), satPoints.position);
  }

  function showSatInfo(i: number) {
    const s = sats[i];
    if (!s) return;
    const p = satPositions[i];
    const h = p ? len(p) * AU_KM - 6371 : 0;
    info.hidden = false;
    info.innerHTML = `<button class="sp-close" aria-label="Schließen">×</button>
      <div class="sp-kind">Erdsatellit · NORAD ${escapeHtml(s.id)}</div>
      <h2>${escapeHtml(s.name)}</h2>
      <dl><dt>Höhe</dt><dd>${fmt.num(h, 0)} km</dd></dl>
      <p class="small muted">Bahndaten: CelesTrak. Auf der Wetterkarte (Ebene „Satelliten“) ist auch die Bodenspur sichtbar.</p>`;
    info.querySelector('.sp-close')!.addEventListener('click', () => renderInfo());
  }

  // ----- labels ------------------------------------------------------------
  const v3 = new THREE.Vector3();
  const v3b = new THREE.Vector3();
  function screenOf(p: Vec3 | null) {
    if (!p) return null;
    toThree(sub(p, origin), v3).project(camera);
    if (v3.z > 1 || v3.z < -1) return null;
    return { x: (v3.x * 0.5 + 0.5) * el.clientWidth, y: (-v3.y * 0.5 + 0.5) * el.clientHeight };
  }

  function updateLabels() {
    const screen = new Map<string, { x: number; y: number } | null>();
    for (const b of ALL) screen.set(b.id, screenOf(resolve(b.id, simTime)));
    // the focused body hides labels of everything behind it
    const fb = byId.get(focusId)!;
    const fs = screen.get(focusId);
    const camDist = camera.position.length();
    const fr = fb.kind === 'craft' ? 0 : camDist > radiusAU(fb) ? (Math.tan(Math.asin(radiusAU(fb) / camDist)) * el.clientHeight) / 2 / Math.tan((camera.fov * Math.PI) / 360) : Infinity;
    for (const b of ALL) {
      const d = labels.get(b.id)!;
      const s = screen.get(b.id);
      let show = !!s && opts.labels;
      if (show && fs && b.id !== focusId && Math.hypot(s!.x - fs.x, s!.y - fs.y) < fr) {
        const p = resolve(b.id, simTime)!;
        if (toThree(sub(p, origin), v3b).distanceTo(camera.position) > camDist) show = false;
      }
      if (b.kind === 'craft' && !opts.craft) show = false;
      if (show && b.parent) {
        // hide moons (and craft at planets) until they separate from their planet on screen
        const ps = screen.get(b.parent);
        if (ps && Math.hypot(ps.x - s!.x, ps.y - s!.y) < 22) show = false;
      }
      if (show && b.kind === 'craft' && ['juno', 'perseverance', 'curiosity', 'jwst', 'soho'].includes(b.id)) {
        const host = b.id === 'juno' ? 'jupiter' : b.id === 'jwst' || b.id === 'soho' ? 'earth' : 'mars';
        const ps = screen.get(host);
        if (ps && Math.hypot(ps.x - s!.x, ps.y - s!.y) < 22) show = false;
      }
      if (b.id === focusId) show = !!s;
      // no label on top of a body that already fills part of the screen
      if (show && (b.kind !== 'craft' || b.model)) {
        const p = resolve(b.id, simTime)!;
        const dist = toThree(sub(p, origin), v3b).distanceTo(camera.position);
        const px = (radiusAU(b) / dist) * (el.clientHeight / 2) / Math.tan((camera.fov * Math.PI) / 360);
        if (px > 40) show = false;
      }
      d.hidden = !show;
      if (show) {
        d.style.transform = `translate(${s!.x}px, ${s!.y}px)`;
        d.classList.toggle('focused', b.id === focusId);
      }
    }
  }

  // ----- UI ----------------------------------------------------------------
  function updateClock() {
    const d = new Date(simTime);
    dateEl.textContent = d.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: speedIdx === REALTIME ? '2-digit' : undefined });
    speedEl.textContent = playing ? SPEEDS[speedIdx].label : 'angehalten';
  }

  function setPlaying(p: boolean) {
    playing = p;
    playBtn.innerHTML = p
      ? '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z"/></svg>';
    playBtn.setAttribute('aria-label', p ? 'Pause' : 'Abspielen');
  }

  el.querySelector('.space-time')!.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-t]')?.dataset.t;
    if (t === 'play') setPlaying(!playing);
    else if (t === 'slower') {
      speedIdx = Math.max(0, speedIdx - 1);
      setPlaying(true);
    } else if (t === 'faster') {
      speedIdx = Math.min(SPEEDS.length - 1, speedIdx + 1);
      setPlaying(true);
    } else if (t === 'now') {
      simTime = Date.now();
      speedIdx = REALTIME;
      setPlaying(true);
    } else if (t === 'overview') overview();
  });
  dateInput.addEventListener('change', () => {
    const ms = Date.parse(dateInput.value);
    if (Number.isFinite(ms)) {
      simTime = ms;
      setPlaying(false);
    }
  });

  el.querySelectorAll<HTMLInputElement>('input[data-opt]').forEach((i) =>
    i.addEventListener('change', () => {
      opts[i.dataset.opt as keyof typeof opts] = i.checked;
    }),
  );
  el.querySelector('.space-list-toggle')!.addEventListener('click', () => (listPanel.hidden = !listPanel.hidden));
  filterEl.addEventListener('input', renderList);

  function renderList() {
    const q = filterEl.value.trim().toLowerCase();
    const groups: [string, Body[]][] = [
      ['Sonne & Planeten', ALL.filter((b) => b.kind === 'star' || b.kind === 'planet' || b.kind === 'dwarf')],
      ['Monde', ALL.filter((b) => b.kind === 'moon')],
      ['Raumsonden', ALL.filter((b) => b.kind === 'craft')],
    ];
    listEl.innerHTML = groups
      .map(([title, items]) => {
        const f = items.filter((b) => !q || b.name.toLowerCase().includes(q));
        if (!f.length) return '';
        return `<h3>${title}</h3>${f
          .map(
            (b) => `<button class="sp-item ${b.id === focusId ? 'on' : ''}" data-id="${b.id}">
              <span class="sp-dot" style="background:${b.color}"></span>${escapeHtml(b.name)}${b.parent ? `<small>${escapeHtml(byId.get(b.parent)?.name ?? '')}</small>` : ''}</button>`,
          )
          .join('')}`;
      })
      .join('');
    listEl.querySelectorAll<HTMLButtonElement>('.sp-item').forEach((b) =>
      b.addEventListener('click', () => {
        focus(b.dataset.id!);
        if (window.innerWidth <= 720) listPanel.hidden = true;
      }),
    );
  }

  function distanceText(au: number) {
    if (au < 0.01) return `${fmt.num(au * AU_KM, 0)} km`;
    return `${fmt.num(au, au < 10 ? 3 : 1)} AE (${fmt.num((au * AU_KM) / 1e6, au < 10 ? 1 : 0)} Mio. km)`;
  }

  function lightTime(au: number) {
    const s = (au * AU_KM) / 299_792.458;
    if (s < 60) return `${fmt.num(s, 1)} s`;
    if (s < 3600) return `${fmt.num(s / 60, 1)} min`;
    return `${fmt.num(s / 3600, 1)} h`;
  }

  function renderSiteInfo(id: string) {
    const s = LANDING_SITES.find((x) => x.id === id)!;
    const dt = new Date(s.date);
    const when = `${dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })}, ${dt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} UTC`;
    const coord = `${fmt.num(Math.abs(s.lat), 2)}° ${s.lat >= 0 ? 'N' : 'S'}, ${fmt.num(Math.abs(s.lon), 2)}° ${s.lon >= 0 ? 'O' : 'W'}`;
    const rows: [string, string][] = [
      ['Landung', when],
      ['Nation', COUNTRY[s.flag]],
      ...(s.crew ? [['Besatzung', s.crew] as [string, string]] : []),
      ...(s.craft ? [[s.crewed ? 'Fahrzeug' : 'Mission', s.craft] as [string, string]] : []),
      ['Ort', s.region],
      ['Koordinaten', (s.approx ? '≈ ' : '') + coord],
    ];
    const years = (Date.now() - dt.getTime()) / (365.25 * 86400000);
    info.hidden = false;
    info.innerHTML = `<button class="sp-close" aria-label="Schließen">×</button>
      <div class="sp-kind">${s.crewed ? 'Bemannte Mondlandung' : 'Mondlandung (robotisch)'}</div>
      <h2 class="sp-site-title"><img class="sp-flag" src="${flagDataUrl(s.flag)}" alt="Flagge ${escapeHtml(COUNTRY[s.flag])}"/>${escapeHtml(s.name)}</h2>
      <p>${escapeHtml(s.text)}</p>
      <dl>${rows.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join('')}</dl>
      ${simTime < dt.getTime() ? '<p class="small note">Zum gewählten Zeitpunkt ist hier noch niemand gelandet.</p>' : years >= 1 ? `<p class="small muted">Vor ${fmt.num(years, 0)} Jahren.</p>` : ''}
      <div class="sp-actions">
        <button class="btn small" data-a="moon">← Mond</button>
        <a class="btn small" href="https://de.wikipedia.org/w/index.php?search=${encodeURIComponent(s.name.replace(/ \(.*\)$/, ''))}" target="_blank" rel="noopener">Wikipedia ↗</a>
      </div>`;
    info.querySelector('.sp-close')!.addEventListener('click', () => (info.hidden = true));
    info.querySelector('[data-a=moon]')!.addEventListener('click', () => {
      siteId = null;
      if (moonDetail) moonDetail.selected = null;
      renderInfo();
      updateHash();
    });
  }

  function renderInfo() {
    if (siteId && focusId === 'moon') return renderSiteInfo(siteId);
    const b = byId.get(focusId)!;
    info.hidden = false;
    const trekLinks: Record<string, [string, string]> = {
      moon: ['https://trek.nasa.gov/moon/', 'NASA Moon Trek'],
      mars: ['https://trek.nasa.gov/mars/', 'NASA Mars Trek'],
      mercury: ['https://trek.nasa.gov/mercury/', 'NASA Mercury Trek'],
      venus: ['https://trek.nasa.gov/venus/', 'NASA Venus Trek'],
    };
    const trek = trekLinks[b.id];
    const extLink = trek
      ? `<a class="btn small" href="${trek[0]}" target="_blank" rel="noopener">Detailkarte (${trek[1]}) ↗</a>`
      : '';
    info.innerHTML = `<button class="sp-close" aria-label="Schließen">×</button>
      <div class="sp-kind">${KIND_LABEL[b.kind]}${b.parent ? ` · ${escapeHtml(byId.get(b.parent)?.name ?? '')}` : ''}</div>
      <h2>${escapeHtml(b.name)}</h2>
      ${b.description ? `<p>${escapeHtml(b.description)}</p>` : ''}
      <dl class="sp-live"></dl>
      ${b.facts ? `<dl>${b.facts.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join('')}</dl>` : ''}
      ${b.approx ? '<p class="small note">Position/Flugbahn angenähert.</p>' : ''}
      ${
        b.id === 'moon'
          ? `<h3 class="sp-sub">Landestellen</h3><div class="sp-sites">${LANDING_SITES.map(
              (s) => `<button class="sp-site${s.crewed ? ' crewed' : ''}" data-site="${s.id}"><img src="${flagDataUrl(s.flag)}" alt=""/>${escapeHtml(s.name)}</button>`,
            ).join('')}</div>`
          : ''
      }
      ${b.model ? `<p class="small muted">3D-Modell: NASA 3D Resources${b.model.note ? ` · ${escapeHtml(b.model.note)}` : ''}${
        crafts.get(b.id)?.state === 'loading' ? ' · wird geladen …' : crafts.get(b.id)?.state === 'error' ? ' · konnte nicht geladen werden' : crafts.get(b.id)?.detail === 'loading' ? ' · Detailmodell wird geladen …' : ''
      }</p>` : ''}
      <div class="sp-actions">
        ${b.id === 'earth' ? '<button class="btn small" data-a="map">Wetterkarte öffnen</button>' : ''}
        ${extLink}
      </div>`;
    info.querySelector('.sp-close')!.addEventListener('click', () => (info.hidden = true));
    info.querySelector('[data-a=map]')?.addEventListener('click', openEarthMap);
    info.querySelectorAll<HTMLButtonElement>('[data-site]').forEach((btn) => btn.addEventListener('click', () => selectSite(btn.dataset.site!)));
    renderLiveInfo();
  }

  function renderLiveInfo() {
    const dl = info.querySelector('.sp-live');
    if (!dl) return;
    const b = byId.get(focusId)!;
    const p = resolve(focusId, simTime);
    if (!p) return;
    const earth = resolve('earth', simTime)!;
    const rows: [string, string][] = [];
    if (b.kind !== 'star') rows.push(['Abstand zur Sonne', distanceText(len(p))]);
    if (b.id !== 'earth') {
      const d = len(sub(p, earth));
      rows.push(['Abstand zur Erde', distanceText(d)], ['Lichtlaufzeit von der Erde', lightTime(d)]);
    }
    dl.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  }

  // ----- lifecycle ---------------------------------------------------------
  function loop(now: number) {
    if (!active) return;
    raf = requestAnimationFrame(loop);
    update(now);
  }

  return {
    el,
    activate(o = {}) {
      if (!renderer) {
        init();
        renderList();
      }
      active = true;
      resize();
      const site = o.site && LANDING_SITES.some((s) => s.id === o.site) ? o.site : undefined;
      const id = site ? 'moon' : o.focus && byId.has(o.focus) ? o.focus : 'earth';
      focusId = id;
      frameCache = new Map();
      origin = resolve(id, simTime) ?? [0, 0, 0];
      const b = byId.get(id)!;
      if (id === 'earth' && o.lat != null && o.lon != null) {
        // coming from the weather map: start close above that spot and pull back
        update(performance.now());
        const dir = surfaceDirOf('earth', o.lat, o.lon);
        camera.position.copy(dir.multiplyScalar(radiusAU(b) * 1.6));
        controls.update();
        trans = { from: origin, to: id, t0: performance.now(), dur: 2200, d0: radiusAU(b) * 1.6, d1: radiusAU(b) * 9 };
      } else if (camera.position.lengthSq() === 0) {
        camera.position.set(0, radiusAU(b) * 1.5, radiusAU(b) * 4);
        controls.minDistance = minDistance(b);
      }
      if (site) {
        update(performance.now());
        selectSite(site);
      }
      renderInfo();
      renderList();
      lastFrame = 0;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    },
    deactivate() {
      active = false;
      cancelAnimationFrame(raf);
    },
  };
}
