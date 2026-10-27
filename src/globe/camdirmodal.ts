import { Map as MlMapCtor, type GeoJSONSource, type Map as MlMap } from 'maplibre-gl';
import { escapeHtml } from '../util';
import { attachHls } from './hls';
import { CAM_COLOR, ROAD_CAM_FOV_ANGLE, fovSectors } from './layers/shared/cams';
import { previewDir, removeCamDir, saveCamDir } from '../api/camdircloud';
import { OFM_SOURCE } from './vector';
import './camdirmodal.css';

// Editor for the viewing direction of a webcam: its picture next to a satellite map that shows the
// direction as a cone. Click or drag on the map to point the camera, or use slider / field / N-O-S-W.
// "Mit Kamerabild abgleichen" puts the picture in the back and the map in front of it, seen from the camera
// (3D, free camera at the camera's position). Position, height, tilt, roll and field of view can be tuned until
// roads, buildings and the horizon line up 1:1 – the heading found that way is what gets saved.

export interface CamDirModalOpts {
  title: string;
  lng: number;
  lat: number;
  /** current heading in degrees, -1 when unknown */
  dir: number;
  image?: string;
  hls?: string;
  /** key in the worker (see camdircloud.ts) */
  key: string;
  /** a correction is stored in the worker (can be reset) */
  saved: boolean;
  /** the correction was saved (heading) or removed (null) */
  onChange(dir: number | null): void;
}

const SAT = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const CONE_M = 110;
const norm = (d: number) => ((Math.round(d * 10) / 10) % 360 + 360) % 360;

// camera settings of the comparison view
const SLIDERS = [
  { k: 'alt', label: 'Höhe über Boden', min: 0.5, max: 60, step: 0.5, unit: ' m' },
  { k: 'down', label: 'Neigung nach unten', min: -10, max: 60, step: 0.5, unit: '°' },
  { k: 'roll', label: 'Rollen', min: -20, max: 20, step: 0.5, unit: '°' },
  { k: 'fov', label: 'Sichtfeld (vertikal)', min: 15, max: 90, step: 1, unit: '°' },
  { k: 'op', label: 'Karte sichtbar', min: 10, max: 100, step: 5, unit: ' %' },
] as const;
type CamKey = (typeof SLIDERS)[number]['k'];
const CAM_DEFAULT: Record<CamKey, number> = { alt: 6, down: 12, roll: 0, fov: 40, op: 60 };
const M_LAT = 110574; // metres per degree of latitude

let current: (() => void) | null = null;

export function openCamDirModal(o: CamDirModalOpts) {
  current?.();
  let dir = o.dir >= 0 ? norm(o.dir) : 0;
  let overlay = false;
  let saved = o.saved;
  const root = document.createElement('div');
  root.className = 'cdm';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.innerHTML = `
    <div class="cdm-box">
      <div class="cdm-head"><b>Richtung bearbeiten · ${escapeHtml(o.title)}</b><button type="button" class="cdm-x" aria-label="Schließen">×</button></div>
      <div class="cdm-main">
        <div class="cdm-pic">${o.hls ? '<video autoplay muted playsinline controls></video>' : o.image ? `<img alt="Webcam-Bild" src="${escapeHtml(o.image)}" referrerpolicy="no-referrer">` : '<div class="cdm-none">Kein Bild verfügbar</div>'}</div>
        <div class="cdm-map">${o.image ? `<img class="cdm-over" alt="" src="${escapeHtml(o.image)}" referrerpolicy="no-referrer" hidden>` : ''}<div class="cdm-mapel"></div></div>
      </div>
      <div class="cdm-ctl">
        <div class="cdm-row"><input type="range" min="0" max="359" step="1" class="cdm-range" aria-label="Blickrichtung in Grad"><input type="number" min="0" max="359" step="1" class="cdm-num" aria-label="Grad"><span>°</span>
          <span class="cdm-quick"><button type="button" data-d="0">N</button><button type="button" data-d="90">O</button><button type="button" data-d="180">S</button><button type="button" data-d="270">W</button></span></div>
        <div class="cdm-row"><label><input type="checkbox" class="cdm-ov" ${o.image ? '' : 'disabled'}> Mit Kamerabild abgleichen (3D-Ansicht aus der Kamera)</label></div>
        <div class="cdm-adv" hidden>
          ${SLIDERS.map((s) => `<label class="cdm-sl">${s.label}<input type="range" data-k="${s.k}" min="${s.min}" max="${s.max}" step="${s.step}"><output data-o="${s.k}"></output></label>`).join('')}
          <div class="cdm-nudge"><span>Position</span>
            <button type="button" data-n="f" title="vor">↑</button><button type="button" data-n="l" title="links">←</button><button type="button" data-n="b" title="zurück">↓</button><button type="button" data-n="r" title="rechts">→</button>
            <output class="cdm-off"></output><button type="button" data-n="0">Zurück</button></div>
          <div class="cdm-hint">Im Bild ziehen: seitlich = Richtung, hoch/runter = Neigung. Straßenränder, Gebäudekanten und Horizont sollen sich decken.</div>
        </div>
        <div class="cdm-hint">${o.dir >= 0 ? '' : 'Zu dieser Kamera ist noch keine Richtung bekannt. '}Auf die Karte klicken oder ziehen: Die Kamera blickt dorthin.</div>
      </div>
      <div class="cdm-foot"><span class="cdm-msg" role="status"></span>
        <button type="button" class="cdm-reset" ${saved ? '' : 'hidden'}>Zurücksetzen</button><button type="button" class="cdm-cancel">Abbrechen</button><button type="button" class="cdm-save">Speichern</button></div>
    </div>`;
  document.body.append(root);
  const q = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const range = q<HTMLInputElement>('.cdm-range');
  const num = q<HTMLInputElement>('.cdm-num');
  const msg = q('.cdm-msg');
  const over = root.querySelector<HTMLImageElement>('.cdm-over');
  const video = root.querySelector<HTMLVideoElement>('.cdm-pic video');
  if (video && o.hls) attachHls(video, o.hls, () => (video.outerHTML = o.image ? `<img alt="Webcam-Bild" src="${escapeHtml(o.image)}">` : '<div class="cdm-none">Livestream nicht verfügbar</div>'));

  const map: MlMap = new MlMapCtor({
    container: q('.cdm-mapel'),
    style: {
      version: 8,
      sources: {
        sat: { type: 'raster', tiles: [SAT], tileSize: 256, maxzoom: 19, attribution: 'Esri, Maxar, Earthstar Geographics' },
        cone: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
        cam: { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Point', coordinates: [o.lng, o.lat] }, properties: {} } },
        ofm: { type: 'vector', url: OFM_SOURCE },
      },
      layers: [
        { id: 'sat', type: 'raster', source: 'sat' },
        { id: 'cone', type: 'fill', source: 'cone', paint: { 'fill-color': CAM_COLOR, 'fill-opacity': 0.35 } },
        { id: 'cone-line', type: 'line', source: 'cone', paint: { 'line-color': '#ffffff', 'line-width': 1.5 } },
        // only in the comparison view: roads and 3D buildings as edges to line up with the picture
        { id: 'roads', type: 'line', source: 'ofm', 'source-layer': 'transportation', layout: { visibility: 'none' }, paint: { 'line-color': '#ffffff', 'line-opacity': 0.7, 'line-width': 1.2 } },
        { id: 'bld', type: 'fill-extrusion', source: 'ofm', 'source-layer': 'building', layout: { visibility: 'none' }, paint: { 'fill-extrusion-color': '#9fb4ff', 'fill-extrusion-opacity': 0.45, 'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 8], 'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0] } },
        { id: 'cam', type: 'circle', source: 'cam', paint: { 'circle-radius': 6, 'circle-color': CAM_COLOR, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } },
      ],
    },
    center: [o.lng, o.lat],
    zoom: 17.5,
    maxZoom: 19.5,
    maxPitch: 120,
    dragPan: false,
    dragRotate: false,
    touchPitch: false,
    attributionControl: { compact: true },
  });
  const element = map.getCanvasContainer();
  element.style.cursor = 'crosshair';

  const v = { ...CAM_DEFAULT };
  const off = { e: 0, n: 0 }; // position correction in metres (east, north)
  const mPerLng = 111320 * Math.cos((o.lat * Math.PI) / 180);
  // free camera at the camera's position: heading = bearing, 90° pitch = horizon, vertical field of view
  const lookFromCamera = () => {
    map.setVerticalFieldOfView(v.fov);
    map.jumpTo(map.calculateCameraOptionsFromCameraLngLatAltRotation([o.lng + off.e / mPerLng, o.lat + off.n / M_LAT], v.alt, dir, 90 - v.down, v.roll));
    q('.cdm-off').textContent = off.e || off.n ? `${Math.round(Math.hypot(off.e, off.n) * 10) / 10} m` : '';
  };
  const syncAdv = () =>
    SLIDERS.forEach((s) => {
      q<HTMLInputElement>(`[data-k="${s.k}"]`).value = String(v[s.k]);
      q(`[data-o="${s.k}"]`).textContent = `${v[s.k]}${s.unit}`;
    });
  const draw = () => {
    range.value = num.value = String(dir);
    (map.getSource('cone') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: fovSectors([[o.lng, o.lat, dir]], CONE_M, ROAD_CAM_FOV_ANGLE) });
    if (overlay) lookFromCamera();
    // the main map shows the preview as well (cone, panel)
    previewDir(o.key, dir);
  };
  const set = (d: number) => {
    if (!Number.isFinite(d)) return;
    dir = norm(d);
    draw();
  };
  map.on('load', draw);
  map.on('resize', () => overlay && draw());

  // pointing: click or drag on the map – heading from the camera to the pointer. In the comparison view a drag
  // turns / tilts the camera instead (sideways = heading, up/down = tilt).
  let down = false;
  let last = { x: 0, y: 0 };
  const point = (e: PointerEvent) => {
    if (overlay) {
      v.down = Math.min(60, Math.max(-10, v.down + (e.clientY - last.y) * 0.15));
      last = { x: e.clientX, y: e.clientY };
      syncAdv();
      return;
    }
    const r = map.getContainer().getBoundingClientRect();
    const c = map.project([o.lng, o.lat]);
    const dx = e.clientX - r.left - c.x;
    const dy = e.clientY - r.top - c.y;
    if (Math.hypot(dx, dy) > 4) set((Math.atan2(dx, -dy) * 180) / Math.PI + map.getBearing());
  };
  const canvas = map.getCanvas();
  canvas.addEventListener('pointerdown', (e) => {
    down = true;
    last = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
    point(e);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!down) return;
    if (overlay) {
      const dx = e.clientX - last.x;
      point(e);
      set(dir - dx * 0.15); // dragging right turns the view to the left, like moving the picture along
    } else point(e);
  });
  canvas.addEventListener('pointerup', () => (down = false));
  canvas.addEventListener('pointercancel', () => (down = false));

  range.addEventListener('input', () => set(Number(range.value)));
  num.addEventListener('change', () => set(Number(num.value)));
  q('.cdm-quick').addEventListener('click', (e) => {
    const d = (e.target as HTMLElement).closest('button')?.dataset.d;
    if (d !== undefined) set(Number(d));
  });

  // comparison view: picture in the back, map (3D, from the camera) in front of it
  const adv = q('.cdm-adv');
  const stage = q('.cdm-main');
  const ov = q<HTMLInputElement>('.cdm-ov');
  const mapEl = q('.cdm-mapel');
  const setOverlay = (on: boolean) => {
    overlay = on;
    adv.hidden = !on;
    stage.classList.toggle('ov', on);
    if (over) over.hidden = !on;
    const layers = () => {
      for (const id of ['cone', 'cone-line', 'cam']) map.setLayoutProperty(id, 'visibility', on ? 'none' : 'visible');
      for (const id of ['roads', 'bld']) map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
    };
    if (map.isStyleLoaded()) layers();
    else map.once('load', layers);
    mapEl.style.opacity = on ? String(v.op / 100) : '';
    canvas.style.cursor = on ? 'grab' : 'crosshair';
    map.resize();
    if (on) lookFromCamera();
    else {
      map.setVerticalFieldOfView(36.87);
      map.jumpTo({ center: [o.lng, o.lat], zoom: 17.5, bearing: 0, pitch: 0, roll: 0 });
    }
  };
  ov.addEventListener('change', () => setOverlay(ov.checked));
  if (over) over.addEventListener('load', () => q('.cdm-map').style.setProperty('--ar', String(over.naturalWidth / (over.naturalHeight || 1) || 16 / 9)));
  adv.addEventListener('input', (e) => {
    const k = (e.target as HTMLInputElement).dataset.k as CamKey | undefined;
    if (!k) return;
    v[k] = Number((e.target as HTMLInputElement).value);
    syncAdv();
    if (k === 'op') mapEl.style.opacity = String(v.op / 100);
    else lookFromCamera();
  });
  adv.addEventListener('click', (e) => {
    const n = (e.target as HTMLElement).closest('button')?.dataset.n;
    if (n === undefined) return;
    if (n === '0') (off.e = 0), (off.n = 0);
    else {
      // step of 1 m relative to the heading: forward / back / left / right
      const a = ((dir + { f: 0, r: 90, b: 180, l: 270 }[n as 'f']) * Math.PI) / 180;
      off.e += Math.sin(a);
      off.n += Math.cos(a);
    }
    lookFromCamera();
  });
  syncAdv();

  const close = () => {
    document.removeEventListener('keydown', onKey);
    // an unsaved preview ends with the editor
    previewDir(o.key, null);
    map.remove();
    root.remove();
    if (current === close) current = null;
  };
  current = close;
  const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
  document.addEventListener('keydown', onKey);
  q('.cdm-x').addEventListener('click', close);
  q('.cdm-cancel').addEventListener('click', close);
  root.addEventListener('pointerdown', (e) => e.target === root && close());

  const busy = (on: boolean) => root.querySelectorAll<HTMLButtonElement>('.cdm-foot button').forEach((b) => (b.disabled = on));
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
  q('.cdm-save').addEventListener('click', () => run(saveCamDir(o.key, dir), () => o.onChange(dir), 'Gespeichert ✓'));
  q('.cdm-reset').addEventListener('click', () => run(removeCamDir(o.key), () => o.onChange(null), 'Zurückgesetzt ✓'));
  range.value = num.value = String(dir);
  q<HTMLElement>('.cdm-x').focus();
}
