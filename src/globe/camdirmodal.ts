import { Map as MlMapCtor, Marker, type GeoJSONSource, type LngLat, type Map as MlMap } from 'maplibre-gl';
import { escapeHtml } from '../util';
import { attachHls } from './hls';
import { CAM_COLOR, ROAD_CAM_FOV_ANGLE, fovSectors } from './layers/shared/cams';
import { fitPose, fromVanishing, vanishingPoint } from './layers/shared/camfit';
import { DEM_NATIVE_ZOOM, DEM_TILES, registerDemTiles } from './demhd';
import { previewDir, removeCamDir, saveCamDir } from '../api/camdircloud';
import { OFM_SOURCE, baseLayers } from './vector';
import './camdirmodal.css';

// Editor for the viewing direction of a webcam: its picture next to a map (satellite or street map) with the
// view cone. Three ways to find the direction:
//  · Richtung wählen   – click on the map: the camera looks there (the map pans and zooms with the mouse as usual)
//  · Fluchtpunkt      – draw two edges of a straight road in the picture and pick that road on the map: the road's
//                        direction and the vanishing point give the heading and the tilt
//  · Punkte abgleichen – click the same spot on the ground in the picture and on the map; from a few pairs the
//                        direction (and tilt, height, field of view) is computed
//  · Überlagerung      – the picture in the back, the real 3D map (terrain, buildings) in front of it seen from the camera

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
const M_LAT = 110574; // metres per degree of latitude
const DEFAULT_HFOV = 60; // typical horizontal field of view of a road camera

const norm = (d: number) => (Math.round((((d % 360) + 360) % 360) * 10) / 10) % 360;

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
const HINTS: Record<Mode, string> = {
  dir: 'Auf die Karte klicken: Die Kamera blickt dorthin. Die Karte lässt sich wie gewohnt mit der Maus verschieben und zoomen.',
  vp: '',
  match: '',
  overlay: 'Im Bild ziehen: seitlich = Richtung, hoch/runter = Neigung, Mausrad = Sichtfeld. Straßenränder, Gebäudekanten und Horizont sollen sich decken.',
};

// camera settings of the overlay view
const SLIDERS = [
  { k: 'alt', label: 'Höhe über Boden', min: 0.5, max: 60, step: 0.5, unit: ' m' },
  { k: 'down', label: 'Neigung nach unten', min: -10, max: 60, step: 0.5, unit: '°' },
  { k: 'roll', label: 'Rollen', min: -20, max: 20, step: 0.5, unit: '°' },
  { k: 'fov', label: 'Sichtfeld (vertikal)', min: 15, max: 90, step: 1, unit: '°' },
  { k: 'op', label: 'Karte sichtbar', min: 10, max: 100, step: 5, unit: ' %' },
] as const;
type CamKey = (typeof SLIDERS)[number]['k'];

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
  const v = { alt: 6, down: 12, roll: 0, fov: 36, op: 60 };
  const off = { e: 0, n: 0 }; // position correction in metres (east, north)
  const mPerLng = 111320 * Math.cos((o.lat * Math.PI) / 180);
  const hasMedia = !!(o.image || o.hls);

  const root = document.createElement('div');
  root.className = 'cdm';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.innerHTML = `
    <div class="cdm-box">
      <div class="cdm-head"><b>Richtung bearbeiten · ${escapeHtml(o.title)}</b><button type="button" class="cdm-x" aria-label="Schließen">×</button></div>
      <div class="cdm-bar">
        <div class="cdm-seg" role="group" aria-label="Vorgehen">${MODES.map((m) => `<button type="button" data-m="${m.id}" ${m.id !== 'dir' && !hasMedia ? 'disabled' : ''}>${m.label}</button>`).join('')}</div>
        <label class="cdm-style">Karte <select class="cdm-sel">${STYLES.map((s) => `<option value="${s.id}">${s.label}</option>`).join('')}</select></label>
      </div>
      <div class="cdm-main">
        <div class="cdm-pic">${o.hls ? '<video autoplay muted playsinline></video>' : o.image ? `<img alt="Webcam-Bild" src="${escapeHtml(o.image)}" referrerpolicy="no-referrer" draggable="false">` : '<div class="cdm-none">Kein Bild verfügbar</div>'}<svg class="cdm-lines" viewBox="0 0 100 100" preserveAspectRatio="none"></svg><div class="cdm-pts"></div></div>
        <div class="cdm-map"><div class="cdm-mapel"></div></div>
      </div>
      <div class="cdm-hint"></div>
      <div class="cdm-fit" hidden><span class="cdm-fit-txt"></span><span class="cdm-fit-btns"><button type="button" class="cdm-flip" hidden>Umdrehen</button><button type="button" class="cdm-tov">In Überlagerung prüfen</button><button type="button" class="cdm-clr">Punkte löschen</button></span></div>
      <div class="cdm-roads" hidden></div>
      <div class="cdm-ctl">
        <div class="cdm-row"><span class="cdm-lbl">Richtung</span><input type="range" min="0" max="359" step="1" class="cdm-range" aria-label="Blickrichtung in Grad"><input type="number" min="0" max="359.9" step="0.5" class="cdm-num" aria-label="Grad"><span>°</span>
          <span class="cdm-quick"><button type="button" data-d="0">N</button><button type="button" data-d="90">O</button><button type="button" data-d="180">S</button><button type="button" data-d="270">W</button></span></div>
        <div class="cdm-adv" hidden>
          ${SLIDERS.map((s) => `<label class="cdm-sl">${s.label}<input type="range" data-k="${s.k}" min="${s.min}" max="${s.max}" step="${s.step}"><output data-o="${s.k}"></output></label>`).join('')}
          <div class="cdm-nudge"><span>Position</span>
            <button type="button" data-n="f" title="vor">↑</button><button type="button" data-n="l" title="links">←</button><button type="button" data-n="b" title="zurück">↓</button><button type="button" data-n="r" title="rechts">→</button>
            <output class="cdm-off"></output><button type="button" data-n="0">Zurück</button></div>
        </div>
      </div>
      <div class="cdm-foot"><span class="cdm-msg" role="status"></span>
        <button type="button" class="cdm-reset" ${o.saved ? '' : 'hidden'}>Zurücksetzen</button><button type="button" class="cdm-cancel">Abbrechen</button><button type="button" class="cdm-save">Speichern</button></div>
    </div>`;
  document.body.append(root);
  const q = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const main = q('.cdm-main');
  const pic = q('.cdm-pic');
  const pts = q('.cdm-pts');
  const range = q<HTMLInputElement>('.cdm-range');
  const num = q<HTMLInputElement>('.cdm-num');
  const msg = q('.cdm-msg');
  const hint = q('.cdm-hint');
  const mapEl = q('.cdm-mapel');
  const adv = q('.cdm-adv');
  const fitBox = q('.cdm-fit');
  const roadsEl = q('.cdm-roads');
  const lines = pic.querySelector<SVGElement>('.cdm-lines')!;
  const select = q<HTMLSelectElement>('.cdm-sel');

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
        // roads as thin lines (over the satellite; in the overlay view as edges to line up with the picture)
        // invisible: keeps the road tiles loaded, so the roads next to the camera can be read
        { id: 'roadq', type: 'line', source: 'ofm', 'source-layer': 'transportation', paint: { 'line-opacity': 0 } },
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

  const syncAdv = () =>
    SLIDERS.forEach((s) => {
      q<HTMLInputElement>(`[data-k="${s.k}"]`).value = String(v[s.k]);
      q(`[data-o="${s.k}"]`).textContent = `${v[s.k]}${s.unit}`;
    });

  // picture: its aspect decides the size of both panes (so overlay and field of view are exact)
  const setAspect = (w: number, h: number) => {
    if (!w || !h) return;
    ar = w / h;
    main.style.setProperty('--ar', String(ar));
    v.fov = Math.round((2 * Math.atan(Math.tan((DEFAULT_HFOV / 2) * (Math.PI / 180)) / ar)) * (180 / Math.PI));
    syncAdv();
    map.resize();
  };
  const media = pic.querySelector<HTMLImageElement | HTMLVideoElement>('img, video');
  if (media instanceof HTMLImageElement) {
    media.addEventListener('load', () => setAspect(media.naturalWidth, media.naturalHeight));
    if (media.complete) setAspect(media.naturalWidth, media.naturalHeight);
  } else if (media instanceof HTMLVideoElement && o.hls) {
    media.addEventListener('loadedmetadata', () => setAspect(media.videoWidth, media.videoHeight));
    attachHls(media, o.hls, () => {
      media.outerHTML = o.image ? `<img alt="Webcam-Bild" src="${escapeHtml(o.image)}" draggable="false">` : '<div class="cdm-none">Livestream nicht verfügbar</div>';
    });
  }

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

  // point pairs ------------------------------------------------------------------------------------------
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
      if (k < 4) t = `Zwei Ränder oder Markierungen der Straße im Bild einzeichnen (sie verlaufen in Wirklichkeit parallel). Linie ${k < 2 ? 1 : 2}: ${k % 2 === 0 ? 'Anfang' : 'Ende'} anklicken, möglichst weit auseinander.`;
      else if (roadSel === null) t = 'Jetzt diese Straße auf der Karte anklicken (oder oben auswählen).';
      else if (!vpRes) t = 'Die beiden Linien sind fast parallel – bitte schräger und weiter auseinander einzeichnen.';
      else t = `Richtung ${dir}° · Neigung ${Math.round(vpRes.down * 10) / 10}° (aus dem Fluchtpunkt). ${Math.abs(vpRes.rel) > 75 ? 'Die Straße läuft fast quer zur Blickrichtung – dann ungenau. ' : ''}Blickt die Kamera in die Gegenrichtung: „Umdrehen“.`;
      q('.cdm-fit-txt').textContent = t;
      q<HTMLButtonElement>('.cdm-tov').disabled = !vpRes;
      q<HTMLButtonElement>('.cdm-clr').disabled = !k && roadSel === null;
      return;
    }
    const n = pairs.length;
    let t: string;
    if (pendImg) t = 'Jetzt denselben Punkt auf der Karte anklicken.';
    else if (pendMap) t = 'Jetzt denselben Punkt im Kamerabild anklicken.';
    else if (!n) t = 'Einen erkennbaren Punkt auf dem Boden wählen (Straßenecke, Markierung, Bordstein): erst im Kamerabild, dann auf der Karte anklicken.';
    else {
      const dev = rms === undefined ? '' : ` · Abweichung ${(rms * 50).toFixed(1).replace('.', ',')} % der Bildhöhe`;
      const more = n >= 3 ? 'Zum Prüfen die Überlagerung öffnen.' : `Weitere Punkte (verschieden weit entfernt) berechnen ${n < 2 ? 'auch das Sichtfeld, ab 3 ' : 'ab 3 '}auch Neigung und Höhe.`;
      t = `${n} ${n === 1 ? 'Punkt' : 'Punkte'} → Richtung ${dir}°${dev}. ${more}`;
    }
    q('.cdm-fit-txt').textContent = t;
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
    if (pairs.length >= 2) v.fov = Math.round(r.pose.fov);
    syncAdv();
    set(r.pose.heading);
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
        v.down = Math.min(60, Math.max(-10, Math.round(r.down * 2) / 2));
        syncAdv();
        set(cand[vpIdx]);
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
  pic.addEventListener('click', (e) => {
    if ((mode !== 'match' && mode !== 'vp') || (e.target as HTMLElement).closest('.cdm-pt')) return;
    const r = pic.getBoundingClientRect();
    if (mode === 'vp') {
      if (vpPts.length >= 4) vpPts.length = 0;
      vpPts.push({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
      vpIdx = -1;
      return vpPts.length === 4 ? solveVp() : renderPts();
    }
    pendImg = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
    complete();
  });
  map.on('click', (e) => {
    if ((e.originalEvent.target as HTMLElement).closest('.cdm-pt')) return;
    if (mode === 'dir') {
      // heading from the camera to the clicked spot
      set((Math.atan2((e.lngLat.lng - o.lng) * mPerLng, (e.lngLat.lat - o.lat) * M_LAT) * 180) / Math.PI);
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
    if (b.dataset.d !== undefined) set(Number(b.dataset.d));
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

  // modes -------------------------------------------------------------------------------------------------
  function setMode(m: Mode) {
    const was = overlay;
    mode = m;
    overlay = m === 'overlay';
    main.classList.toggle('ov', overlay);
    main.classList.toggle('mt', m === 'match' || m === 'vp');
    root.querySelectorAll<HTMLButtonElement>('.cdm-seg button').forEach((b) => b.classList.toggle('on', b.dataset.m === m));
    adv.hidden = !overlay;
    fitBox.hidden = m !== 'match' && m !== 'vp';
    hint.hidden = m === 'match' || m === 'vp';
    hint.textContent = (o.dir < 0 && m === 'dir' ? 'Zu dieser Kamera ist noch keine Richtung bekannt. ' : '') + HINTS[m];
    pendImg = null;
    pendMap = null;
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

  // overlay: drag turns / tilts the camera, wheel changes the field of view
  let down = false;
  let last = { x: 0, y: 0 };
  canvas.addEventListener('pointerdown', (e) => {
    if (!overlay) return;
    down = true;
    last = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!overlay || !down) return;
    v.down = Math.min(60, Math.max(-10, v.down + (e.clientY - last.y) * 0.15));
    const dx = e.clientX - last.x;
    last = { x: e.clientX, y: e.clientY };
    syncAdv();
    set(dir - dx * 0.15); // dragging right turns the view to the left, like moving the picture along
  });
  const up = () => {
    down = false;
    if (overlay) canvas.style.cursor = 'grab';
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener(
    'wheel',
    (e) => {
      if (!overlay) return;
      e.preventDefault();
      v.fov = Math.min(90, Math.max(15, Math.round(v.fov * (1 + e.deltaY * 0.001))));
      syncAdv();
      lookFromCamera();
    },
    { passive: false },
  );

  range.addEventListener('input', () => set(Number(range.value)));
  num.addEventListener('change', () => set(Number(num.value)));
  q('.cdm-quick').addEventListener('click', (e) => {
    const d = (e.target as HTMLElement).closest('button')?.dataset.d;
    if (d !== undefined) set(Number(d));
  });
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
    if (n === '0') {
      off.e = 0;
      off.n = 0;
    } else {
      // step of 1 m relative to the heading: forward / back / left / right
      const a = ((dir + { f: 0, r: 90, b: 180, l: 270 }[n as 'f']) * Math.PI) / 180;
      off.e += Math.sin(a);
      off.n += Math.cos(a);
    }
    lookFromCamera();
  });

  const close = () => {
    document.removeEventListener('keydown', onKey);
    // an unsaved preview ends with the editor
    previewDir(o.key, null);
    map.remove();
    root.remove();
    if (current === close) current = null;
  };
  current = close;
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    if (pendImg || pendMap) {
      pendImg = null;
      pendMap = null;
      renderPts();
    } else close();
  };
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
  syncAdv();
  setMode('dir');
  q<HTMLElement>('.cdm-x').focus();
}
