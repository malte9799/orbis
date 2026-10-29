import { Map as MlMap, setWorkerUrl, type GeoJSONSource } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Tiles3DLayer, setTiles3dOptions, setTiles3dSelection } from './globe/tiles3d';
import { TILES_SOURCES } from './globe/tiles3dSources';
import { store } from './store';

// Debug page for the 3D tile sources (open /debug3d.html on the dev server): a click on a source
// shows only that one, flies there and prints how its tiles are doing.

setWorkerUrl(workerUrl);

const map = new MlMap({
  container: 'map',
  center: [8, 50],
  zoom: 4,
  maxPitch: 85,
  style: {
    version: 8,
    sources: { sat: { type: 'raster', tileSize: 256, maxzoom: 19, tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], attribution: 'Esri' } },
    layers: [{ id: 'sat', type: 'raster', source: 'sat' }],
  },
});
const TERRAIN_KEY = 'orbis.debug3d.terrain';
// 3D terrain is off by default: the tiles do not sit right on it yet
function terrainOn(): boolean {
  try {
    return localStorage.getItem(TERRAIN_KEY) === '1';
  } catch {
    return false;
  }
}

const status = document.getElementById('status')!;
const list = document.getElementById('list')!;
let notes = '';
const layer = new Tiles3DLayer({ note: (n) => (notes = n) }, { bar: false });
let current = '';
map.on('error', (e) => (notes = `Karte: ${String(e.error?.message ?? e)}`));

map.on('style.load', () => {
  setTiles3dSelection(map, []);
  map.addSource('outline', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  // 3D terrain (open elevation tiles, Terrarium encoding)
  map.addSource('dem', { type: 'raster-dem', encoding: 'terrarium', tileSize: 256, maxzoom: 14, tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'], attribution: 'Mapzen / AWS Terrain Tiles' });
  if (terrainOn()) map.setTerrain({ source: 'dem', exaggeration: 1 });
  map.addLayer(layer);
  map.addLayer({ id: 'outline', type: 'line', source: 'outline', paint: { 'line-color': '#ffd23f', 'line-width': 3 } });
  setTiles3dOptions(map, store.getKeys(), 100);
});

// a tick per source: "checked and signed off" (kept in the browser)
const OK_KEY = 'orbis.debug3d.ok';
const signedOff = new Set<string>(
  (() => {
    try {
      return JSON.parse(localStorage.getItem(OK_KEY) ?? '[]') as string[];
    } catch {
      return [];
    }
  })(),
);

const terrainRow = document.createElement('label');
terrainRow.className = 'row';
terrainRow.style.cssText = 'padding:4px 2px 8px;cursor:pointer';
const terrainBox = document.createElement('input');
terrainBox.type = 'checkbox';
terrainBox.checked = terrainOn();
terrainBox.addEventListener('change', () => {
  try {
    localStorage.setItem(TERRAIN_KEY, terrainBox.checked ? '1' : '0');
  } catch {
    /* storage blocked */
  }
  if (map.getSource('dem')) map.setTerrain(terrainBox.checked ? { source: 'dem', exaggeration: 1 } : null);
  map.triggerRepaint();
});
terrainRow.append(terrainBox, document.createTextNode('3D-Gelände'));
list.appendChild(terrainRow);

// Tags per source (own notes: speed, kind of map, quality …): picked from presets or typed, kept in the
// browser. A click on a tag in the list filters the list by it.
const TAGS_KEY = 'orbis.debug3d.tags';
const TAG_PRESETS: [string, string[]][] = [
  ['Geschwindigkeit', ['schnell', 'mittel', 'langsam']],
  ['Typ', ['Foto-Mesh', 'Gebäude-Blöcke', 'LoD2', 'Gelände']],
  ['Qualität', ['gut', 'ok', 'schlecht']],
];
const tags: Record<string, string[]> = (() => {
  try {
    return JSON.parse(localStorage.getItem(TAGS_KEY) ?? '{}') as Record<string, string[]>;
  } catch {
    return {};
  }
})();
// the first time the Typ tag of every source is filled in from the data (after that the tags are yours)
const SEEDED_KEY = 'orbis.debug3d.tags.seeded';
const saveTags = () => {
  try {
    localStorage.setItem(TAGS_KEY, JSON.stringify(tags));
  } catch {
    /* storage blocked */
  }
};
try {
  if (!localStorage.getItem(SEEDED_KEY)) {
    for (const src of TILES_SOURCES) if (!tags[src.id]) tags[src.id] = [src.kind];
    saveTags();
    localStorage.setItem(SEEDED_KEY, '1');
  }
} catch {
  /* storage blocked */
}
// the Typ tag is shown as an icon at the right end of the name, not as a text badge
const TYPES = TAG_PRESETS.find(([g]) => g === 'Typ')![1];
const ICONS: Record<string, string> = {
  'Foto-Mesh': '<path d="M3 7h3l1.5-2h5L14 7h3a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><circle cx="10" cy="11.5" r="3"/>',
  'Gebäude-Blöcke': '<path d="M10 2 17 6v8l-7 4-7-4V6z"/><path d="M3 6l7 4 7-4M10 10v8"/>',
  LoD2: '<path d="M2 10 10 3l8 7"/><path d="M4 9v8h12V9"/><path d="M8 17v-5h4v5"/>',
  Gelände: '<path d="M1 17 7 6l4 7 2-3 6 7z"/>',
};
const iconSvg = (t: string) => `<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${ICONS[t] ?? ''}</svg>`;
// Geschwindigkeit as a traffic-light dot next to the icon
const SPEEDS = TAG_PRESETS.find(([g]) => g === 'Geschwindigkeit')![1];
const SPEED_COLOUR: Record<string, string> = { schnell: '#3ecf6e', mittel: '#f5b73a', langsam: '#ef5350' };
let tagFilter = '';
const filterBar = document.createElement('div');
filterBar.style.cssText = 'display:none;padding:2px 2px 8px;font-size:12px';
list.appendChild(filterBar);

const items = new Map<string, { el: HTMLElement; paint: () => void }>();
const applyFilter = () => {
  filterBar.style.display = tagFilter ? 'block' : 'none';
  filterBar.textContent = '';
  if (tagFilter) {
    const x = document.createElement('button');
    x.className = 'tag on';
    x.textContent = `Filter: ${tagFilter} ✕`;
    x.addEventListener('click', () => setFilter(''));
    filterBar.appendChild(x);
  }
  for (const [id, it] of items) it.el.style.display = !tagFilter || (tags[id] ?? []).includes(tagFilter) ? '' : 'none';
};
const setFilter = (t: string) => {
  tagFilter = t === tagFilter ? '' : t;
  applyFilter();
};

const buttons = new Map<string, HTMLButtonElement>();
const pickers = new Map<string, HTMLElement>();
for (const src of TILES_SOURCES) {
  const item = document.createElement('div');
  item.className = 'item';
  const row = document.createElement('div');
  row.className = 'row';
  const tick = document.createElement('input');
  tick.type = 'checkbox';
  tick.checked = signedOff.has(src.id);
  tick.title = 'geprüft und abgenommen';
  tick.addEventListener('change', () => {
    if (tick.checked) signedOff.add(src.id);
    else signedOff.delete(src.id);
    try {
      localStorage.setItem(OK_KEY, JSON.stringify([...signedOff]));
    } catch {
      /* storage blocked */
    }
  });
  const b = document.createElement('button');
  b.className = 'name';
  const label = document.createElement('span');
  label.textContent = src.label;
  const speedDot = document.createElement('span');
  speedDot.className = 'dot';
  const typeIcon = document.createElement('span');
  typeIcon.className = 'type';
  const marks = document.createElement('span');
  marks.className = 'marks';
  marks.append(speedDot, typeIcon);
  b.append(label, marks);
  b.title = src.hint;
  b.addEventListener('click', () => {
    current = src.id;
    for (const [id, x] of buttons) x.classList.toggle('on', id === src.id);
    // the tag menu belongs to the selected source
    for (const [id, p] of pickers) p.style.display = id === src.id ? 'block' : 'none';
    setTiles3dSelection(map, [src.id]);
    map.flyTo({ center: [src.at[0], src.at[1]], zoom: src.at[2], speed: 1.6, essential: true });
    map.once('moveend', () => map.easeTo({ pitch: 60, duration: 600 }));
  });
  const badges = document.createElement('div');
  badges.className = 'badges';
  const picker = document.createElement('div');
  picker.className = 'picker';
  picker.style.display = 'none';

  const paint = () => {
    badges.textContent = '';
    const type = (tags[src.id] ?? []).find((t) => TYPES.includes(t));
    typeIcon.innerHTML = type ? iconSvg(type) : '';
    typeIcon.title = type ?? '';
    const speed = (tags[src.id] ?? []).find((t) => SPEEDS.includes(t));
    speedDot.style.background = speed ? SPEED_COLOUR[speed] : 'transparent';
    speedDot.title = speed ? `Geschwindigkeit: ${speed}` : '';
    for (const t of (tags[src.id] ?? []).filter((t) => !TYPES.includes(t) && !SPEEDS.includes(t))) {
      const x = document.createElement('button');
      x.className = 'tag' + (t === tagFilter ? ' on' : '');
      x.textContent = t;
      x.title = 'Liste nach diesem Tag filtern';
      x.addEventListener('click', () => setFilter(t));
      badges.appendChild(x);
    }
    for (const x of picker.querySelectorAll<HTMLButtonElement>('button[data-tag]')) x.classList.toggle('on', (tags[src.id] ?? []).includes(x.dataset.tag!));
  };
  const toggleTag = (t: string) => {
    const cur = new Set(tags[src.id] ?? []);
    if (cur.has(t)) cur.delete(t);
    else cur.add(t);
    if (cur.size) tags[src.id] = [...cur];
    else delete tags[src.id];
    saveTags();
    paint();
  };
  for (const [group, names] of TAG_PRESETS) {
    const g = document.createElement('div');
    g.className = 'group';
    g.append(document.createTextNode(group + ': '));
    for (const n of names) {
      const x = document.createElement('button');
      x.className = 'tag';
      x.dataset.tag = n;
      x.textContent = n;
      x.addEventListener('click', () => toggleTag(n));
      g.appendChild(x);
    }
    picker.appendChild(g);
  }
  const free = document.createElement('input');
  free.type = 'text';
  free.placeholder = 'eigener Tag + Enter';
  free.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !free.value.trim()) return;
    const t = free.value.trim();
    free.value = '';
    if (!(tags[src.id] ?? []).includes(t)) toggleTag(t);
  });
  picker.appendChild(free);
  pickers.set(src.id, picker);

  buttons.set(src.id, b);
  row.append(tick, b);
  item.append(row, badges, picker);
  list.appendChild(item);
  items.set(src.id, { el: item, paint });
  paint();
}

let outlined = '';
setInterval(() => {
  if (!current && !notes) return;
  // the outline of what each shown source covers
  const rings = layer.debugInfo().flatMap((i) => (i.ring ? [i.ring] : []));
  const key = JSON.stringify(rings);
  if (key !== outlined && map.getSource('outline')) {
    outlined = key;
    (map.getSource('outline') as GeoJSONSource).setData({ type: 'FeatureCollection', features: rings.map((r) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: r } })) });
  }
  const c = map.getCenter();
  const lines = layer.debugInfo().map((i) => `${i.id}\n  geladen ${i.loaded}  fehler ${i.failed}  offen ${i.queued + i.downloading}\n  aktiv ${i.active}  sichtbar ${i.visible}  boden ${i.ground} m`);
  status.textContent = `${current}  zoom ${map.getZoom().toFixed(1)}  neigung ${Math.round(map.getPitch())}°\n${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}\n${lines.join('\n') || 'keine Kacheln'}${notes ? '\n' + notes : ''}`;
}, 500);

// for poking around in the console
(window as unknown as { layer: Tiles3DLayer; map: MlMap }).layer = layer;
(window as unknown as { map: MlMap }).map = map;
