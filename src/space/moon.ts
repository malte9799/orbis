import * as THREE from 'three';

// Moon details: sharper global textures (NASA CGI Moon Kit, prepared by the deploy workflow),
// streamed close-up tiles (NASA Moon Trek, LRO WAC mosaic ≈ 100 m/px) and flags at the
// landing sites. Everything hangs below the moon mesh (a unit sphere scaled to the radius),
// so all lengths here are in moon radii.

export type FlagKind = 'us' | 'su' | 'cn' | 'in' | 'jp' | 'eu';

export interface LandingSite {
  id: string;
  name: string;
  flag: FlagKind;
  /** landing time (UTC) */
  date: string;
  lat: number;
  lon: number;
  crewed?: boolean;
  crew?: string;
  craft?: string;
  region: string;
  text: string;
  approx?: boolean;
  /** body the site belongs to (default: the Moon) */
  body?: string;
  /** a rover model stands here: label only, no flag */
  hideFlag?: boolean;
}

export const COUNTRY: Record<FlagKind, string> = { us: 'USA', su: 'Sowjetunion', cn: 'China', in: 'Indien', jp: 'Japan', eu: 'Europa' };

export const LANDING_SITES: LandingSite[] = [
  {
    id: 'apollo11',
    name: 'Apollo 11',
    flag: 'us',
    date: '1969-07-20T20:17Z',
    lat: 0.67408,
    lon: 23.47297,
    crewed: true,
    crew: 'Neil Armstrong, Buzz Aldrin (im Orbit: Michael Collins)',
    craft: 'Mondfähre „Eagle“',
    region: 'Mare Tranquillitatis (Meer der Ruhe)',
    text: 'Die erste bemannte Mondlandung. „Das ist ein kleiner Schritt für einen Menschen, aber ein riesiger Sprung für die Menschheit.“ Der Laser-Reflektor wird bis heute zur Entfernungsmessung genutzt.',
  },
  {
    id: 'apollo12',
    name: 'Apollo 12',
    flag: 'us',
    date: '1969-11-19T06:54Z',
    lat: -3.01239,
    lon: -23.42157,
    crewed: true,
    crew: 'Pete Conrad, Alan Bean',
    craft: 'Mondfähre „Intrepid“',
    region: 'Oceanus Procellarum (Ozean der Stürme)',
    text: 'Punktlandung nur 180 m neben der Sonde Surveyor 3 – Teile davon nahm die Crew mit zur Erde.',
  },
  {
    id: 'apollo14',
    name: 'Apollo 14',
    flag: 'us',
    date: '1971-02-05T09:18Z',
    lat: -3.6453,
    lon: -17.47136,
    crewed: true,
    crew: 'Alan Shepard, Edgar Mitchell',
    craft: 'Mondfähre „Antares“',
    region: 'Fra-Mauro-Hochland',
    text: 'Alan Shepard schlug hier mit einem improvisierten Schläger zwei Golfbälle.',
  },
  {
    id: 'apollo15',
    name: 'Apollo 15',
    flag: 'us',
    date: '1971-07-30T22:16Z',
    lat: 26.13222,
    lon: 3.63386,
    crewed: true,
    crew: 'David Scott, James Irwin',
    craft: 'Mondfähre „Falcon“, erstes Mondauto',
    region: 'Hadley-Rille am Fuß der Mond-Apenninen',
    text: 'Erstmals mit Mondauto. David Scott ließ Hammer und Feder gleichzeitig fallen – ohne Luft kamen beide gleichzeitig am Boden an.',
  },
  {
    id: 'apollo16',
    name: 'Apollo 16',
    flag: 'us',
    date: '1972-04-21T02:23Z',
    lat: -8.97301,
    lon: 15.50019,
    crewed: true,
    crew: 'John Young, Charles Duke',
    craft: 'Mondfähre „Orion“',
    region: 'Descartes-Hochland',
    text: 'Einzige Landung im zentralen Hochland. Charles Duke ließ ein Foto seiner Familie auf dem Mond zurück.',
  },
  {
    id: 'apollo17',
    name: 'Apollo 17',
    flag: 'us',
    date: '1972-12-11T19:54Z',
    lat: 20.1908,
    lon: 30.77168,
    crewed: true,
    crew: 'Eugene Cernan, Harrison Schmitt',
    craft: 'Mondfähre „Challenger“',
    region: 'Taurus-Littrow-Tal',
    text: 'Die bisher letzten Menschen auf dem Mond. Harrison Schmitt war als Geologe der erste Wissenschaftler dort.',
  },
  {
    id: 'luna9',
    name: 'Luna 9',
    flag: 'su',
    date: '1966-02-03T18:45Z',
    lat: 7.08,
    lon: -64.37,
    region: 'Oceanus Procellarum',
    text: 'Erste weiche Landung auf einem anderen Himmelskörper und erste Fotos von der Mondoberfläche.',
  },
  {
    id: 'surveyor1',
    name: 'Surveyor 1',
    flag: 'us',
    date: '1966-06-02T06:17Z',
    lat: -2.474,
    lon: -43.339,
    region: 'Oceanus Procellarum',
    text: 'Erste weiche Mondlandung der USA – Generalprobe für Apollo.',
  },
  {
    id: 'luna16',
    name: 'Luna 16',
    flag: 'su',
    date: '1970-09-20T05:18Z',
    lat: -0.513,
    lon: 56.364,
    region: 'Mare Fecunditatis',
    text: 'Erste robotische Probenrückführung: 101 g Mondboden kamen zur Erde.',
  },
  {
    id: 'luna17',
    name: 'Luna 17',
    flag: 'su',
    date: '1970-11-17T03:47Z',
    lat: 38.238,
    lon: -35.0,
    craft: 'Rover Lunochod 1',
    region: 'Mare Imbrium',
    text: 'Brachte Lunochod 1 – das erste ferngesteuerte Fahrzeug auf einem anderen Himmelskörper.',
  },
  {
    id: 'luna21',
    name: 'Luna 21',
    flag: 'su',
    date: '1973-01-15T22:35Z',
    lat: 25.85,
    lon: 30.45,
    craft: 'Rover Lunochod 2',
    region: 'Krater Le Monnier',
    text: 'Lunochod 2 fuhr rund 39 km weit – Rekord bis 2014.',
  },
  {
    id: 'luna24',
    name: 'Luna 24',
    flag: 'su',
    date: '1976-08-18T06:36Z',
    lat: 12.714,
    lon: 62.213,
    region: 'Mare Crisium',
    text: 'Letzte sowjetische Mondmission, brachte 170 g Bohrkern zur Erde.',
  },
  {
    id: 'change3',
    name: 'Chang’e 3',
    flag: 'cn',
    date: '2013-12-14T13:11Z',
    lat: 44.121,
    lon: -19.512,
    craft: 'Rover Yutu („Jadehase“)',
    region: 'Mare Imbrium',
    text: 'Die erste weiche Mondlandung seit 37 Jahren.',
  },
  {
    id: 'change4',
    name: 'Chang’e 4',
    flag: 'cn',
    date: '2019-01-03T02:26Z',
    lat: -45.445,
    lon: 177.599,
    craft: 'Rover Yutu-2',
    region: 'Von-Kármán-Krater (Rückseite)',
    text: 'Erste Landung auf der Mondrückseite. Funkkontakt zur Erde nur über den Relaissatelliten Queqiao.',
  },
  {
    id: 'change5',
    name: 'Chang’e 5',
    flag: 'cn',
    date: '2020-12-01T15:11Z',
    lat: 43.058,
    lon: -51.916,
    region: 'Mons Rümker, Oceanus Procellarum',
    text: 'Brachte 1,7 kg Proben zur Erde – das jüngste bisher untersuchte Mondgestein (≈ 2 Mrd. Jahre).',
  },
  {
    id: 'change6',
    name: 'Chang’e 6',
    flag: 'cn',
    date: '2024-06-01T22:23Z',
    lat: -41.639,
    lon: -153.985,
    region: 'Apollo-Becken (Rückseite)',
    text: 'Erste Gesteinsproben von der Mondrückseite (1,9 kg).',
  },
  {
    id: 'chandrayaan3',
    name: 'Chandrayaan-3',
    flag: 'in',
    date: '2023-08-23T12:33Z',
    lat: -69.373,
    lon: 32.319,
    craft: 'Lander Vikram, Rover Pragyan',
    region: 'Südpolregion',
    text: 'Indien landete als vierte Nation auf dem Mond – und als erste nahe dem Südpol.',
  },
  {
    id: 'slim',
    name: 'SLIM',
    flag: 'jp',
    date: '2024-01-19T15:20Z',
    lat: -13.316,
    lon: 25.251,
    region: 'Krater Shioli',
    text: 'Japans „Mondscharfschütze“ landete auf etwa 10 m genau – allerdings kopfüber.',
  },
  {
    id: 'im1',
    name: 'Odysseus (IM-1)',
    flag: 'us',
    date: '2024-02-22T23:23Z',
    lat: -80.13,
    lon: 1.44,
    craft: 'Intuitive Machines',
    region: 'Malapert A, Südpolregion',
    text: 'Erste private Mondlandung; der Lander kippte dabei auf die Seite.',
  },
  {
    id: 'blueghost1',
    name: 'Blue Ghost 1',
    flag: 'us',
    date: '2025-03-02T08:34Z',
    lat: 18.56,
    lon: 61.81,
    craft: 'Firefly Aerospace',
    region: 'Mons Latreille, Mare Crisium',
    text: 'Erste vollständig gelungene private Mondlandung; filmte einen Sonnenuntergang auf dem Mond.',
  },
  {
    id: 'im2',
    name: 'Athena (IM-2)',
    flag: 'us',
    date: '2025-03-06T17:28Z',
    lat: -84.5,
    lon: 29.2,
    approx: true,
    craft: 'Intuitive Machines',
    region: 'Mons Mouton, Südpolregion',
    text: 'Landete am südlichsten Punkt aller bisherigen Missionen, kippte aber in einem Krater um.',
  },
];

/** Unit vector of a selenographic point in the mesh frame (SphereGeometry: longitude 0 at u = 0.5). */
export function surfaceDir(lat: number, lon: number, out = new THREE.Vector3()) {
  const phi = ((lon + 180) * Math.PI) / 180;
  const theta = ((90 - lat) * Math.PI) / 180;
  return out.set(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta));
}

// ----- flags ---------------------------------------------------------------

function drawStar(g: CanvasRenderingContext2D, x: number, y: number, r: number, rot = -Math.PI / 2) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.4 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
}

function drawFlag(kind: FlagKind): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const W = (c.width = 152);
  const H = (c.height = 96);
  const g = c.getContext('2d')!;
  if (kind === 'us') {
    for (let i = 0; i < 13; i++) {
      g.fillStyle = i % 2 ? '#fff' : '#b22234';
      g.fillRect(0, (i * H) / 13, W, H / 13 + 1);
    }
    g.fillStyle = '#3c3b6e';
    g.fillRect(0, 0, W * 0.4, (H * 7) / 13);
    g.fillStyle = '#fff';
    for (let r = 0; r < 5; r++) for (let k = 0; k < 6; k++) drawStar(g, 6 + k * 9.5 + (r % 2) * 4, 6 + r * 9.5, 2.6);
  } else if (kind === 'su') {
    g.fillStyle = '#cc0000';
    g.fillRect(0, 0, W, H);
    g.fillStyle = g.strokeStyle = '#ffd700';
    g.lineWidth = 2;
    drawStar(g, 26, 13, 6);
    // sickle
    g.lineWidth = 3.5;
    g.beginPath();
    g.arc(26, 34, 10, Math.PI * 0.9, Math.PI * 2.25);
    g.stroke();
    // hammer
    g.beginPath();
    g.moveTo(17, 46);
    g.lineTo(33, 27);
    g.stroke();
    g.fillRect(28, 22, 9, 5);
  } else if (kind === 'cn') {
    g.fillStyle = '#de2910';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#ffde00';
    drawStar(g, 25, 25, 15);
    drawStar(g, 50, 9, 5, 0.3);
    drawStar(g, 60, 19, 5, 0.9);
    drawStar(g, 60, 33, 5, 1.6);
    drawStar(g, 50, 43, 5, 2.1);
  } else if (kind === 'in') {
    ['#ff9933', '#ffffff', '#138808'].forEach((col, i) => {
      g.fillStyle = col;
      g.fillRect(0, (i * H) / 3, W, H / 3 + 1);
    });
    g.strokeStyle = '#000080';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(W / 2, H / 2, 12, 0, Math.PI * 2);
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 12;
      g.moveTo(W / 2 + Math.cos(a) * 12, H / 2 + Math.sin(a) * 12);
      g.lineTo(W / 2 - Math.cos(a) * 12, H / 2 - Math.sin(a) * 12);
    }
    g.stroke();
  } else {
    g.fillStyle = '#fff';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#bc002d';
    g.beginPath();
    g.arc(W / 2, H / 2, H * 0.3, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 2;
  g.strokeRect(1, 1, W - 2, H - 2);
  return c;
}

const flagCanvases = new Map<FlagKind, HTMLCanvasElement>();
const flagCanvas = (k: FlagKind) => {
  let c = flagCanvases.get(k);
  if (!c) flagCanvases.set(k, (c = drawFlag(k)));
  return c;
};
export const flagDataUrl = (k: FlagKind) => flagCanvas(k).toDataURL();

const flagTextures = new Map<FlagKind, THREE.Texture>();
function flagTexture(k: FlagKind) {
  let t = flagTextures.get(k);
  if (!t) {
    t = new THREE.CanvasTexture(flagCanvas(k));
    t.colorSpace = THREE.SRGBColorSpace;
    flagTextures.set(k, t);
  }
  return t;
}

const POLE_MAT = new THREE.MeshBasicMaterial({ color: 0xd8d8d8 });

/** Flag on a pole, 1 unit tall, standing on +y with the cloth in the xy plane. */
function makeFlag(site: LandingSite) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 6), POLE_MAT);
  pole.position.y = 0.5;
  const geo = new THREE.PlaneGeometry(0.62, 0.39, 12, 1);
  // a slight wave in the cloth (Apollo flags hung from a horizontal rod, so they never drooped)
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + 0.31;
    pos.setZ(i, Math.sin(x * 11) * 0.025 * x);
  }
  geo.computeVertexNormals();
  const cloth = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: flagTexture(site.flag), side: THREE.DoubleSide }));
  cloth.position.set(0.31 + 0.018, 0.79, 0);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.64, 5), POLE_MAT);
  rod.rotation.z = Math.PI / 2;
  rod.position.set(0.32, 0.985, 0);
  g.add(pole, cloth, rod);
  g.traverse((o) => (o.userData.site = site.id));
  g.visible = false;
  return g;
}

// ----- close-up tiles (equirectangular WMTS pyramids, see planets.ts) ------

const MAX_LOADS = 6;
const MAX_CACHED = 220;
/**
 * How far tiles float above the base sphere (in radii), growing with the camera altitude:
 * the depth buffer can only tell surfaces apart that are ≈ 1 % of the viewing distance apart.
 */
const tileLift = (altitude: number) => Math.min(4e-3, 1e-8 + 0.02 * altitude);

interface Tile {
  key: string;
  z: number;
  row: number;
  col: number;
  state: 'loading' | 'ready' | 'error';
  mesh?: THREE.Mesh;
}

function tileGeometry(z: number, row: number, col: number) {
  const span = 180 / 2 ** z;
  const lat1 = 90 - row * span;
  const lon0 = -180 + col * span;
  const n = z <= 2 ? 32 : 16;
  const r = 1;
  const pos: number[] = [];
  const uv: number[] = [];
  const uv1: number[] = [];
  const v = new THREE.Vector3();
  for (let iy = 0; iy <= n; iy++) {
    const lat = lat1 - (span * iy) / n;
    for (let ix = 0; ix <= n; ix++) {
      const lon = lon0 + (span * ix) / n;
      surfaceDir(lat, lon, v);
      pos.push(v.x * r, v.y * r, v.z * r);
      uv.push(ix / n, 1 - iy / n);
      uv1.push((lon + 180) / 360, (lat + 90) / 180); // global map, for the shared normal map
    }
  }
  const idx: number[] = [];
  for (let iy = 0; iy < n; iy++)
    for (let ix = 0; ix < n; ix++) {
      const a = iy * (n + 1) + ix + 1;
      const b = iy * (n + 1) + ix;
      const c = (iy + 1) * (n + 1) + ix;
      const d = (iy + 1) * (n + 1) + ix + 1;
      idx.push(a, b, d, b, c, d);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('uv1', new THREE.Float32BufferAttribute(uv1, 2));
  geo.setIndex(idx);
  return geo;
}

// ----- the detail controller ---------------------------------------------------

export interface MoonDetailOptions {
  /** body the detail belongs to ('moon', 'mars') */
  body: string;
  sites: LandingSite[];
  /** tile source per level */
  source: (z: number) => { url: (z: number, row: number, col: number) => string; px: number; maxZ: number; tint?: number };
  /** finest tile level (the last one of the layers) */
  maxZ: number;
  /** tile level the global base texture is as sharp as */
  baseLevel: number;
  /** load the sharper Moon textures (4k/8k + normal map) when zooming in */
  upgradeBase: boolean;
  labelHost: HTMLElement;
  onSite: (id: string) => void;
  maxTextureSize: number;
  anisotropy: number;
}

export class BodyDetail {
  private loader = new THREE.TextureLoader();
  private material: THREE.MeshStandardMaterial;
  private baseStage = 0; // 0: 2k, 1: 4k requested, 2: 8k requested
  private baseLevel: number; // tile level the current base texture is as sharp as
  private normalMapTiles: THREE.Texture | null = null;

  private tiles = new Map<string, Tile>();
  private tileGroup = new THREE.Group();
  /** overlays that follow the surface (rover traverses): scaled like the tiles */
  readonly lineGroup = new THREE.Group();
  private loads = 0;
  private tileOk = 0;
  private tileFail = 0;

  private flags: { site: LandingSite; dir: THREE.Vector3; obj: THREE.Group; label: HTMLDivElement; t: number; shown: boolean }[] = [];
  /** selected landing site (highlighted label) */
  selected: string | null = null;
  /** apparent radius of the body on screen in pixels (0 = hidden) */
  get screen() {
    return this.screenR;
  }

  private camLocal = new THREE.Vector3();
  private p = new THREE.Vector3();
  private v = new THREE.Vector3();
  private q = new THREE.Quaternion();
  private camUp = new THREE.Vector3();
  private bx = new THREE.Vector3();
  private bz = new THREE.Vector3();
  private basis = new THREE.Matrix4();
  private frustum = new THREE.Frustum();
  private sphere = new THREE.Sphere();
  private screenR = 0;

  constructor(
    private mesh: THREE.Mesh,
    private o: MoonDetailOptions,
  ) {
    this.material = mesh.material as THREE.MeshStandardMaterial;
    this.baseLevel = o.baseLevel;
    mesh.add(this.tileGroup);
    mesh.add(this.lineGroup);
    for (const site of o.sites) {
      const obj = makeFlag(site);
      mesh.add(obj);
      const label = document.createElement('div');
      label.className = `sp-label kind-site${site.crewed ? ' crewed' : ''}`;
      label.hidden = true;
      label.innerHTML = `<span class="sp-name">${site.name}</span>`;
      label.addEventListener('click', (e) => {
        e.stopPropagation();
        o.onSite(site.id);
      });
      o.labelHost.appendChild(label);
      this.flags.push({ site, dir: surfaceDir(site.lat, site.lon), obj, label, t: Date.parse(site.date), shown: false });
    }
  }

  // ----- sharper base textures --------------------------------------------
  private loadTex(url: string, srgb: boolean, done: (t: THREE.Texture) => void) {
    this.loader.load(
      url,
      (t) => {
        t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.anisotropy = this.o.anisotropy;
        done(t);
      },
      undefined,
      () => {}, // not deployed (e.g. local dev): keep what we have
    );
  }

  private upgradeBase() {
    if (!this.o.upgradeBase) return;
    const m = this.material;
    if (this.baseStage < 1 && this.screenR > 50) {
      this.baseStage = 1;
      this.loadTex('./textures/moon/lroc-4k.jpg', true, (t) => {
        if (this.baseLevel >= 4) return t.dispose();
        m.map?.dispose();
        m.map = t;
        m.needsUpdate = true;
        this.baseLevel = 3;
      });
      this.loadTex('./textures/moon/normal-4k.jpg', false, (t) => {
        m.normalMap = t;
        m.normalScale.set(1, 1);
        m.needsUpdate = true;
        // the tiles read the same map through their global (second) uv set
        this.normalMapTiles = t.clone();
        this.normalMapTiles.channel = 1;
        for (const tile of this.tiles.values()) this.applyNormal(tile);
      });
    }
    if (this.baseStage < 2 && this.screenR > 800 && this.o.maxTextureSize >= 8192) {
      this.baseStage = 2;
      this.loadTex('./textures/moon/lroc-8k.jpg', true, (t) => {
        m.map?.dispose();
        m.map = t;
        m.needsUpdate = true;
        this.baseLevel = 4;
      });
    }
  }

  private applyNormal(tile: Tile) {
    const mat = tile.mesh?.material as THREE.MeshStandardMaterial | undefined;
    if (!mat || !this.normalMapTiles || mat.normalMap) return;
    mat.normalMap = this.normalMapTiles;
    mat.needsUpdate = true;
  }

  // ----- tiles --------------------------------------------------------------
  private get tilesEnabled() {
    // the tile server is not reachable (offline, blocked, no CORS): stop asking
    return !(this.tileOk === 0 && this.tileFail >= 8);
  }

  private requestTile(z: number, row: number, col: number) {
    const key = `${z}/${row}/${col}`;
    const tile: Tile = { key, z, row, col, state: 'loading' };
    this.tiles.set(key, tile);
    this.loads++;
    const src = this.o.source(z);
    this.loader.load(
      src.url(z, row, col),
      (t) => {
        this.loads--;
        this.tileOk++;
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = this.o.anisotropy;
        const mesh = new THREE.Mesh(tileGeometry(z, row, col), new THREE.MeshStandardMaterial({ map: t, roughness: 1, metalness: 0, color: src.tint ?? 0xffffff }));
        mesh.userData.id = this.o.body;
        mesh.visible = false;
        tile.mesh = mesh;
        tile.state = 'ready';
        this.applyNormal(tile);
        this.tileGroup.add(mesh);
      },
      undefined,
      () => {
        this.loads--;
        this.tileFail++;
        tile.state = 'error';
      },
    );
  }

  /** Quadtree walk: the tiles that would show the visible surface at ≈ 1 texel per pixel. */
  private wantedTiles(pxPerRad: number, camera: THREE.Camera) {
    camera.updateMatrixWorld();
    this.frustum.setFromProjectionMatrix(this.basis.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    const scale = this.mesh.getWorldScale(this.bx).x;
    const sphere = this.sphere;
    const cam = this.camLocal;
    const d = cam.length();
    const camDir = this.v.copy(cam).divideScalar(d);
    const horizon = Math.acos(Math.min(1, 1 / d));
    const out: [number, number, number][] = [];
    const c = new THREE.Vector3();
    const visit = (z: number, row: number, col: number) => {
      const span = 180 / 2 ** z;
      const latC = 90 - (row + 0.5) * span;
      const lonC = -180 + (col + 0.5) * span;
      surfaceDir(latC, lonC, c);
      const ang = Math.acos(Math.max(-1, Math.min(1, c.dot(camDir))));
      // angular radius of the tile (half diagonal), generous near the poles
      const rho = (Math.hypot(span, span * Math.min(1, Math.cos((Math.max(0, Math.abs(latC) - span / 2) * Math.PI) / 180))) / 2) * (Math.PI / 180);
      if (ang - rho > horizon) return;
      sphere.center.copy(c).applyMatrix4(this.mesh.matrixWorld);
      sphere.radius = 2.2 * Math.sin(rho / 2) * scale;
      if (!this.frustum.intersectsSphere(sphere)) return;
      const a = Math.max(0, ang - rho);
      const dist = Math.max(d - 1, Math.sqrt(d * d + 1 - 2 * d * Math.cos(a)));
      const texel = (span * Math.PI) / 180 / this.o.source(z).px;
      const px = (texel / dist) * pxPerRad;
      if (px > 1.3 && z < this.o.maxZ) {
        for (let r = 0; r < 2; r++) for (let k = 0; k < 2; k++) visit(z + 1, row * 2 + r, col * 2 + k);
      } else if (z > this.baseLevel) out.push([z, row, col]);
    };
    for (let col = 0; col < 2; col++) visit(0, 0, col);
    return out;
  }

  private updateTiles(pxPerRad: number, camera: THREE.Camera) {
    for (const t of this.tiles.values()) if (t.mesh) t.mesh.visible = false;
    if (this.screenR < 150 || !this.tilesEnabled) return;
    const wanted = this.wantedTiles(pxPerRad, camera);
    if (wanted.length > 400) return; // looking at the whole moon from close by: the base map does it
    const show = new Set<Tile>();
    const missing: [number, number, number][] = [];
    for (const [z, row, col] of wanted) {
      // the tile itself, or its nearest loaded ancestor while it is loading
      let zz = z;
      let rr = row;
      let cc = col;
      let found: Tile | undefined;
      while (zz > this.baseLevel) {
        const t = this.tiles.get(`${zz}/${rr}/${cc}`);
        if (t?.state === 'ready') {
          found = t;
          break;
        }
        if (!t) missing.push([zz, rr, cc]); // the tile and, so it does not pop in alone, its ancestors
        zz--;
        rr >>= 1;
        cc >>= 1;
      }
      if (found) show.add(found);
    }
    // never draw a tile together with one of its ancestors
    for (const t of show) {
      let zz = t.z - 1;
      let rr = t.row >> 1;
      let cc = t.col >> 1;
      while (zz > this.baseLevel) {
        const a = this.tiles.get(`${zz}/${rr}/${cc}`);
        if (a && show.has(a)) {
          show.delete(t);
          break;
        }
        zz--;
        rr >>= 1;
        cc >>= 1;
      }
    }
    for (const t of show) {
      t.mesh!.visible = true;
      // keep recently used tiles at the end of the LRU order
      this.tiles.delete(t.key);
      this.tiles.set(t.key, t);
    }
    missing.sort((a, b) => a[0] - b[0]);
    for (const [z, row, col] of missing) {
      if (this.loads >= MAX_LOADS) break;
      if (!this.tiles.has(`${z}/${row}/${col}`)) this.requestTile(z, row, col);
    }
    this.evict(show);
  }

  private evict(keep: Set<Tile>) {
    if (this.tiles.size <= MAX_CACHED) return;
    for (const t of this.tiles.values()) {
      if (this.tiles.size <= MAX_CACHED) break;
      if (keep.has(t) || t.state === 'loading') continue;
      if (t.mesh) {
        this.tileGroup.remove(t.mesh);
        t.mesh.geometry.dispose();
        const mat = t.mesh.material as THREE.MeshStandardMaterial;
        mat.map?.dispose();
        mat.dispose();
      }
      this.tiles.delete(t.key);
    }
  }

  // ----- per frame ------------------------------------------------------------
  /** Call after the camera moved and before rendering. */
  update(camera: THREE.Camera, simTime: number, pxPerRad: number, showSites: boolean) {
    this.mesh.updateWorldMatrix(true, false);
    this.mesh.worldToLocal(this.camLocal.copy(camera.position));
    // the camera's up direction in the mesh frame
    this.mesh.getWorldQuaternion(this.q).invert();
    this.camUp.set(0, 1, 0).applyQuaternion(camera.quaternion).applyQuaternion(this.q);
    const d = this.camLocal.length();
    this.screenR = d > 1 ? pxPerRad * Math.tan(Math.asin(1 / d)) : 1e6;
    if (!this.mesh.visible || !this.mesh.parent?.parent?.visible) this.screenR = 0;
    this.upgradeBase();
    const lift = 1 + tileLift(d - 1);
    this.tileGroup.scale.setScalar(lift);
    this.lineGroup.scale.setScalar(1 + (lift - 1) * 1.6 + 1.5e-5);
    this.updateTiles(pxPerRad, camera);

    const n = this.v;
    for (const f of this.flags) {
      const p = this.p.copy(f.dir);
      const facing = p.dot(this.camLocal); // > 1: above the horizon
      f.shown = showSites && simTime >= f.t && this.screenR > 70 && facing > 1.0015;
      f.obj.visible = f.shown && !f.site.hideFlag;
      if (!f.shown) continue;
      // screen-constant size, the crewed landings a little larger
      const px = (f.site.crewed ? 30 : 22) * Math.min(1, Math.max(0.6, this.screenR / 300)) * (f.site.id === this.selected ? 1.25 : 1);
      const dist = this.camLocal.distanceTo(p);
      const size = (px * dist) / pxPerRad;
      f.obj.scale.setScalar(size);
      // Upright on screen with the cloth facing the camera: the pole follows the surface normal
      // as seen by the camera (pointing outwards near the limb) and the screen's up direction
      // where we look straight down onto the site.
      const toCam = this.bz.copy(this.camLocal).sub(p).normalize();
      const up = n.copy(p).addScaledVector(toCam, -p.dot(toCam));
      // seen from above the flag lies in the ground plane: lift it clear of the surface
      f.obj.position.copy(p).multiplyScalar(lift + size * 0.5 * (1 - Math.min(1, up.length())));
      up.addScaledVector(this.camUp.clone().addScaledVector(toCam, -this.camUp.dot(toCam)), 0.35).normalize();
      const x = this.bx.crossVectors(up, toCam).normalize();
      const z = this.bz.crossVectors(x, up);
      f.obj.quaternion.setFromRotationMatrix(this.basis.makeBasis(x, up, z));
    }
  }

  /** HTML labels; call after rendering (world matrices in AU). */
  updateLabels(camera: THREE.Camera, width: number, height: number, labelsOn: boolean) {
    for (const f of this.flags) {
      const sel = f.site.id === this.selected;
      const show = f.shown && (sel || (labelsOn && this.screenR > (f.site.crewed ? 200 : 320)));
      f.label.hidden = !show;
      if (!show) continue;
      const w = f.obj.localToWorld(this.v.set(0, 1.05, 0)).project(camera);
      f.label.style.transform = `translate(${(w.x * 0.5 + 0.5) * width}px, ${(-w.y * 0.5 + 0.5) * height}px)`;
      f.label.classList.toggle('focused', sel);
    }
  }
}

