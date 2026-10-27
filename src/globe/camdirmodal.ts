import { Map as MlMapCtor, Marker, type GeoJSONSource, type LngLat, type Map as MlMap } from 'maplibre-gl';
import { escapeHtml } from '../util';
import { attachHls } from './hls';
import { CAM_COLOR, ROAD_CAM_FOV_ANGLE, fovSectors } from './layers/shared/cams';
import { fitPose, fromVanishing, vanishingPoint } from './layers/shared/camfit';
import { DEM_NATIVE_ZOOM, DEM_TILES, registerDemTiles } from './demhd';
import { previewDir, removeCamDir, saveCamDir, type CamPose } from '../api/camdircloud';
import { OFM_SOURCE, baseLayers } from './vector';
import './camdirmodal.css';

// Editor for the viewing direction of a webcam – a full-screen workspace: the picture (zoomable) next to a map
// (satellite or street map) with the view cone, and a side bar with the settings. Ways to find the direction:
//  · Richtung wählen   – click on the map: the camera looks there (the map pans and zooms with the mouse as usual)
//  · Fluchtpunkt       – draw two edges of a straight road in the picture and pick that road on the map: the road's
//                        direction and the vanishing point give the heading and the tilt
//  · Punkte abgleichen – click the same spot on the ground in the picture and on the map; from a few pairs the
//                        direction (and tilt, height, field of view) is computed
//  · Überlagerung      – the picture in the back, the real 3D map (terrain, buildings) in front of it seen from the
//                        camera; drag to turn and tilt, steppers and keys for the fine work
// The picture zooms with the wheel (at the cursor) and pans by dragging; points keep their exact place on it.

export interface CamDirModalOpts {
  title: string;
  lng: number;
  lat: number;
  /** current heading in degrees, -1 when unknown */
  dir: number;
  image?: string;
  hls?: string;
  /** pose stored with the direction (tilt, height, roll, field of view), if any */
  pose?: CamPose;
  /** key in the worker (see camdircloud.ts) */
  key: string;
  /** a correction is stored in the worker (can be reset) */
  saved: boolean;
  /** the correction was saved (heading) or removed (null) */
  onChange(dir: number | null, pose?: CamPose): void;
}

const SAT = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const CONE_M = 110;
const M_LAT = 110574; // metres per degree of latitude
const DEFAULT_HFOV = 60; // typical horizontal field of view of a road camera
const MAX_ZOOM = 14;

const norm = (d: number) => (Math.round((((d % 360) + 360) % 360) * 10) / 10) % 360;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

type Mode = 'dir' | 'vp' | 'match' | 'overlay';
type MapStyle = 'sat' | 'satroads' | 'dark' | 'light';

const MODES: { id: Mode; label: string }[] = [
  { id: 'dir', label: 'Richtung wählen' },
  { id: 'vp', label: 'Fluchtpunkt' },
  { id: 'match', label: 'Punkte abgleichen' },
  { id: 'overlay', label: 'Überlagerung' },
];
const STYLES: { id: MapStyle; label: string }[] = [
  { id: 'sat', label: 'Satellit' },
  { id: 'satroads', label: 'Satellit + Straßen' },
  { id: 'dark', label: 'Dunkel (Straßen)' },
  { id: 'light', label: 'Hell (Straßen)' },
];
const HINTS: Record<'dir' | 'overlay', string> = {
  dir: 'Auf die Karte klicken: Die Kamera blickt dorthin. Die Karte lässt sich mit der Maus verschieben und zoomen; das Bild links zoomt mit dem Mausrad.',
  overlay: 'Ziehen: Richtung und Neigung. Rechte Maustaste ziehen: Ansicht verschieben. Mausrad: zoomen. Pfeiltasten: fein (Umschalt = grob). „B“ halten: nur das Bild.',
};

interface Param {
  id: 'dir' | 'alt' | 'down' | 'roll' | 'fov';
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  dec: number;
  /** change per pixel when dragging the label */
  drag: number;
}
const PARAMS: Param[] = [
  { id: 'dir', label: 'Richtung', unit: '°', min: 0, max: 360, step: 0.5, dec: 1, drag: 0.25 },
  { id: 'alt', label: 'Höhe über Boden', unit: ' m', min: 0.5, max: 80, step: 0.5, dec: 1, drag: 0.1 },
  { id: 'down', label: 'Neigung nach unten', unit: '°', min: -10, max: 60, step: 0.5, dec: 1, drag: 0.1 },
  { id: 'roll', label: 'Rollen', unit: '°', min: -20, max: 20, step: 0.5, dec: 1, drag: 0.05 },
  { id: 'fov', label: 'Sichtfeld (vertikal)', unit: '°', min: 15, max: 90, step: 1, dec: 0, drag: 0.2 },
];
const stepper = (p: Param) =>
  `<div class="cdm-st" data-p="${p.id}"><span class="cdm-stl" title="Hier nach links/rechts ziehen">${p.label}</span><span class="cdm-stc"><button type="button" data-s="-1" aria-label="weniger">−</button><input type="number" step="${p.step}" aria-label="${p.label}"><span class="cdm-u">${p.unit}</span><button type="button" data-s="1" aria-label="mehr">+</button></span></div>`;

interface Pair {
  x: number; // 0..1 in the picture
  y: number;
  lng: number;
  lat: number;
}
interface Road {
  b: number; // bearing 0..180
  name: string;
  d: number; // distance in metres
}

let current: (() => void) | null = null;

export function openCamDirModal(o: CamDirModalOpts) {
  current?.();
  let dir = o.dir >= 0 ? norm(o.dir) : 0;
  let mode: Mode = 'dir';
  let style: MapStyle = 'sat';
  let overlay = false;
  const pairs: Pair[] = [];
  let pendImg: { x: number; y: number } | null = null;
  let pendMap: LngLat | null = null;
  const vpPts: { x: number; y: number }[] = []; // clicks of the two road edges (4 points)
  let vpIdx = -1; // which of the two possible headings (road direction or the opposite) is used
  let vpRes: { down: number; rel: number } | null = null;
  let roadSel: number | null = null; // bearing (mod 180) of the road picked for the vanishing point
  let roads: Road[] = []; // roads next to the camera
  let groundElev = 0; // terrain height at the camera (overlay view)
  let ar = 16 / 9; // aspect of the picture
  const v = { alt: o.pose?.alt ?? 6, down: o.pose?.down ?? 12, roll: o.pose?.roll ?? 0, fov: o.pose?.fov ?? 36, op: 60 };
  // the pose is saved along with the direction once it was worked out or tuned (or when one was stored before)
  let poseSet = !!o.pose;
  const pose = (): CamPose | undefined => (poseSet ? { down: v.down, alt: v.alt, roll: v.roll, fov: v.fov } : undefined);
  const off = { e: 0, n: 0 }; // position correction in metres (east, north)
  const mPerLng = 111320 * Math.cos((o.lat * Math.PI) / 180);
  const hasMedia = !!(o.image || o.hls);
  const z = { s: 1, x: 0, y: 0 }; // zoom and shift of the picture (and of the whole stage in the overlay view)

  const root = document.createElement('div');
  root.className = 'cdm';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.innerHTML = `
    <header class="cdm-top">
      <b class="cdm-title">${escapeHtml(o.title)}</b>
      <div class="cdm-seg" role="group" aria-label="Vorgehen">${MODES.map((m) => `<button type="button" data-m="${m.id}" ${m.id !== 'dir' && !hasMedia ? 'disabled' : ''}>${m.label}</button>`).join('')}</div>
      <label class="cdm-style">Karte <select class="cdm-sel">${STYLES.map((s) => `<option value="${s.id}">${s.label}</option>`).join('')}</select></label>
      <span class="cdm-sp"></span>
      <span class="cdm-msg" role="status"></span>
      <button type="button" class="cdm-reset" ${o.saved ? '' : 'hidden'}>Zurücksetzen</button>
      <button type="button" class="cdm-cancel">Abbrechen</button>
      <button type="button" class="cdm-save">Speichern</button>
      <button type="button" class="cdm-x" aria-label="Schließen">×</button>
    </header>
    <div class="cdm-body">
      <div class="cdm-area">
        <div class="cdm-views">
          <section class="cdm-pic"><div class="cdm-frame">${o.hls ? '<video autoplay muted playsinline></video>' : o.image ? `<img alt="Webcam-Bild" src="${escapeHtml(o.image)}" referrerpolicy="no-referrer" draggable="false">` : '<div class="cdm-none">Kein Bild verfügbar</div>'}<svg class="cdm-lines" viewBox="0 0 100 100" preserveAspectRatio="none"></svg><div class="cdm-pts"></div></div></section>
          <section class="cdm-map"><div class="cdm-mapel"></div></section>
        </div>
        <div class="cdm-zb"><button type="button" data-z="in" aria-label="Vergrößern">+</button><button type="button" data-z="out" aria-label="Verkleinern">−</button><button type="button" data-z="0" aria-label="Ansicht zurücksetzen" title="Ansicht zurücksetzen">⟲</button><span class="cdm-zl"></span></div>
      </div>
      <aside class="cdm-side">
        <div class="cdm-info"></div>
        <div class="cdm-acts" hidden><button type="button" class="cdm-flip" hidden>Umdrehen</button><button type="button" class="cdm-tov">In Überlagerung prüfen</button><button type="button" class="cdm-clr">Zurücksetzen</button></div>
        <div class="cdm-roads" hidden></div>
        <div class="cdm-card">
          ${stepper(PARAMS[0])}
          <div class="cdm-quick"><button type="button" data-d="0">N</button><button type="button" data-d="90">O</button><button type="button" data-d="180">S</button><button type="button" data-d="270">W</button></div>
        </div>
        <div class="cdm-card cdm-ovc" hidden>
          <div class="cdm-h">Kamera</div>
          ${PARAMS.slice(1).map(stepper).join('')}
          <div class="cdm-nudge"><span>Position</span><span class="cdm-pad"><button type="button" data-n="f" title="vor">↑</button><button type="button" data-n="l" title="links">←</button><button type="button" data-n="b" title="zurück">↓</button><button type="button" data-n="r" title="rechts">→</button></span><output class="cdm-off"></output><button type="button" data-n="0" class="cdm-sm">Zurück</button></div>
          <div class="cdm-h">Ansicht</div>
          <label class="cdm-sl">Karte sichtbar<input type="range" class="cdm-op" min="10" max="100" step="5" aria-label="Deckkraft der Karte"><output class="cdm-opv"></output></label>
          <button type="button" class="cdm-peek">Nur das Bild zeigen (halten)</button>
        </div>
      </aside>
    </div>`;
  document.body.append(root);
  const q = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const views = q('.cdm-views');
  const pic = q('.cdm-pic');
  const frame = q('.cdm-frame');
  const pts = q('.cdm-pts');
  const lines = frame.querySelector<SVGElement>('.cdm-lines')!;
  const mapEl = q('.cdm-mapel');
  const msg = q('.cdm-msg');
  const info = q('.cdm-info');
  const acts = q('.cdm-acts');
  const roadsEl = q('.cdm-roads');
  const ovc = q('.cdm-ovc');
  const select = q<HTMLSelectElement>('.cdm-sel');
  const opEl = q<HTMLInputElement>('.cdm-op');

  registerDemTiles();
  const map: MlMap = new MlMapCtor({
    container: mapEl,
    style: {
      version: 8,
      sources: {
        sat: { type: 'raster', tiles: [SAT], tileSize: 256, maxzoom: 19, attribution: 'Esri, Maxar, Earthstar Geographics' },
        ofm: { type: 'vector', url: OFM_SOURCE, attribution: '© OpenStreetMap, OpenFreeMap' },
        dem: { type: 'raster-dem', tiles: [DEM_TILES], tileSize: 512, maxzoom: DEM_NATIVE_ZOOM, encoding: 'terrarium', attribution: 'Gelände: Mapterhorn, AWS Terrain Tiles' },
        cone: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
        cam: { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Point', coordinates: [o.lng, o.lat] }, properties: {} } },
      },
      layers: [
        { id: 'sat', type: 'raster', source: 'sat' },
        ...baseLayers('dark'),
        ...baseLayers('light'),
        // invisible: keeps the road tiles loaded, so the roads next to the camera can be read
        { id: 'roadq', type: 'line', source: 'ofm', 'source-layer': 'transportation', paint: { 'line-opacity': 0 } },
        // roads as thin lines (over the satellite; in the overlay view as edges to line up with the picture)
        { id: 'roads', type: 'line', source: 'ofm', 'source-layer': 'transportation', layout: { visibility: 'none' }, paint: { 'line-color': '#ffffff', 'line-opacity': 0.75, 'line-width': ['interpolate', ['linear'], ['zoom'], 14, 0.6, 19, 2] } },
        { id: 'bld', type: 'fill-extrusion', source: 'ofm', 'source-layer': 'building', layout: { visibility: 'none' }, paint: { 'fill-extrusion-color': '#9fb4ff', 'fill-extrusion-opacity': 0.45, 'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8], 'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0] } },
        { id: 'cone', type: 'fill', source: 'cone', paint: { 'fill-color': CAM_COLOR, 'fill-opacity': 0.35 } },
        { id: 'cone-line', type: 'line', source: 'cone', paint: { 'line-color': '#ffffff', 'line-width': 1.5 } },
        { id: 'cam', type: 'circle', source: 'cam', paint: { 'circle-radius': 6, 'circle-color': CAM_COLOR, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } },
      ],
    },
    center: [o.lng, o.lat],
    zoom: 17.5,
    maxZoom: 24, // a camera close to the ground needs a high zoom, otherwise the map pushes it backwards
    maxPitch: 120,
    dragRotate: false,
    touchPitch: false,
    attributionControl: { compact: true },
  });
  map.touchZoomRotate.disableRotation();
  const canvas = map.getCanvas();
  const resizer = new ResizeObserver(() => map.resize());
  resizer.observe(mapEl);

  // ---- parameters (steppers) ---------------------------------------------------------------------------
  const get = (id: Param['id']) => (id === 'dir' ? dir : v[id]);
  const poseChanged = () => {
    poseSet = true;
    if (overlay) lookFromCamera();
    refreshUi();
  };
  const put = (id: Param['id'], x: number) => {
    const p = PARAMS.find((a) => a.id === id)!;
    if (!Number.isFinite(x)) return;
    if (id === 'dir') return setDir(x);
    v[id] = Math.round(clamp(x, p.min, p.max) * 100) / 100;
    poseChanged();
  };
  const refreshUi = () => {
    for (const p of PARAMS) {
      const input = root.querySelector<HTMLInputElement>(`[data-p="${p.id}"] input`);
      if (input && document.activeElement !== input) input.value = get(p.id).toFixed(p.dec);
    }
    opEl.value = String(v.op);
    q('.cdm-opv').textContent = `${v.op} %`;
  };
  for (const p of PARAMS) {
    const row = q(`[data-p="${p.id}"]`);
    const input = row.querySelector('input')!;
    input.addEventListener('change', () => put(p.id, Number(input.value)));
    // − / + : a step, held down it repeats (Shift = ten times as much)
    row.querySelectorAll<HTMLButtonElement>('button[data-s]').forEach((b) => {
      let t = 0;
      let i = 0;
      const stop = () => {
        clearTimeout(t);
        clearInterval(i);
      };
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const go = () => put(p.id, get(p.id) + Number(b.dataset.s) * p.step * (e.shiftKey ? 10 : 1));
        go();
        t = window.setTimeout(() => (i = window.setInterval(go, 70)), 400);
      });
      for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, stop);
    });
    // dragging the label sideways changes the value (Shift = fine)
    const label = row.querySelector<HTMLElement>('.cdm-stl')!;
    let start: { x: number; val: number } | null = null;
    label.addEventListener('pointerdown', (e) => {
      start = { x: e.clientX, val: get(p.id) };
      label.setPointerCapture(e.pointerId);
    });
    label.addEventListener('pointermove', (e) => start && put(p.id, start.val + (e.clientX - start.x) * p.drag * (e.shiftKey ? 0.1 : 1)));
    label.addEventListener('pointerup', () => (start = null));
    label.addEventListener('pointercancel', () => (start = null));
  }
  opEl.addEventListener('input', () => {
    v.op = Number(opEl.value);
    mapEl.style.opacity = overlay ? String(v.op / 100) : '';
    refreshUi();
  });
  const peek = (on: boolean) => views.classList.toggle('peek', on);
  const peekBtn = q('.cdm-peek');
  peekBtn.addEventListener('pointerdown', () => peek(true));
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) peekBtn.addEventListener(ev, () => peek(false));

  // ---- zoom and shift of the picture ----------------------------------------------------------------------
  const applyZoom = () => {
    views.style.setProperty('--zs', String(z.s));
    views.style.setProperty('--tx', `${z.x}px`);
    views.style.setProperty('--ty', `${z.y}px`);
    q('.cdm-zl').textContent = z.s > 1.01 ? `×${z.s.toFixed(1).replace('.', ',')}` : '';
  };
  /** zoom around a screen point: the spot under it stays where it is */
  const zoomAt = (cx: number, cy: number, f: number) => {
    const r = (overlay ? views : pic).getBoundingClientRect();
    const px = cx - (r.left + r.width / 2);
    const py = cy - (r.top + r.height / 2);
    const s2 = clamp(z.s * f, 1, MAX_ZOOM);
    const k = s2 / z.s;
    z.x = s2 === 1 ? 0 : px - k * (px - z.x);
    z.y = s2 === 1 ? 0 : py - k * (py - z.y);
    z.s = s2;
    applyZoom();
  };
  const zoomReset = () => {
    z.s = 1;
    z.x = z.y = 0;
    applyZoom();
  };
  const zoomCentre = (f: number) => {
    const r = (overlay ? views : pic).getBoundingClientRect();
    zoomAt(r.left + r.width / 2, r.top + r.height / 2, f);
  };
  q('.cdm-zb').addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest('button')?.dataset.z;
    if (a === 'in') zoomCentre(1.5);
    else if (a === 'out') zoomCentre(1 / 1.5);
    else if (a === '0') zoomReset();
  });
  pic.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.2 : 1 / 1.2);
    },
    { passive: false },
  );
  // drag = shift the picture, click (hardly moved) = set a point
  let pd: { x: number; y: number; tx: number; ty: number; moved: boolean } | null = null;
  pic.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('.cdm-pt')) return;
    pd = { x: e.clientX, y: e.clientY, tx: z.x, ty: z.y, moved: false };
    pic.setPointerCapture(e.pointerId);
  });
  pic.addEventListener('pointermove', (e) => {
    if (!pd) return;
    const dx = e.clientX - pd.x;
    const dy = e.clientY - pd.y;
    if (!pd.moved && Math.hypot(dx, dy) > 5) pd.moved = true;
    if (pd.moved && z.s > 1) {
      z.x = pd.tx + dx;
      z.y = pd.ty + dy;
      applyZoom();
    }
  });
  pic.addEventListener('pointerup', (e) => {
    const d = pd;
    pd = null;
    if (d && !d.moved) onPicClick(e.clientX, e.clientY);
  });
  pic.addEventListener('pointercancel', () => (pd = null));

  // ---- picture ---------------------------------------------------------------------------------------------
  // its aspect decides the size of the frame (so overlay and field of view are exact)
  const setAspect = (w: number, h: number) => {
    if (!w || !h) return;
    ar = w / h;
    views.style.setProperty('--ar', String(ar));
    if (!o.pose && !poseSet) v.fov = Math.round((2 * Math.atan(Math.tan((DEFAULT_HFOV / 2) * (Math.PI / 180)) / ar)) * (180 / Math.PI));
    refreshUi();
  };
  const media = frame.querySelector<HTMLImageElement | HTMLVideoElement>('img, video');
  if (media instanceof HTMLImageElement) {
    media.addEventListener('load', () => setAspect(media.naturalWidth, media.naturalHeight));
    if (media.complete) setAspect(media.naturalWidth, media.naturalHeight);
  } else if (media instanceof HTMLVideoElement && o.hls) {
    media.addEventListener('loadedmetadata', () => setAspect(media.videoWidth, media.videoHeight));
    attachHls(media, o.hls, () => {
      media.outerHTML = o.image ? `<img alt="Webcam-Bild" src="${escapeHtml(o.image)}" draggable="false">` : '<div class="cdm-none">Livestream nicht verfügbar</div>';
    });
  }

  // ---- map ----------------------------------------------------------------------------------------------------
  // layers per map style / mode
  const applyLayers = () => {
    const show = (id: string) => {
      if (id === 'sat') return style === 'sat' || style === 'satroads';
      if (id.startsWith('vbase-')) return id.startsWith(`vbase-${style}-`) && !(overlay && id.endsWith('-bg'));
      if (id === 'roads') return overlay || style === 'satroads';
      if (id === 'bld') return overlay;
      if (id === 'roadq') return true;
      return !overlay; // cone, cone-line, cam
    };
    for (const l of map.getStyle().layers) map.setLayoutProperty(l.id, 'visibility', show(l.id) ? 'visible' : 'none');
  };
  const whenLoaded = (fn: () => void) => (map.isStyleLoaded() ? fn() : map.once('load', fn));

  // roads next to a spot, read from the loaded vector tiles (bearing of the nearest piece of each road)
  const ROAD_SKIP = new Set(['rail', 'path', 'pedestrian', 'track', 'ferry', 'transit', 'bus_guideway', 'raceway', 'busway']);
  const nearRoads = (lng: number, lat: number, maxM: number): Road[] => {
    const kx = 111320 * Math.cos((lat * Math.PI) / 180);
    const found: Road[] = [];
    for (const f of map.querySourceFeatures('ofm', { sourceLayer: 'transportation' })) {
      if (ROAD_SKIP.has(f.properties?.class)) continue;
      const g = f.geometry;
      const parts = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
      let best: Road | null = null;
      for (const part of parts)
        for (let i = 1; i < part.length; i++) {
          const ax = (part[i - 1][0] - lng) * kx;
          const ay = (part[i - 1][1] - lat) * M_LAT;
          const dx = (part[i][0] - lng) * kx - ax;
          const dy = (part[i][1] - lat) * M_LAT - ay;
          const l2 = dx * dx + dy * dy;
          if (!l2) continue;
          const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2));
          const d = Math.hypot(ax + t * dx, ay + t * dy);
          if (d <= maxM && (!best || d < best.d)) best = { b: ((((Math.atan2(dx, dy) * 180) / Math.PI) % 180) + 180) % 180, name: String(f.properties?.name ?? f.properties?.['name:latin'] ?? f.properties?.['name:de'] ?? ''), d };
        }
      if (best) found.push(best);
    }
    found.sort((a, b) => a.d - b.d);
    // tiles cut roads into pieces: the same road shows up several times
    const seen = new Set<string>();
    return found.filter((r) => {
      const key = `${r.name}|${Math.round(r.b / 4)}|${Math.round(r.d / 10)}`;
      return seen.has(key) ? false : (seen.add(key), true);
    });
  };
  const roadName = (r: Road) => escapeHtml(r.name || 'Straße');
  function renderRoads() {
    const on = (mode === 'dir' || mode === 'vp') && roads.length > 0;
    roadsEl.hidden = !on;
    if (!on) return;
    roadsEl.innerHTML =
      mode === 'vp'
        ? `<span>Straße wählen:</span>${roads.map((r, i) => `<button type="button" data-i="${i}" class="${roadSel === r.b ? 'on' : ''}">${roadName(r)} · ${Math.round(r.b)}°</button>`).join('')}`
        : `<span>Straßenrichtungen:</span>${roads.flatMap((r) => [r.b, r.b + 180].map((d) => `<button type="button" data-d="${Math.round(d) % 360}">${Math.round(d) % 360}° ${roadName(r)}</button>`)).join('')}`;
  }
  function refreshRoads() {
    roads = nearRoads(o.lng, o.lat, 45).slice(0, 4);
    renderRoads();
  }

  // free camera at the camera's position: heading = bearing, 90° pitch = horizon, vertical field of view
  const lookFromCamera = () => {
    map.setVerticalFieldOfView(v.fov);
    // the height is above the ground: with the terrain on, its elevation at the camera is added
    map.jumpTo(map.calculateCameraOptionsFromCameraLngLatAltRotation([o.lng + off.e / mPerLng, o.lat + off.n / M_LAT], groundElev + v.alt, dir, 90 - v.down, v.roll));
    q('.cdm-off').textContent = off.e || off.n ? `${Math.round(Math.hypot(off.e, off.n) * 10) / 10} m` : '';
  };
  const draw = () => {
    (map.getSource('cone') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: fovSectors([[o.lng, o.lat, dir]], CONE_M, ROAD_CAM_FOV_ANGLE) });
    if (overlay) lookFromCamera();
    refreshUi();
    // the main map shows the preview as well (cone, panel)
    previewDir(o.key, dir);
  };
  function setDir(d: number) {
    if (!Number.isFinite(d)) return;
    dir = norm(d);
    draw();
  }
  map.on('load', () => {
    applyLayers();
    draw();
  });
  map.on('idle', () => {
    // terrain tiles arrive after the switch: follow the real ground height at the camera
    if (overlay) {
      const e = map.queryTerrainElevation([o.lng + off.e / mPerLng, o.lat + off.n / M_LAT]);
      if (e !== null && e !== undefined && Math.abs(e - groundElev) > 0.2) {
        groundElev = e;
        lookFromCamera();
      }
    }
    if (!overlay && !roads.length) refreshRoads();
  });

  // ---- point pairs and vanishing point ------------------------------------------------------------------------
  const markers: Marker[] = [];
  const dot = (label: string, cls = '') => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `cdm-pt ${cls}`;
    el.textContent = label;
    return el;
  };
  const renderPts = () => {
    pts.replaceChildren();
    markers.splice(0).forEach((m) => m.remove());
    const place = (el: HTMLElement, x: number, y: number) => {
      el.style.left = `${x * 100}%`;
      el.style.top = `${y * 100}%`;
      pts.append(el);
    };
    pairs.forEach((p, i) => {
      const remove = (e: Event) => {
        e.stopPropagation();
        pairs.splice(i, 1);
        renderPts();
        solve();
      };
      const a = dot(String(i + 1));
      a.title = 'Klicken zum Entfernen';
      a.addEventListener('click', remove);
      place(a, p.x, p.y);
      const b = dot(String(i + 1));
      b.title = 'Klicken zum Entfernen';
      b.addEventListener('click', remove);
      markers.push(new Marker({ element: b }).setLngLat([p.lng, p.lat]).addTo(map));
    });
    if (mode === 'vp') {
      vpPts.forEach((p, i) => place(dot(String(Math.floor(i / 2) + 1), 'vp'), p.x, p.y));
      // each road edge as a long line through its two points
      lines.innerHTML = [0, 2]
        .filter((i) => vpPts[i + 1])
        .map((i) => {
          const [a, b] = [vpPts[i], vpPts[i + 1]];
          const [dx, dy] = [(b.x - a.x) * 100, (b.y - a.y) * 100];
          return `<line x1="${a.x * 100 - dx * 12}" y1="${a.y * 100 - dy * 12}" x2="${b.x * 100 + dx * 12}" y2="${b.y * 100 + dy * 12}" />`;
        })
        .join('');
    } else lines.innerHTML = '';
    if (pendImg) place(dot('+', 'wait'), pendImg.x, pendImg.y);
    if (pendMap) markers.push(new Marker({ element: dot('+', 'wait') }).setLngLat(pendMap).addTo(map));
    updateFit();
  };

  function updateFit(rms?: number) {
    q<HTMLButtonElement>('.cdm-flip').hidden = mode !== 'vp' || !vpRes;
    if (mode === 'vp') {
      const k = vpPts.length;
      let t: string;
      if (k < 4) t = `Zwei Ränder oder Markierungen der Straße im Bild einzeichnen (sie verlaufen in Wirklichkeit parallel). Linie ${k < 2 ? 1 : 2}: ${k % 2 === 0 ? 'Anfang' : 'Ende'} anklicken, möglichst weit auseinander. Zum Genauwerden mit dem Mausrad ins Bild zoomen.`;
      else if (roadSel === null) t = 'Jetzt diese Straße auf der Karte anklicken (oder rechts auswählen).';
      else if (!vpRes) t = 'Die beiden Linien sind fast parallel – bitte schräger und weiter auseinander einzeichnen.';
      else t = `Richtung ${dir}° · Neigung ${Math.round(vpRes.down * 10) / 10}° (aus dem Fluchtpunkt). ${Math.abs(vpRes.rel) > 75 ? 'Die Straße läuft fast quer zur Blickrichtung – dann ungenau. ' : ''}Blickt die Kamera in die Gegenrichtung: „Umdrehen“.`;
      info.textContent = t;
      q<HTMLButtonElement>('.cdm-tov').disabled = !vpRes;
      q<HTMLButtonElement>('.cdm-clr').disabled = !k && roadSel === null;
      return;
    }
    if (mode !== 'match') return;
    const n = pairs.length;
    let t: string;
    if (pendImg) t = 'Jetzt denselben Punkt auf der Karte anklicken.';
    else if (pendMap) t = 'Jetzt denselben Punkt im Kamerabild anklicken.';
    else if (!n) t = 'Einen erkennbaren Punkt auf dem Boden wählen (Straßenecke, Markierung, Bordstein): erst im Kamerabild, dann auf der Karte anklicken. Zum Genauwerden mit dem Mausrad ins Bild zoomen.';
    else {
      const dev = rms === undefined ? '' : ` · Abweichung ${(rms * 50).toFixed(1).replace('.', ',')} % der Bildhöhe`;
      const more = n >= 3 ? 'Zum Prüfen die Überlagerung öffnen.' : `Weitere Punkte (verschieden weit entfernt) berechnen ${n < 2 ? 'auch das Sichtfeld, ab 3 ' : 'ab 3 '}auch Neigung und Höhe.`;
      t = `${n} ${n === 1 ? 'Punkt' : 'Punkte'} → Richtung ${dir}°${dev}. ${more}`;
    }
    info.textContent = t;
    q<HTMLButtonElement>('.cdm-tov').disabled = !n;
    q<HTMLButtonElement>('.cdm-clr').disabled = !n && !pendImg && !pendMap;
  }
  function solve() {
    if (!pairs.length) return updateFit();
    const r = fitPose(
      pairs.map((p) => ({ u: (p.x * 2 - 1) * ar, v: 1 - p.y * 2, e: (p.lng - o.lng) * mPerLng - off.e, n: (p.lat - o.lat) * M_LAT - off.n })),
      { heading: dir, down: v.down, alt: v.alt, fov: v.fov },
    );
    if (pairs.length >= 3) {
      v.down = Math.round(r.pose.down * 2) / 2;
      v.alt = Math.round(r.pose.alt * 2) / 2;
    }
    if (pairs.length >= 2) {
      v.fov = Math.round(r.pose.fov);
      poseSet = true;
    }
    setDir(r.pose.heading);
    updateFit(r.rms);
  }
  function solveVp() {
    vpRes = null;
    if (vpPts.length === 4 && roadSel !== null) {
      const [a, b, c, d] = vpPts.map((p) => [(p.x * 2 - 1) * ar, 1 - p.y * 2] as const);
      const vp = vanishingPoint([a[0], a[1], b[0], b[1]], [c[0], c[1], d[0], d[1]]);
      if (vp) {
        const r = fromVanishing(vp[0], vp[1], v.fov);
        vpRes = r;
        // the road runs both ways: the heading is the road direction (or its opposite) minus the angle seen in the picture
        const cand = [norm(roadSel - r.rel), norm(roadSel + 180 - r.rel)];
        const away = (x: number) => Math.abs(((((x - dir) % 360) + 540) % 360) - 180);
        if (vpIdx < 0) vpIdx = away(cand[0]) <= away(cand[1]) ? 0 : 1;
        v.down = clamp(Math.round(r.down * 2) / 2, -10, 60);
        poseSet = true;
        setDir(cand[vpIdx]);
      }
    }
    renderPts();
    renderRoads();
  }
  const complete = () => {
    if (!pendImg || !pendMap) return renderPts();
    pairs.push({ ...pendImg, lng: pendMap.lng, lat: pendMap.lat });
    pendImg = null;
    pendMap = null;
    renderPts();
    solve();
  };
  function onPicClick(cx: number, cy: number) {
    if (mode !== 'match' && mode !== 'vp') return;
    const r = frame.getBoundingClientRect();
    const p = { x: clamp((cx - r.left) / r.width, 0, 1), y: clamp((cy - r.top) / r.height, 0, 1) };
    if (mode === 'vp') {
      if (vpPts.length >= 4) vpPts.length = 0;
      vpPts.push(p);
      vpIdx = -1;
      return vpPts.length === 4 ? solveVp() : renderPts();
    }
    pendImg = p;
    complete();
  }
  map.on('click', (e) => {
    if ((e.originalEvent.target as HTMLElement).closest('.cdm-pt')) return;
    if (mode === 'dir') {
      // heading from the camera to the clicked spot
      setDir((Math.atan2((e.lngLat.lng - o.lng) * mPerLng, (e.lngLat.lat - o.lat) * M_LAT) * 180) / Math.PI);
    } else if (mode === 'vp') {
      const r = nearRoads(e.lngLat.lng, e.lngLat.lat, 30)[0];
      msg.textContent = r ? '' : 'Dort wurde keine Straße gefunden.';
      if (r) {
        roadSel = r.b;
        vpIdx = -1;
        solveVp();
      }
    } else if (mode === 'match') {
      pendMap = e.lngLat;
      complete();
    }
  });
  q('.cdm-flip').addEventListener('click', () => {
    vpIdx = 1 - vpIdx;
    solveVp();
  });
  roadsEl.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    if (b.dataset.d !== undefined) setDir(Number(b.dataset.d));
    else if (b.dataset.i !== undefined) {
      roadSel = roads[Number(b.dataset.i)].b;
      vpIdx = -1;
      solveVp();
    }
  });
  q('.cdm-clr').addEventListener('click', () => {
    vpPts.length = 0;
    roadSel = null;
    vpRes = null;
    vpIdx = -1;
    pairs.length = 0;
    pendImg = null;
    pendMap = null;
    renderPts();
    renderRoads();
  });
  q('.cdm-tov').addEventListener('click', () => setMode('overlay'));

  // ---- modes --------------------------------------------------------------------------------------------------------
  function setMode(m: Mode) {
    const was = overlay;
    mode = m;
    overlay = m === 'overlay';
    views.classList.toggle('ov', overlay);
    views.classList.toggle('mt', m === 'match' || m === 'vp');
    peek(false);
    root.querySelectorAll<HTMLButtonElement>('.cdm-seg button').forEach((b) => b.classList.toggle('on', b.dataset.m === m));
    ovc.hidden = !overlay;
    acts.hidden = m !== 'match' && m !== 'vp';
    zoomReset();
    pendImg = null;
    pendMap = null;
    if (m === 'dir' || m === 'overlay') info.textContent = (o.dir < 0 && m === 'dir' ? 'Zu dieser Kamera ist noch keine Richtung bekannt. ' : '') + HINTS[m];
    renderPts();
    renderRoads();
    if ((m === 'dir' || m === 'vp') && !roads.length) whenLoaded(refreshRoads);
    // in the overlay view the camera is steered by us, otherwise by the mouse
    for (const h of [map.dragPan, map.scrollZoom, map.touchZoomRotate, map.doubleClickZoom, map.keyboard]) overlay ? h.disable() : h.enable();
    map.touchZoomRotate.disableRotation();
    mapEl.style.opacity = overlay ? String(v.op / 100) : '';
    canvas.style.cursor = overlay ? 'grab' : 'crosshair';
    whenLoaded(() => {
      applyLayers();
      // real terrain in the overlay view (the 3D buildings stand on it)
      map.setTerrain(overlay ? { source: 'dem', exaggeration: 1 } : null);
      groundElev = overlay ? (map.queryTerrainElevation([o.lng + off.e / mPerLng, o.lat + off.n / M_LAT]) ?? groundElev) : 0;
      map.resize();
      if (overlay) lookFromCamera();
      else if (was) {
        map.setVerticalFieldOfView(36.87);
        map.jumpTo({ center: [o.lng, o.lat], zoom: 17.5, bearing: 0, pitch: 0, roll: 0 });
      }
      draw();
    });
  }
  q('.cdm-seg').addEventListener('click', (e) => {
    const m = (e.target as HTMLElement).closest('button')?.dataset.m as Mode | undefined;
    if (m) setMode(m);
  });
  select.addEventListener('change', () => {
    style = select.value as MapStyle;
    whenLoaded(applyLayers);
  });
  q('.cdm-quick').addEventListener('click', (e) => {
    const d = (e.target as HTMLElement).closest('button')?.dataset.d;
    if (d !== undefined) setDir(Number(d));
  });
  q('.cdm-nudge').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    const n = b?.dataset.n;
    if (n === undefined) return;
    if (n === '0') {
      off.e = 0;
      off.n = 0;
    } else {
      // 0.5 m (Shift: 5 m) relative to the heading: forward / back / left / right
      const a = ((dir + { f: 0, r: 90, b: 180, l: 270 }[n as 'f']) * Math.PI) / 180;
      const step = (e as MouseEvent).shiftKey ? 5 : 0.5;
      off.e += Math.sin(a) * step;
      off.n += Math.cos(a) * step;
    }
    lookFromCamera();
  });

  // ---- overlay view: drag turns and tilts, right button shifts the view, wheel zooms ------------------------------
  let od: { x: number; y: number; pan: boolean } | null = null;
  canvas.addEventListener('contextmenu', (e) => overlay && e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    if (!overlay) return;
    od = { x: e.clientX, y: e.clientY, pan: e.button !== 0 };
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = od.pan ? 'move' : 'grabbing';
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!overlay || !od) return;
    const dx = e.clientX - od.x;
    const dy = e.clientY - od.y;
    od.x = e.clientX;
    od.y = e.clientY;
    if (od.pan) {
      z.x += dx;
      z.y += dy;
      applyZoom();
      return;
    }
    // zoomed in, the same movement on screen is a smaller change of the view
    const k = 0.15 / z.s;
    v.down = clamp(v.down + dy * k, -10, 60);
    poseSet = true;
    setDir(dir - dx * k); // dragging right turns the view to the left, like moving the picture along
  });
  const odEnd = () => {
    od = null;
    if (overlay) canvas.style.cursor = 'grab';
  };
  canvas.addEventListener('pointerup', odEnd);
  canvas.addEventListener('pointercancel', odEnd);
  canvas.addEventListener(
    'wheel',
    (e) => {
      if (!overlay) return;
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.2 : 1 / 1.2);
    },
    { passive: false },
  );

  // ---- keys -----------------------------------------------------------------------------------------------------------
  const typing = (e: KeyboardEvent) => ['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (pendImg || pendMap) {
        pendImg = null;
        pendMap = null;
        renderPts();
      } else close();
      return;
    }
    if (typing(e)) return;
    if (e.key === 'b' || e.key === 'B') peek(true);
    else if (e.key === '0') zoomReset();
    else if (overlay && e.key.startsWith('Arrow')) {
      e.preventDefault();
      const k = (e.shiftKey ? 5 : e.altKey ? 0.1 : 0.5) * (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1);
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') setDir(dir + k);
      else put('down', v.down + k);
    }
  };
  const onKeyUp = (e: KeyboardEvent) => (e.key === 'b' || e.key === 'B') && peek(false);
  document.addEventListener('keydown', onKey);
  document.addEventListener('keyup', onKeyUp);

  // ---- close and save ---------------------------------------------------------------------------------------------------
  function close() {
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('keyup', onKeyUp);
    // an unsaved preview ends with the editor
    previewDir(o.key, null);
    resizer.disconnect();
    map.remove();
    root.remove();
    if (current === close) current = null;
  }
  current = close;
  q('.cdm-x').addEventListener('click', close);
  q('.cdm-cancel').addEventListener('click', close);

  const busy = (on: boolean) => root.querySelectorAll<HTMLButtonElement>('.cdm-save, .cdm-reset, .cdm-cancel').forEach((b) => (b.disabled = on));
  const run = (job: Promise<unknown>, done: () => void, text: string) => {
    busy(true);
    msg.textContent = 'Wird gesendet …';
    job
      .then(() => {
        done();
        msg.textContent = text;
        setTimeout(close, 600);
      })
      .catch((err) => {
        msg.textContent = `Fehlgeschlagen: ${err instanceof Error ? err.message : err}`;
        busy(false);
      });
  };
  q('.cdm-save').addEventListener('click', () => run(saveCamDir(o.key, dir, pose()), () => o.onChange(dir, pose()), 'Gespeichert ✓'));
  q('.cdm-reset').addEventListener('click', () => run(removeCamDir(o.key), () => o.onChange(null), 'Zurückgesetzt ✓'));
  refreshUi();
  applyZoom();
  setMode('dir');
  q<HTMLElement>('.cdm-x').focus();
}
