import * as THREE from 'three';
import { createHiPSLayer, HiPSLayer, type HiPSView } from '../space/hips';
import { radecFromDir } from '../space/healpix';
import { equirectProjection, hammerProjection, sphereProjection, type Projection, type Vec3 } from '../space/projections';

// Sterne-Ansicht mit mehreren Ansichtsarten auf dieselben Daten (DSS2-HiPS, optional NASA Deep Star Map):
//   himmel  Kamera im Mittelpunkt der Himmelskugel, Blick nach außen (wie von der Erde aus)
//   kugel   Himmelsglobus von außen: drehen, Zoom = Abstand zur Oberfläche
//   karte   flache Plattkarte (equirectangular), verschieben + Zoom auf den Cursor
//   allsky  Ganzhimmelskarte (Hammer-Aitoff, flächentreu)
// Kamera in himmel/kugel: freie Quaternion-Rotation (kein festes „oben“).

export type StarsMode = 'himmel' | 'kugel' | 'karte' | 'allsky';

export interface StarsView {
  el: HTMLElement;
  activate(opts?: { ra?: number; dec?: number; fov?: number; mode?: StarsMode; survey?: string }): void;
  deactivate(): void;
}

const TEX_URL = `${import.meta.env.BASE_URL}textures/starmap_2020_4k.jpg`;
// NASA Deep Star Map als Basis-Himmel im Modus „himmel“: sofort sichtbar, bevor die DSS2-Kacheln
// geladen sind, und Rückfall, wenn CDS nicht erreichbar ist. DSS2 liegt als HiPS-Ebene darüber.
const SHOW_BASE_MAP = true;
const FOV_MIN = 0.005; // absolute Untergrenzen; die Kachelauflösung der Karte begrenzt früher (siehe zoomRange)
const FOV_MAX = 100;
const GLOBE_FOV = 35;
const GLOBE_ALT_MIN = 0.0001; // Abstand zur Oberfläche in Kugelradien
const GLOBE_ALT_MAX = 6;
const FLAT_SPAN_MIN = 0.0002; // rad

const MODES: Array<{ id: StarsMode; label: string; title: string }> = [
  { id: 'himmel', label: 'Himmel', title: 'Blick von innen in den Himmel' },
  { id: 'kugel', label: 'Kugel', title: 'Himmelsglobus von außen' },
  { id: 'karte', label: '2D-Karte', title: 'Flache Karte (Plattkarte)' },
  { id: 'allsky', label: 'Ganzer Himmel', title: 'Ganzhimmelskarte (Hammer-Aitoff)' },
];

const BASE_CREDIT = 'Deep Star Maps 2020 · NASA/GSFC SVS (Hipparcos, Tycho-2, Gaia DR2)';

const CDS = 'https://alasky.cds.unistra.fr';
// Alle Karten: CDS-HiPS-Pakete; Daten frei nutzbar mit Quellenangabe (Mellinger u. a. mit Rechtevorbehalt fehlen bewusst).
// maxOrder = native Kachelstufe (0,8″/px bei 9, je Stufe halb so groß); DSS2 liegt immer als Unterlage darunter.
const SURVEYS = [
  {
    id: 'dss', label: 'DSS2', url: `${CDS}/DSS/DSSColor`, maxOrder: 9,
    credit: 'DSS2 © STScI/AAO/Caltech/AURA (CDS HiPS)',
    note: 'DSS2 color: The Digitized Sky Surveys, Space Telescope Science Institute; Platten © AAO, UK SERC/PPARC/AATB, Caltech/Palomar, AURA. Ganzer Himmel, optisch.',
  },
  {
    id: 'sdss', label: 'SDSS DR9', url: `${CDS}/SDSS/DR9/color`, maxOrder: 10,
    credit: 'SDSS DR9 (Sloan Digital Sky Survey, CDS HiPS)',
    note: 'Sloan Digital Sky Survey DR9, Farbkomposit g/r/i. Nur der überdeckte Himmelsteil (vor allem Norden), sonst DSS2.',
  },
  {
    id: 'panstarrs', label: 'Pan-STARRS', url: `${CDS}/Pan-STARRS/DR1/color-i-r-g`, maxOrder: 11,
    credit: 'Pan-STARRS DR1 (PS1 Science Consortium, CDS HiPS)',
    note: 'Pan-STARRS DR1, Farbkomposit i/r/g. Deklination über etwa −30°, sonst DSS2.',
  },
  {
    id: 'desi', label: 'DESI Legacy', url: `${CDS}/DESI-legacy-surveys/DR10/CDS_P_DESI-Legacy-Surveys_DR10_color`, maxOrder: 11,
    credit: 'DESI Legacy Imaging Surveys DR10 (legacysurvey.org, CDS HiPS)',
    note: 'DESI Legacy Imaging Surveys DR10, g/r/i/z-Farbe, sehr scharf. Etwa zwei Drittel des Himmels (Nord und Süd, ohne Milchstraßenebene), sonst DSS2.',
  },
  {
    id: 'decaps', label: 'DECaPS', url: `${CDS}/DECaPS/DR1/color`, maxOrder: 11,
    credit: 'DECaPS DR1 (DECam Plane Survey, NOIRLab/CTIO, CDS HiPS)',
    note: 'DECam Plane Survey DR1, Farbe. Nur die südliche Milchstraßenebene, sonst DSS2.',
  },
  {
    id: 'skymapper', label: 'SkyMapper', url: `${CDS}/Skymapper/DR4/CDS_P_Skymapper_DR4_color`, maxOrder: 10,
    credit: 'SkyMapper DR4 (Australian National University, CDS HiPS)',
    note: 'SkyMapper Southern Survey DR4, i/r/g-Farbe. Südhimmel, sonst DSS2.',
  },
  {
    id: 'twomass', label: '2MASS (IR)', url: `${CDS}/2MASS/Color`, maxOrder: 9,
    credit: '2MASS © Univ. of Massachusetts & IPAC/Caltech (CDS HiPS)',
    note: '2MASS, Nahinfrarot J/H/K. Ganzer Himmel; sieht durch den Staub der Milchstraße.',
  },
  {
    id: 'allwise', label: 'AllWISE (IR)', url: `${CDS}/AllWISE/RGB-W4-W2-W1`, maxOrder: 8,
    credit: 'AllWISE (WISE, NASA/JPL-Caltech/UCLA, IPAC, CDS HiPS)',
    note: 'AllWISE, Mittelinfrarot W1/W2/W4. Ganzer Himmel; zeigt Staub und Sternentstehung.',
  },
  {
    id: 'unwise', label: 'unWISE (IR)', url: `${CDS}/unWISE/color-W2-W1W2-W1`, maxOrder: 8,
    credit: 'unWISE (IPAC/NASA, D. Lang, CDS HiPS)',
    note: 'unWISE, Mittelinfrarot W1/W2, tiefere Neuberechnung der WISE-Daten. Ganzer Himmel.',
  },
  {
    id: 'galex', label: 'GALEX (UV)', url: `${CDS}/GALEX/GALEXGR6_7_color`, maxOrder: 9,
    credit: 'GALEX GR6/7 © NASA/STScI (CDS HiPS)',
    note: 'GALEX, Ultraviolett (FUV/NUV-Komposit). Rund 79 % des Himmels, sonst DSS2.',
  },
] as const;
export type SurveyId = (typeof SURVEYS)[number]['id'];

const D2R = Math.PI / 180;

export function createStarsView(): StarsView {
  const el = document.createElement('div');
  el.className = 'stars-view';
  el.hidden = true;
  el.innerHTML = `
    <canvas class="stars-canvas"></canvas>
    <div class="stars-panel">
      <div class="stars-modes" role="group" aria-label="Ansichtsart">
        ${MODES.map((m) => `<button type="button" data-mode="${m.id}" title="${m.title}">${m.label}</button>`).join('')}
        <span class="stars-sep"></span>
        <button type="button" data-grid title="Koordinatengitter (G)">Gitter</button>
      </div>
      <div class="stars-modes" role="group" aria-label="Himmelskarte">
        ${SURVEYS.map((v) => `<button type="button" data-survey="${v.id}" title="${v.note}">${v.label}</button>`).join('')}
      </div>
    </div>
    <div class="stars-hint" role="status"></div>
    <div class="stars-credit"></div>
  `;
  const canvas = el.querySelector<HTMLCanvasElement>('.stars-canvas')!;
  const hint = el.querySelector<HTMLElement>('.stars-hint')!;
  const creditEl = el.querySelector<HTMLElement>('.stars-credit')!;
  const modeBtns = [...el.querySelectorAll<HTMLButtonElement>('button[data-mode]')];
  const surveyBtns = [...el.querySelectorAll<HTMLButtonElement>('button[data-survey]')];
  const gridBtn = el.querySelector<HTMLButtonElement>('button[data-grid]')!;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const persp = new THREE.PerspectiveCamera(70, 1, 0.1, 1000);
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  ortho.position.z = 10;
  let camera: THREE.PerspectiveCamera | THREE.OrthographicCamera = persp;
  const quat = new THREE.Quaternion(); // freie Orientation (himmel/kugel)

  const RADIUS = 100;
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(RADIUS, 96, 64),
    new THREE.MeshBasicMaterial({ side: THREE.BackSide }),
  );
  sky.visible = SHOW_BASE_MAP;
  sky.scale.z = -1; // Innenansicht: Osten (steigende RA) links, nicht gespiegelt
  scene.add(sky);

  // Dieselbe NASA-Karte als Unterlage der 2D-Plattkarte: sofort sichtbar vor dem ersten
  // Kachel-Load und Rückfall, wenn CDS nicht erreichbar ist (die Kacheln liegen exakt darüber).
  const baseFlatTex = new THREE.TextureLoader().load(TEX_URL, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  });
  const baseFlat = new THREE.Mesh(new THREE.PlaneGeometry(2 * Math.PI, Math.PI), new THREE.MeshBasicMaterial({ map: baseFlatTex }));
  baseFlat.renderOrder = 5; // unter den HiPS-Kacheln (renderBase 10)
  baseFlat.visible = false;
  scene.add(baseFlat);

  // Verdeckt in der Kugelansicht die Rückseite des Globus
  const occluder = new THREE.Mesh(new THREE.SphereGeometry(0.997, 48, 32), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  occluder.visible = false;
  scene.add(occluder);

  // Koordinatengitter (RA alle 30°, Deklination alle 15°), je Projektion neu aufgebaut
  const grid = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x7fa0d8, transparent: true, opacity: 0.4, depthWrite: false }));
  grid.renderOrder = 100;
  grid.visible = false;
  scene.add(grid);
  let gridOn = false;

  // HiPS-Ebenen (CDS/alasky). DSS2 deckt den ganzen Himmel ab und liegt immer als Unterlage;
  // SDSS/Pan-STARRS liegen darüber (lückenhafte Abdeckung -> DSS2 scheint durch).
  // Lazy beim ersten Aktivieren/Wählen; Fehler degradieren nur.
  const layers = new Map<SurveyId, HiPSLayer>();
  const loading = new Map<SurveyId, Promise<void>>();
  let survey: SurveyId = 'dss';
  function loadSurvey(id: SurveyId): Promise<void> {
    const sv = SURVEYS.find((x) => x.id === id)!;
    const pending = loading.get(id);
    if (pending) return pending;
    const p = createHiPSLayer(sv.url, sv.maxOrder)
      .then((l) => {
        l.renderBase = sv.id === 'dss' ? 10 : 30;
        layers.set(id, l);
        scene.add(l.group);
        applyMode(mode, true);
      })
      .catch((err) => {
        // Ebene fehlt (Netzwerk/CDS/CORS): die übrigen Ebenen bleiben, aber nicht stumm scheitern.
        loading.delete(id); // nächster Klick versucht es erneut
        if (survey === id) {
          survey = 'dss';
          applySurvey();
        }
        hint.textContent = `${sv.label}: Kacheln nicht erreichbar (Netzwerk oder CDS) – nochmal klicken versucht es erneut.`;
        showHint();
        console.warn(`HiPS-Ebene ${sv.label} konnte nicht geladen werden`, err);
      });
    loading.set(id, p);
    return p;
  }
  function applySurvey() {
    for (const [id, l] of layers) {
      l.setActive(id === 'dss' || id === survey);
      // Unter einer Überlagerung genügt eine grobe DSS2-Unterlage (spart Kacheln)
      if (id === 'dss') l.setMaxOrder(survey === 'dss' ? SURVEYS[0].maxOrder : 4);
    }
    zoom = clampZoom(zoom);
    targetZoom = clampZoom(targetZoom);
    const sv = SURVEYS.find((x) => x.id === survey)!;
    creditEl.textContent = (SHOW_BASE_MAP ? `${BASE_CREDIT} · ` : '') + (survey === 'dss' ? '' : `${sv.credit} · `) + SURVEYS[0].credit;
    creditEl.title = sv.note;
    surveyBtns.forEach((b) => {
      const on = b.dataset.survey === survey;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }
  function setSurvey(id: SurveyId) {
    survey = id;
    applySurvey();
    // Unterlage und gewählte Karte parallel laden (nacheinander wäre bei CDS-Ausfall doppelte Wartezeit)
    const jobs: Promise<void>[] = [loadSurvey('dss')];
    if (id !== 'dss') jobs.push(loadSurvey(id));
    Promise.allSettled(jobs).then(applySurvey);
  }

  // ---- Zustand --------------------------------------------------------------------------------
  let mode: StarsMode = 'himmel';
  // Zoom je Modus: himmel = FOV (°), kugel = Abstand zur Oberfläche, karte/allsky = halbe Bildhöhe (Weltkoordinaten)
  let zoom = 70;
  let targetZoom = zoom;
  let flatCx = 0;
  let flatCy = 0;
  let anchor: { nx: number; ny: number; wx: number; wy: number } | null = null;
  let dragging = false;
  let active = false;
  let lastX = 0;
  let lastY = 0;
  let pinchDist = 0;
  let drift = false; // sanfte Nachtdrift standardmäßig aus (D schaltet sie ein)
  let raf = 0;
  let hintTimer = 0;
  let lastT = 0;

  const projOf = (m: StarsMode): Projection => (m === 'karte' ? equirectProjection : m === 'allsky' ? hammerProjection : sphereProjection);
  const isFlat = () => mode === 'karte' || mode === 'allsky';
  const viewH = () => Math.max(1, canvas.clientHeight);
  const viewW = () => Math.max(1, canvas.clientWidth);
  const aspect = () => viewW() / viewH();
  const tanHalf = (fovDeg: number) => Math.tan((fovDeg * D2R) / 2);

  // Maximal 2× über die Kachelauflösung der gewählten Karte hinaus zoomen (HiPS-Kachel = 512 px je 58,6°/2^k).
  // Maßgeblich ist die tatsächlich genutzte Ordnung (kann unter der Tabellenangabe liegen).
  function minZoom(abs: number): number {
    const order = layers.get(survey)?.maxUseOrder ?? SURVEYS.find((x) => x.id === survey)!.maxOrder;
    const pprMax = 2 * (512 * 2 ** order) / (58.6 * D2R);
    return Math.max(abs, spanToZoom(mode, viewH() / pprMax));
  }
  function zoomRange(): [number, number] {
    if (mode === 'himmel') return [minZoom(FOV_MIN), FOV_MAX];
    if (mode === 'kugel') return [minZoom(GLOBE_ALT_MIN), GLOBE_ALT_MAX];
    const p = projOf(mode);
    return [minZoom(FLAT_SPAN_MIN / 2), Math.max(p.halfH, p.halfW / aspect()) * 1.04];
  }
  const clampZoom = (z: number) => {
    const [lo, hi] = zoomRange();
    return Math.max(lo, Math.min(hi, z));
  };

  // Bildschirmpixel pro Radiant in der Bildmitte
  function pxPerRad(): number {
    if (mode === 'himmel') return (0.5 * viewH()) / tanHalf(zoom);
    if (mode === 'kugel') return (0.5 * viewH()) / tanHalf(GLOBE_FOV) / zoom;
    return viewH() / (2 * zoom);
  }
  // Sichtbare Winkelausdehnung der größeren Bilddimension (rad)
  const spanRad = () => Math.min(2 * Math.PI, Math.max(viewW(), viewH()) / pxPerRad());

  // Blickmitte (RA/Dec) je Modus
  function getCenter(): { ra: number; dec: number } {
    if (mode === 'himmel') return radecFromDir(new THREE.Vector3(0, 0, -1).applyQuaternion(quat).toArray() as Vec3);
    if (mode === 'kugel') return radecFromDir(new THREE.Vector3(0, 0, 1).applyQuaternion(quat).toArray() as Vec3);
    const d = projOf(mode).unproject(flatCx, flatCy);
    return d ? radecFromDir(d) : { ra: 0, dec: 0 };
  }
  function dirOf(ra: number, dec: number): THREE.Vector3 {
    const r = ra * D2R;
    const d = dec * D2R;
    return new THREE.Vector3(Math.cos(d) * Math.cos(r), Math.sin(d), -Math.cos(d) * Math.sin(r));
  }
  function setCenter(ra: number, dec: number) {
    const dir = dirOf(ra, dec);
    if (isFlat()) {
      const p = projOf(mode).project(dir.toArray() as Vec3);
      flatCx = p[0];
      flatCy = p[1];
      return;
    }
    const up = Math.abs(dir.y) > 0.999 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const m = new THREE.Matrix4();
    // himmel: Kamera im Ursprung, Blick entlang dir; kugel: Kamera außen auf dir, Blick zum Ursprung
    if (mode === 'himmel') m.lookAt(new THREE.Vector3(0, 0, 0), dir, up);
    else m.lookAt(dir.clone().multiplyScalar(2), new THREE.Vector3(0, 0, 0), up);
    quat.setFromRotationMatrix(m);
  }

  // Zoom-Wert zwischen den Modi über die sichtbare Winkelausdehnung (rad) überführen
  function spanToZoom(m: StarsMode, span: number): number {
    if (m === 'himmel') return span / D2R;
    if (m === 'kugel') return span / (2 * tanHalf(GLOBE_FOV));
    return span / 2;
  }
  function zoomToSpan(m: StarsMode, z: number): number {
    if (m === 'himmel') return z * D2R;
    if (m === 'kugel') return z * 2 * tanHalf(GLOBE_FOV);
    return z * 2;
  }

  function buildGrid(p: Projection) {
    const pts: number[] = [];
    const push = (a: Vec3, b: Vec3) => {
      const pa = p.project(a);
      const pb = p.project(b);
      if (p.flat && Math.abs(pa[0] - pb[0]) > p.seam * 0.5) return; // nicht über den Kartenrand ziehen
      const k = p.flat ? 1 : 1.002;
      pts.push(pa[0] * k, pa[1] * k, pa[2] * k, pb[0] * k, pb[1] * k, pb[2] * k);
    };
    const at = (ra: number, dec: number): Vec3 => dirOf(ra, dec).toArray() as Vec3;
    for (let ra = 0; ra < 360; ra += 30) {
      for (let dec = -90; dec < 90; dec += 3) push(at(ra, dec), at(ra, dec + 3));
    }
    for (let dec = -75; dec <= 75; dec += 15) {
      for (let ra = 0; ra < 360; ra += 3) push(at(ra, dec), at(ra + 3, dec));
    }
    grid.geometry.dispose();
    grid.geometry = new THREE.BufferGeometry();
    grid.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    grid.visible = gridOn;
  }

  const HINTS: Record<StarsMode, string> = {
    himmel: 'Ziehen zum Umschauen · Mausrad zoomt · „D“ schaltet die Drift',
    kugel: 'Ziehen dreht den Globus · Mausrad zoomt · „D“ schaltet die Drift',
    karte: 'Ziehen verschiebt · Mausrad zoomt auf den Cursor',
    allsky: 'Ganzer Himmel (Hammer-Aitoff) · Ziehen verschiebt · Mausrad zoomt auf den Cursor',
  };

  function applyMode(next: StarsMode, keepView = false) {
    if (!keepView && next !== mode) {
      const c = getCenter();
      const span = zoomToSpan(mode, zoom);
      mode = next;
      zoom = targetZoom = clampZoom(spanToZoom(mode, span));
      setCenter(c.ra, c.dec);
    } else {
      mode = next;
    }
    anchor = null;
    camera = isFlat() ? ortho : persp;
    const p = projOf(mode);
    sky.visible = SHOW_BASE_MAP && mode === 'himmel';
    baseFlat.visible = SHOW_BASE_MAP && mode === 'karte';
    occluder.visible = mode === 'kugel';
    for (const l of layers.values()) l.setProjection(p, mode === 'himmel' ? THREE.BackSide : THREE.FrontSide);
    buildGrid(p);
    modeBtns.forEach((b) => {
      const on = b.dataset.mode === mode;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    gridBtn.classList.toggle('on', gridOn);
    hint.textContent = HINTS[mode];
    showHint();
    resize();
  }

  function resize() {
    const w = el.clientWidth;
    const h = el.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    persp.aspect = w / h;
    persp.updateProjectionMatrix();
    if (isFlat()) {
      zoom = targetZoom = clampZoom(zoom);
      clampPan();
    }
  }

  function clampPan() {
    const p = projOf(mode);
    const hw = zoom * aspect();
    // Karte größer als der Ausschnitt: Rand bleibt teilweise sichtbar; Ausschnitt größer als Karte: zentrieren
    const limX = hw >= p.halfW ? 0 : p.halfW - hw * 0.15;
    const limY = zoom >= p.halfH ? 0 : p.halfH - zoom * 0.15;
    flatCx = Math.max(-limX, Math.min(limX, flatCx));
    flatCy = Math.max(-limY, Math.min(limY, flatCy));
  }

  function applyCamera() {
    if (mode === 'himmel') {
      persp.fov = zoom;
      persp.near = 0.1;
      persp.far = 1000;
      persp.position.set(0, 0, 0);
      persp.quaternion.copy(quat);
    } else if (mode === 'kugel') {
      const dist = 1 + zoom;
      persp.fov = GLOBE_FOV;
      persp.near = Math.max(0.0002, zoom * 0.2);
      persp.far = dist + 3;
      persp.position.set(0, 0, dist).applyQuaternion(quat);
      persp.quaternion.copy(quat);
    } else {
      const hw = zoom * aspect();
      if (anchor) {
        flatCx = anchor.wx - anchor.nx * hw;
        flatCy = anchor.wy - anchor.ny * zoom;
      }
      clampPan();
      ortho.left = flatCx - hw;
      ortho.right = flatCx + hw;
      ortho.top = flatCy + zoom;
      ortho.bottom = flatCy - zoom;
      ortho.position.set(0, 0, 10);
    }
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  // Richtung unter einem Bildpunkt (NDC) – Grundlage der Kachelauswahl
  const tmp = new THREE.Vector3();
  const tmpO = new THREE.Vector3();
  function sample(nx: number, ny: number): Vec3 | null {
    if (mode === 'himmel') {
      return tmp.set(nx, ny, 0.5).unproject(persp).normalize().toArray() as Vec3;
    }
    if (mode === 'kugel') {
      tmpO.copy(persp.position);
      const d = tmp.set(nx, ny, 0.5).unproject(persp).sub(tmpO).normalize();
      const b = tmpO.dot(d);
      const disc = b * b - (tmpO.lengthSq() - 1);
      if (disc < 0) return null;
      const t = -b - Math.sqrt(disc);
      if (t < 0) return null;
      return tmpO.addScaledVector(d, t).normalize().toArray() as Vec3;
    }
    const hw = zoom * aspect();
    return projOf(mode).unproject(flatCx + nx * hw, flatCy + ny * zoom);
  }
  const hipsView: HiPSView = {
    get pxPerRad() { return pxPerRad(); },
    get span() { return spanRad(); },
    sample,
  };

  function loop(t: number) {
    if (!active) return;
    const dt = Math.min(50, t - lastT);
    lastT = t;
    if (drift && !dragging && !isFlat()) {
      // sanfte Drift: langsame Welt-Rotation um die Himmelsachse
      const qd = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dt * 0.0004);
      quat.premultiply(qd);
    }
    // logarithmisch glätten: gleichmäßiges Zoomgefühl über viele Größenordnungen
    zoom *= Math.pow(targetZoom / zoom, Math.min(1, dt / 100));
    applyCamera();
    for (const l of layers.values()) l.update(hipsView);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }

  function showHint() {
    hint.classList.remove('away');
    clearTimeout(hintTimer);
    hintTimer = window.setTimeout(() => hint.classList.add('away'), 3500);
  }

  // Verschieben/Drehen um dx, dy Bildschirmpixel
  function dragBy(dx: number, dy: number) {
    if (isFlat()) {
      const s = (2 * zoom) / viewH();
      anchor = null;
      flatCx -= dx * s;
      flatCy += dy * s;
      clampPan();
      return;
    }
    // frei um lokale Kamera-Achsen drehen (kein festes „oben“); außen läuft die Drehung gegenläufig
    const k = (mode === 'himmel' ? 1 : -1) / pxPerRad();
    const pitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), dy * k);
    const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dx * k);
    quat.multiply(pitch).multiply(yaw);
  }

  function zoomBy(factor: number, e?: { clientX: number; clientY: number }) {
    targetZoom = clampZoom(targetZoom * factor);
    if (isFlat() && e) {
      const r = canvas.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      const ny = -(((e.clientY - r.top) / r.height) * 2 - 1);
      const hw = zoom * aspect();
      anchor = { nx, ny, wx: flatCx + nx * hw, wy: flatCy + ny * zoom };
    }
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return; // nur linke Maustaste bzw. Touch dreht, nicht die rechte Taste
    dragging = true;
    anchor = null;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    dragBy(dx, dy);
  });
  canvas.addEventListener('pointerup', () => { dragging = false; });
  canvas.addEventListener('pointercancel', () => { dragging = false; });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoomBy(Math.exp(e.deltaY * 0.0012), e);
  }, { passive: false });
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      pinchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }
  }, { passive: true });
  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && pinchDist) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      zoomBy(pinchDist / d, { clientX: (e.touches[0].clientX + e.touches[1].clientX) / 2, clientY: (e.touches[0].clientY + e.touches[1].clientY) / 2 });
      pinchDist = d;
    }
  }, { passive: true });
  canvas.addEventListener('touchend', () => { pinchDist = 0; });

  el.querySelector('.stars-panel')!.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    if (b.dataset.mode) applyMode(b.dataset.mode as StarsMode);
    else if (b.dataset.survey) setSurvey(b.dataset.survey as SurveyId);
    else if (b.hasAttribute('data-grid')) toggleGrid();
  });
  function toggleGrid() {
    gridOn = !gridOn;
    grid.visible = gridOn;
    gridBtn.classList.toggle('on', gridOn);
  }

  function onKey(e: KeyboardEvent) {
    if (!active || el.hidden || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const px = 40; // ~40 px Schritt
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const dx = e.key === 'ArrowLeft' ? px : e.key === 'ArrowRight' ? -px : 0;
      const dy = e.key === 'ArrowUp' ? px : e.key === 'ArrowDown' ? -px : 0;
      dragBy(dx, dy);
      showHint();
      e.preventDefault();
    } else if (e.key === '+' || e.key === '=') {
      zoomBy(0.85);
    } else if (e.key === '-') {
      zoomBy(1.18);
    } else if (e.key.toLowerCase() === 'd') {
      drift = !drift;
      showHint();
    } else if (e.key.toLowerCase() === 'g') {
      toggleGrid();
    }
  }
  window.addEventListener('keydown', onKey);

  let baseMapTried = false;
  function loadTexture() {
    new THREE.TextureLoader().load(
      TEX_URL,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        sky.material = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide });
      },
      undefined,
      () => {
        // Rückfall: dunkler Himmel, wenn die Textur nicht lädt
        sky.material = new THREE.MeshBasicMaterial({ color: 0x010208, side: THREE.BackSide });
      },
    );
  }

  const ro = new ResizeObserver(resize);
  ro.observe(el);

  return {
    el,
    activate(opts) {
      active = true;
      el.hidden = false;
      resize();
      const wanted: StarsMode = opts?.mode && MODES.some((m) => m.id === opts.mode) ? opts.mode : mode;
      // Startansicht: Blick in die südliche Milchstraße (Richtung galaktisches Zentrum), FOV 70°
      const hasPos = Number.isFinite(opts?.ra) || Number.isFinite(opts?.dec);
      const ra = Number.isFinite(opts?.ra) ? opts!.ra! : hasPos ? 0 : 266;
      const dec = Number.isFinite(opts?.dec) ? opts!.dec! : hasPos ? 30 : -25;
      const fovDeg = Number.isFinite(opts?.fov) ? opts!.fov! : 70;
      mode = wanted;
      const fovGiven = Number.isFinite(opts?.fov);
      // ohne fov: Kugel ganz, Karten komplett sichtbar
      zoom = targetZoom = clampZoom(fovGiven || mode === 'himmel' ? spanToZoom(mode, fovDeg * D2R) : mode === 'kugel' ? 3 : Infinity);
      // Himmel beginnt immer bei 70° und animiert zum gewünschten ?fov= (targetZoom bleibt der Zielwert)
      if (mode === 'himmel') zoom = 70;
      applyMode(mode, true);
      setCenter(ra, dec);
      if (!baseMapTried) {
        baseMapTried = true;
        if (SHOW_BASE_MAP) loadTexture();
      }
      // Quelle bei jedem Aktivieren anwenden: ein Deep-Link #/sterne?quelle=sdss darf auch dann
      // greifen, wenn die Ansicht vorher schon einmal offen war (setSurvey ist idempotent).
      setSurvey(SURVEYS.find((x) => x.id === opts?.survey)?.id ?? survey);
      applyCamera();
      renderer.render(scene, camera);
      lastT = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    },
    deactivate() {
      active = false;
      cancelAnimationFrame(raf);
      el.hidden = true;
      clearTimeout(hintTimer);
      // Wartende Kachel-Downloads verwerfen; die Ansicht ist unsichtbar
      for (const l of layers.values()) l.cancelPending();
    },
  };
}
