import { Map as MlMap, Marker, type GeoJSONSource } from 'maplibre-gl';
import type { Feature, FeatureCollection, Geometry, Position } from 'geojson';
import { Viewer, type KeyboardComponent } from 'mapillary-js';
import 'mapillary-js/dist/mapillary.css';
import { bboxOf, loadData, SCOPES, STYLE, type BBox, type Feat } from '../views/games';
import { escapeHtml } from '../util';

// Street guessing (GeoGuessr light) on Mapillary's open street-level photos.
// A random place in the chosen area is searched for a photo; you place a guess on a map.

export interface StreetOptions {
  token: string;
  scope: string;
  /** false: no way to move away from the start position */
  move: boolean;
  rounds: number;
}

export interface StreetGame {
  destroy(): void;
}

const API = 'https://graph.mapillary.com/images';
const HALF = 0.04; // search box ±0.04° (the API allows ≤ 0.01 sq. degrees)

const rad = (d: number) => (d * Math.PI) / 180;
export function distanceKm(a: [number, number], b: [number, number]): number {
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

function inRing(pt: Position, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function inGeometry(pt: Position, g: Geometry): boolean {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  return polys.some((p) => inRing(pt, p[0]) && !p.slice(1).some((h) => inRing(pt, h)));
}

/** random point inside a random area; bigger areas are more likely (by square root of the bbox area) */
function randomPoint(feats: Feat[], boxes: BBox[], weights: number[], total: number): [number, number] {
  for (;;) {
    let r = Math.random() * total;
    let i = 0;
    while (i < weights.length - 1 && (r -= weights[i]) > 0) i++;
    const b = boxes[i];
    const pt: [number, number] = [b[0] + Math.random() * (b[2] - b[0]), b[1] + Math.random() * (b[3] - b[1])];
    if (inGeometry(pt, feats[i].geometry)) return pt;
  }
}

interface Photo {
  id: string;
  lngLat: [number, number];
}

async function searchPhoto(token: string, [lng, lat]: [number, number]): Promise<Photo | null> {
  const bbox = [lng - HALF, lat - HALF, lng + HALF, lat + HALF].map((n) => n.toFixed(5)).join(',');
  try {
    const r = await fetch(`${API}?access_token=${encodeURIComponent(token)}&fields=id,computed_geometry&bbox=${bbox}&limit=40`);
    if (r.status === 400 || r.status === 401 || r.status === 403) throw new Error('Mapillary lehnt den Token ab (bitte prüfen).');
    if (!r.ok) return null;
    const j = (await r.json()) as { data?: { id: string; computed_geometry?: { coordinates: [number, number] } }[] };
    const list = (j.data ?? []).filter((d) => d.computed_geometry);
    if (!list.length) return null;
    const d = list[Math.floor(Math.random() * list.length)];
    return { id: d.id, lngLat: d.computed_geometry!.coordinates };
  } catch (e) {
    if ((e as Error).message.startsWith('Mapillary')) throw e;
    return null;
  }
}

export async function startStreetGame(host: HTMLElement, o: StreetOptions, onExit: () => void): Promise<StreetGame> {
  const scope = SCOPES.find((s) => s.id === o.scope) ?? SCOPES[0];
  const all = (await loadData('countries.json')).features as Feat[];
  const feats = all.filter((f) => f.properties.sov && (!scope.filter || scope.filter(f.properties)));
  const boxes = feats.map((f) => bboxOf([f]));
  const weights = boxes.map((b) => Math.sqrt(Math.max(0.01, (b[2] - b[0]) * (b[3] - b[1]))));
  const total = weights.reduce((a, b) => a + b, 0);
  const view = scope.view ?? ([-168, -56, 180, 80] as BBox);
  const scale = Math.min(1500, Math.max(250, distanceKm([view[0], view[1]], [view[2], view[3]]) / 8));

  const root = document.createElement('div');
  root.className = 'sg';
  root.innerHTML = `
    <div class="sg-viewer"></div>
    <div class="sg-top"><span class="sg-round"></span><span class="sg-total"></span><button class="btn sg-exit" type="button">Beenden</button></div>
    <div class="sg-loading">Suche ein Foto …</div>
    <div class="sg-guess">
      <div class="sg-map"></div>
      <button class="btn btn-primary sg-confirm" type="button" disabled>Tipp setzen</button>
    </div>
    <div class="sg-result" hidden></div>`;
  host.append(root);
  const $ = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const loading = $('.sg-loading');
  const confirm = $<HTMLButtonElement>('.sg-confirm');
  const result = $('.sg-result');
  const guessBox = $('.sg-guess');

  let dead = false;
  let viewer: Viewer | null = null;
  let guess: [number, number] | null = null;
  let truth: [number, number] | null = null;
  let round = 0;
  let sum = 0;
  let marker: Marker | null = null;
  let truthMarker: Marker | null = null;
  const scores: number[] = [];
  /** the one button under the map: first sets the guess, then starts the next round */
  let step: 'guess' | 'next' = 'guess';

  // guess map: borders only, no names
  const map = new MlMap({ container: $('.sg-map'), style: STYLE, center: [10, 30], zoom: 0.6, attributionControl: false, dragRotate: false, doubleClickZoom: false });
  map.fitBounds(view, { padding: 10, duration: 0 });
  map.on('load', () => {
    map.addSource('c', { type: 'geojson', data: { type: 'FeatureCollection', features: all } as FeatureCollection });
    map.addLayer({ id: 'c-fill', type: 'fill', source: 'c', paint: { 'fill-color': '#2a3a66' } });
    map.addLayer({ id: 'c-line', type: 'line', source: 'c', paint: { 'line-color': '#0d1530', 'line-width': 0.6 } });
    map.addSource('line', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({ id: 'line', type: 'line', source: 'line', paint: { 'line-color': '#ffd23f', 'line-width': 2, 'line-dasharray': [2, 2] } });
  });
  map.on('click', (e) => {
    if (result.hidden === false || loading.hidden === false) return;
    guess = [e.lngLat.lng, e.lngLat.lat];
    marker ??= new Marker({ color: '#ff5a5f' });
    marker.setLngLat(guess).addTo(map);
    confirm.disabled = false;
  });

  async function loadPhoto(): Promise<Photo | null> {
    for (let attempt = 0; attempt < 6 && !dead; attempt++) {
      const batch = await Promise.all(Array.from({ length: 6 }, () => searchPhoto(o.token, randomPoint(feats, boxes, weights, total))));
      const hit = batch.find(Boolean);
      if (hit) return hit;
    }
    return null;
  }

  function mountViewer(id: string) {
    if (viewer) {
      void viewer.moveTo(id).catch(() => {});
      return;
    }
    viewer = new Viewer({ accessToken: o.token, container: $('.sg-viewer'), imageId: id, component: { cover: false, attribution: true } });
    if (!o.move) {
      for (const c of ['direction', 'sequence', 'spatial', 'bearing', 'image', 'slider'] as const) {
        try { viewer.deactivateComponent(c); } catch { /* component absent */ }
      }
      viewer.getComponent<KeyboardComponent>('keyboard').configure({ keySequenceNavigation: false, keySpatialNavigation: false });
    } else {
      try { viewer.deactivateComponent('image'); } catch { /* absent */ }
    }
  }

  async function nextRound() {
    round++;
    guess = null;
    marker?.remove();
    truthMarker?.remove();
    (map.getSource('line') as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: [] });
    result.hidden = true;
    guessBox.classList.remove('big');
    confirm.hidden = false;
    confirm.disabled = true;
    confirm.textContent = 'Tipp setzen';
    step = 'guess';
    $('.sg-round').textContent = `Runde ${round} / ${o.rounds}`;
    $('.sg-total').textContent = `${sum} Punkte`;
    loading.hidden = false;
    loading.textContent = 'Suche ein Foto …';
    map.resize();
    map.fitBounds(view, { padding: 10, duration: 0 });
    try {
      const photo = await loadPhoto();
      if (dead) return;
      if (!photo) throw new Error('Kein Foto gefunden – in diesem Gebiet gibt es offenbar wenig Mapillary-Abdeckung.');
      truth = photo.lngLat;
      mountViewer(photo.id);
      loading.hidden = true;
    } catch (e) {
      if (dead) return;
      loading.textContent = (e as Error).message;
    }
  }

  confirm.addEventListener('click', async () => {
    if (step === 'next') return round >= o.rounds ? finish() : void nextRound();
    if (!guess) return;
    // with movement allowed the score counts from where the viewer stands now
    if (o.move && viewer) {
      try {
        const img = await viewer.getImage();
        const ll = (img as unknown as { lngLat?: { lng: number; lat: number } })?.lngLat;
        if (ll) truth = [ll.lng, ll.lat];
      } catch { /* keep the start position */ }
    }
    const t = truth!;
    const km = distanceKm(guess, t);
    const pts = Math.round(5000 * Math.exp(-km / scale));
    scores.push(pts);
    sum += pts;
    $('.sg-total').textContent = `${sum} Punkte`;
    truthMarker = new Marker({ color: '#2fbf71' }).setLngLat(t).addTo(map);
    (map.getSource('line') as GeoJSONSource).setData({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [guess, t] } } as Feature] });
    guessBox.classList.add('big');
    step = 'next';
    confirm.textContent = round >= o.rounds ? 'Ergebnis' : 'Nächste Runde';
    map.resize();
    map.fitBounds([Math.min(guess[0], t[0]), Math.min(guess[1], t[1]), Math.max(guess[0], t[0]), Math.max(guess[1], t[1])], { padding: 70, maxZoom: 12, duration: 600 });
    result.hidden = false;
    result.innerHTML = `
      <b>${km < 10 ? km.toFixed(1) : Math.round(km).toLocaleString('de-DE')} km daneben</b>
      <span>+${pts} Punkte</span>`;
  });

  function finish() {
    guessBox.hidden = true;
    result.hidden = false;
    result.className = 'sg-result sg-final';
    result.innerHTML = `
      <h2>${sum.toLocaleString('de-DE')} <small>/ ${(o.rounds * 5000).toLocaleString('de-DE')} Punkte</small></h2>
      <p>${scores.map((s, i) => `Runde ${i + 1}: ${s}`).map(escapeHtml).join(' · ')}</p>
      <div class="gm-actions"><button class="btn btn-primary sg-again" type="button">Nochmal</button><button class="btn sg-menu" type="button">Menü</button></div>`;
    result.querySelector('.sg-again')!.addEventListener('click', () => {
      round = 0; sum = 0; scores.length = 0;
      guessBox.hidden = false;
      result.className = 'sg-result';
      void nextRound();
    });
    result.querySelector('.sg-menu')!.addEventListener('click', onExit);
  }

  $('.sg-exit').addEventListener('click', onExit);
  void nextRound();

  return {
    destroy() {
      dead = true;
      try { viewer?.remove(); } catch { /* already gone */ }
      map.remove();
      root.remove();
    },
  };
}
