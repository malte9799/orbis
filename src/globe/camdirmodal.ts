import { Map as MlMapCtor, type GeoJSONSource, type Map as MlMap } from 'maplibre-gl';
import { escapeHtml } from '../util';
import { attachHls } from './hls';
import { CAM_COLOR, ROAD_CAM_FOV_ANGLE, fovSectors } from './layers/shared/cams';
import { previewDir, removeCamDir, saveCamDir } from '../api/camdircloud';
import './camdirmodal.css';

// Editor for the viewing direction of a webcam: its picture next to a satellite map that shows the
// direction as a cone. Click or drag on the map to point the camera, or use slider / field / N-O-S-W.
// "Bild überlagern" lays the picture semi-transparently over the map, which is turned to the direction –
// roads, buildings and the horizon then line up when the direction is right.

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
const norm = (d: number) => ((Math.round(d) % 360) + 360) % 360;

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
        <div class="cdm-map"><div class="cdm-mapel"></div>${o.image ? `<img class="cdm-over" alt="" src="${escapeHtml(o.image)}" referrerpolicy="no-referrer" hidden>` : ''}</div>
      </div>
      <div class="cdm-ctl">
        <div class="cdm-row"><input type="range" min="0" max="359" step="1" class="cdm-range" aria-label="Blickrichtung in Grad"><input type="number" min="0" max="359" step="1" class="cdm-num" aria-label="Grad"><span>°</span>
          <span class="cdm-quick"><button type="button" data-d="0">N</button><button type="button" data-d="90">O</button><button type="button" data-d="180">S</button><button type="button" data-d="270">W</button></span></div>
        <div class="cdm-row"><label><input type="checkbox" class="cdm-ov" ${o.image ? '' : 'disabled'}> Bild über die Karte legen</label><input type="range" min="10" max="90" value="50" class="cdm-op" aria-label="Deckkraft des Bildes" hidden></div>
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
      },
      layers: [
        { id: 'sat', type: 'raster', source: 'sat' },
        { id: 'cone', type: 'fill', source: 'cone', paint: { 'fill-color': CAM_COLOR, 'fill-opacity': 0.35 } },
        { id: 'cone-line', type: 'line', source: 'cone', paint: { 'line-color': '#ffffff', 'line-width': 1.5 } },
        { id: 'cam', type: 'circle', source: 'cam', paint: { 'circle-radius': 6, 'circle-color': CAM_COLOR, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } },
      ],
    },
    center: [o.lng, o.lat],
    zoom: 17.5,
    maxZoom: 19.5,
    dragPan: false,
    dragRotate: false,
    touchPitch: false,
    attributionControl: { compact: true },
  });
  const element = map.getCanvasContainer();
  element.style.cursor = 'crosshair';

  const draw = () => {
    range.value = num.value = String(dir);
    (map.getSource('cone') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: fovSectors([[o.lng, o.lat, dir]], CONE_M, ROAD_CAM_FOV_ANGLE) });
    // overlay: the map is turned so that the viewing direction points up, the camera sits low in the view
    if (overlay) map.jumpTo({ bearing: dir, padding: { top: Math.round(map.getContainer().clientHeight * 0.4), bottom: 0, left: 0, right: 0 } });
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

  // pointing: click or drag on the map – heading from the camera to the pointer (not in overlay mode, the map turns there)
  let down = false;
  const point = (e: PointerEvent) => {
    if (overlay) return;
    const r = map.getContainer().getBoundingClientRect();
    const c = map.project([o.lng, o.lat]);
    const dx = e.clientX - r.left - c.x;
    const dy = e.clientY - r.top - c.y;
    if (Math.hypot(dx, dy) > 4) set((Math.atan2(dx, -dy) * 180) / Math.PI + map.getBearing());
  };
  const canvas = map.getCanvas();
  canvas.addEventListener('pointerdown', (e) => {
    down = true;
    canvas.setPointerCapture(e.pointerId);
    point(e);
  });
  canvas.addEventListener('pointermove', (e) => down && point(e));
  canvas.addEventListener('pointerup', () => (down = false));
  canvas.addEventListener('pointercancel', () => (down = false));

  range.addEventListener('input', () => set(Number(range.value)));
  num.addEventListener('change', () => set(Number(num.value)));
  q('.cdm-quick').addEventListener('click', (e) => {
    const d = (e.target as HTMLElement).closest('button')?.dataset.d;
    if (d !== undefined) set(Number(d));
  });
  const ov = q<HTMLInputElement>('.cdm-ov');
  const op = q<HTMLInputElement>('.cdm-op');
  ov.addEventListener('change', () => {
    overlay = ov.checked;
    op.hidden = !overlay;
    if (over) over.hidden = !overlay;
    canvas.style.cursor = overlay ? 'default' : 'crosshair';
    if (overlay) draw();
    else map.jumpTo({ bearing: 0, padding: { top: 0, bottom: 0, left: 0, right: 0 } });
  });
  op.addEventListener('input', () => over && (over.style.opacity = String(Number(op.value) / 100)));
  if (over) over.style.opacity = '0.5';

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
