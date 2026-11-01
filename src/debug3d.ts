import { Map as MlMap, setWorkerUrl, type GeoJSONSource } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Tiles3DLayer, setTiles3dOptions, setTiles3dSelection } from './globe/tiles3d';
import { TILES_SOURCES } from './globe/tiles3dSources';
import { baseLayers, OFM_ATTR, OFM_SOURCE } from './globe/vector';
import { store } from './store';

setWorkerUrl(workerUrl);

const map = new MlMap({
  container: 'map', center: [8, 50], zoom: 4, maxPitch: 85,
  style: {
    version: 8,
    sources: { sat: { type: 'raster', tileSize: 256, maxzoom: 19, tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], attribution: 'Esri' } },
    layers: [{ id: 'sat', type: 'raster', source: 'sat', paint: { 'raster-fade-duration': 0 } }],
  },
});
const BASEMAPS: { id: string; label: string; tiles?: string[]; maxzoom?: number; attribution: string }[] = [
  { id: 'sat', label: 'Satellit · Esri', maxzoom: 19, attribution: 'Esri', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'] },
  { id: 'osm', label: 'OpenStreetMap', maxzoom: 19, attribution: '© OpenStreetMap', tiles: ['a', 'b', 'c'].map((x) => `https://${x}.tile.openstreetmap.org/{z}/{x}/{y}.png`) },
  { id: 'dark', label: 'Dunkel', attribution: OFM_ATTR },
  { id: 'light', label: 'Hell', attribution: OFM_ATTR },
];
const BASEMAP_KEY = 'orbis.debug3d.basemap';
let basemap = (() => {
  try { const value = localStorage.getItem(BASEMAP_KEY); return BASEMAPS.some((b) => b.id === value) ? value! : 'sat'; } catch { return 'sat'; }
})();
const showBasemap = () => {
  const isRaster: Record<string, string> = { sat: 'sat', 'bm-osm': 'osm' };
  for (const l of map.getStyle().layers ?? []) {
    if (isRaster[l.id]) map.setLayoutProperty(l.id, 'visibility', basemap === isRaster[l.id] ? 'visible' : 'none');
    else if (l.id.startsWith('vbase-')) map.setLayoutProperty(l.id, 'visibility', l.id.startsWith(`vbase-${basemap}-`) ? 'visible' : 'none');
  }
};

const list = document.getElementById('list')!;
const status = document.getElementById('status')!;
const noteEl = document.getElementById('note')!;
const TERRAIN_KEY = 'orbis.debug3d.terrain';
const OK_KEY = 'orbis.debug3d.ok';
const readSet = (key: string) => {
  try { return new Set<string>(JSON.parse(localStorage.getItem(key) ?? '[]') as string[]); } catch { return new Set<string>(); }
};
const signedOff = readSet(OK_KEY);
const terrainOn = () => { try { return localStorage.getItem(TERRAIN_KEY) === '1'; } catch { return false; } };
let note = '';
let current = '';
const layer = new Tiles3DLayer({ note: (n) => { note = n; noteEl.textContent = n; noteEl.hidden = !n; } }, { bar: false });
map.on('error', (e) => { note = `Karte: ${String(e.error?.message ?? e)}`; noteEl.textContent = note; noteEl.hidden = false; });

map.on('style.load', () => {
  setTiles3dSelection(map, []);
  for (const atlas of BASEMAPS) {
    if (atlas.id === 'sat' || !atlas.tiles) continue;
    map.addSource(`bm-${atlas.id}`, { type: 'raster', tileSize: 256, maxzoom: atlas.maxzoom, tiles: atlas.tiles, attribution: atlas.attribution });
    map.addLayer({ id: `bm-${atlas.id}`, type: 'raster', source: `bm-${atlas.id}`, paint: { 'raster-fade-duration': 0 } });
  }
  map.addSource('ofm', { type: 'vector', url: OFM_SOURCE, attribution: OFM_ATTR });
  for (const theme of ['dark', 'light'] as const) for (const l of baseLayers(theme)) map.addLayer(l);
  showBasemap();
  map.addSource('outline', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addSource('dem', { type: 'raster-dem', encoding: 'terrarium', tileSize: 256, maxzoom: 14, tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], attribution: 'Mapzen / AWS Terrain Tiles' });
  if (terrainOn()) map.setTerrain({ source: 'dem', exaggeration: 1 });
  map.addLayer(layer);
  map.addLayer({ id: 'outline', type: 'line', source: 'outline', paint: { 'line-color': '#9ee7d4', 'line-width': 2.5 } });
  setTiles3dOptions(map, store.getKeys(), 100, false);
});

const toolbar = document.createElement('div');
toolbar.className = 'toolbar';
const heading = document.createElement('div');
heading.className = 'heading';
heading.innerHTML = '<div><span class="eyebrow">ORBIS · LABOR</span><h1>3D Tiles</h1><p>Quellen prüfen und vergleichen</p></div><span class="count" id="count"></span>';
const search = document.createElement('input');
search.type = 'search'; search.placeholder = 'Quelle oder Ort suchen'; search.setAttribute('aria-label', 'Quellen suchen');
const filters = document.createElement('div'); filters.className = 'filters';
const basemapSelect = document.createElement('select'); basemapSelect.className = 'basemap'; basemapSelect.setAttribute('aria-label', 'Grundkarte');
for (const b of BASEMAPS) basemapSelect.add(new Option(b.label, b.id));
basemapSelect.value = basemap;
basemapSelect.addEventListener('change', () => {
  basemap = basemapSelect.value;
  try { localStorage.setItem(BASEMAP_KEY, basemap); } catch { /* storage blocked */ }
  showBasemap();
});
const terrain = document.createElement('label'); terrain.className = 'terrain';
const terrainBox = document.createElement('input'); terrainBox.type = 'checkbox'; terrainBox.checked = terrainOn();
terrainBox.addEventListener('change', () => {
  try { localStorage.setItem(TERRAIN_KEY, terrainBox.checked ? '1' : '0'); } catch { /* storage blocked */ }
  if (map.getSource('dem')) map.setTerrain(terrainBox.checked ? { source: 'dem', exaggeration: 1 } : null);
  map.triggerRepaint();
});
terrain.append(terrainBox, document.createTextNode('Geländerelief'));
toolbar.append(heading, search, filters, basemapSelect, terrain);
const selected = document.createElement('section'); selected.className = 'selected';
selected.innerHTML = '<span class="eyebrow">AUSGEWÄHLTE QUELLE</span><strong>Keine Quelle ausgewählt</strong><p>Klicke auf eine Quelle, um sie auf der Karte zu laden.</p>';
const groups = document.createElement('div'); groups.className = 'groups';
list.append(toolbar, selected, groups);

const kinds = ['Alle', 'Foto-Mesh', 'Gebäude-Blöcke', 'LoD2', 'Gelände', '3D-Objekte'] as const;
let kindFilter = 'Alle';
const rows = new Map<string, { card: HTMLElement; group: HTMLElement; name: string }>;
const buttons = new Map<string, HTMLButtonElement>();
const count = heading.querySelector<HTMLElement>('#count')!;
for (const kind of kinds) {
  const b = document.createElement('button'); b.type = 'button'; b.textContent = kind;
  b.classList.toggle('active', kind === kindFilter);
  b.addEventListener('click', () => { kindFilter = kind; refresh(); });
  filters.appendChild(b);
}

const saveReviewed = () => { try { localStorage.setItem(OK_KEY, JSON.stringify([...signedOff])); } catch { /* storage blocked */ } };
const activate = (src: (typeof TILES_SOURCES)[number]) => {
  current = src.id;
  for (const [id, b] of buttons) b.classList.toggle('active', id === src.id);
  selected.innerHTML = '';
  const overline = document.createElement('span'); overline.className = 'eyebrow'; overline.textContent = 'AUSGEWÄHLTE QUELLE';
  const title = document.createElement('strong'); title.textContent = src.label;
  const text = document.createElement('p'); text.textContent = src.hint;
  const meta = document.createElement('div'); meta.className = 'meta'; meta.textContent = `${src.kind} · ${src.key ? 'Schlüssel nötig' : 'Direkter Stream'}`;
  const reviewed = document.createElement('label'); reviewed.className = 'reviewed';
  const box = document.createElement('input'); box.type = 'checkbox'; box.checked = signedOff.has(src.id);
  box.addEventListener('change', () => { box.checked ? signedOff.add(src.id) : signedOff.delete(src.id); saveReviewed(); refresh(); });
  reviewed.append(box, document.createTextNode('Geprüft und abgenommen'));
  selected.append(overline, title, text, meta, reviewed);
  setTiles3dSelection(map, [src.id]);
  map.flyTo({ center: [src.at[0], src.at[1]], zoom: src.at[2], speed: 1.6, essential: true });
  map.once('moveend', () => map.easeTo({ pitch: 60, duration: 600 }));
  refresh();
};

const grouped = new Map<string, HTMLElement>();
for (const src of TILES_SOURCES) {
  if (src.partOf) continue; // appears only with its group (CH Basel)
  let group = grouped.get(src.kind);
  if (!group) {
    const section = document.createElement('details'); section.className = 'source-group';
    const summary = document.createElement('summary'); summary.textContent = src.kind;
    const body = document.createElement('div'); body.className = 'source-rows';
    section.append(summary, body); groups.appendChild(section); group = body; grouped.set(src.kind, body);
  }
  const card = document.createElement('div'); card.className = 'source-row';
  const b = document.createElement('button'); b.type = 'button'; b.className = 'source-name'; b.textContent = src.label; b.title = src.hint;
  b.addEventListener('click', () => activate(src));
  const check = document.createElement('input'); check.type = 'checkbox'; check.title = 'Geprüft und abgenommen'; check.setAttribute('aria-label', `${src.label}: geprüft`); check.checked = signedOff.has(src.id);
  check.addEventListener('change', () => { check.checked ? signedOff.add(src.id) : signedOff.delete(src.id); saveReviewed(); refresh(); });
  card.append(b, check); group.appendChild(card);
  rows.set(src.id, { card, group, name: `${src.label} ${src.hint} ${src.id}`.toLocaleLowerCase('de') });
  buttons.set(src.id, b);
}

function refresh() {
  const q = search.value.trim().toLocaleLowerCase('de');
  let visible = 0;
  for (const src of TILES_SOURCES) {
    if (src.partOf) continue;
    const row = rows.get(src.id)!;
    const reviewBox = row.card.querySelector<HTMLInputElement>('input[type=checkbox]');
    if (reviewBox) reviewBox.checked = signedOff.has(src.id);
    const show = (kindFilter === 'Alle' || src.kind === kindFilter) && (!q || row.name.includes(q));
    row.card.hidden = !show;
    if (show) visible++;
  }
  for (const [kind, body] of grouped) {
    const section = body.parentElement as HTMLDetailsElement;
    const hasVisible = [...body.children].some((el) => !(el as HTMLElement).hidden);
    section.hidden = kindFilter !== 'Alle' && kind !== kindFilter || !hasVisible;
    section.open = kindFilter === kind || (!!q && hasVisible) || [...body.children].some((el) => el.querySelector('.source-name.active'));
  }
  for (const b of filters.querySelectorAll('button')) b.classList.toggle('active', b.textContent === kindFilter);
  count.textContent = `${visible} Quellen`;
}
search.addEventListener('input', refresh);
refresh();

let outlined = '';
setInterval(() => {
  if (!current && !note) return;
  const rings = layer.debugInfo().flatMap((i) => (i.ring ? [i.ring] : []));
  const key = JSON.stringify(rings);
  if (key !== outlined && map.getSource('outline')) {
    outlined = key;
    (map.getSource('outline') as GeoJSONSource).setData({ type: 'FeatureCollection', features: rings.map((r) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: r } })) });
  }
  const c = map.getCenter();
  const lines = layer.debugInfo().map((i) => `${i.id}  ·  ${i.loaded} geladen  ·  ${i.failed} Fehler  ·  ${i.visible} sichtbar  ·  Warteschlange ${i.queued} (+${i.downloading} laden)  ·  Boden ${i.ground} m (Versatz ${i.offset} m)`);
  const sourceId = basemap === 'sat' ? 'sat' : basemap === 'dark' || basemap === 'light' ? 'ofm' : 'bm-osm';
  const ground = map.getSource(sourceId) ? (map.isSourceLoaded(sourceId) ? 'Grundkarte bereit' : 'Grundkarte lädt') : 'keine Grundkarte';
  status.textContent = `${map.getZoom().toFixed(1)} Zoom  ·  ${Math.round(map.getPitch())}° Neigung  ·  ${ground}\n${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}\n${lines.join('\n') || 'Noch keine Kacheln geladen'}`;
}, 500);

(window as unknown as { layer: Tiles3DLayer; map: MlMap }).layer = layer;
(window as unknown as { map: MlMap }).map = map;
