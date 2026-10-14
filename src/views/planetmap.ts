import {
  addProtocol,
  Map as MlMap,
  MercatorCoordinate,
  NavigationControl,
  ScaleControl,
  type CustomLayerInterface,
  type GeoJSONSource,
  type MapGeoJSONFeature,
} from 'maplibre-gl';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import type { Feature, FeatureCollection, Point } from 'geojson';
import { CRAFT } from '../space/bodies';
import { MARS_SITES, SOL_MS, getMarsTracks, heliAt, loadMarsTracks, roverAt, solAt, trackCount, trackKm, type Track } from '../space/mars';
import { COUNTRY, flagDataUrl } from '../space/moon';
import { PLANET_MAPS, type TileLayer } from '../space/planets';
import { FONT_BOLD, OFM_GLYPHS } from '../globe/vector';
import { escapeHtml, fmt } from '../util';

// Map of another planet – the counterpart of the Earth map (views/globe.ts): MapLibre with
// 2D (mercator) / 3D (globe) switch, zooming far out hands over to the solar system.
// The sources are equirectangular tile pyramids (space/planets.ts); the `planet://` protocol
// re-projects them to web-mercator tiles on the fly.

export interface PlanetMapView {
  el: HTMLElement;
  activate(o: { body: string; projection?: 'globe' | 'mercator'; lat?: number; lon?: number; zoom?: number; focus?: string; site?: string; fromSpace?: boolean }): void;
  deactivate(): void;
}

export interface PlanetDeps {
  /** zoomed out of the globe (or the solar-system button) */
  onOpenSpace(body: string, lat: number, lon: number): void;
}

// ----- equirectangular → mercator tiles ---------------------------------------

const imgCache = new Map<string, Promise<ImageBitmap | null>>();

function loadImg(url: string): Promise<ImageBitmap | null> {
  let p = imgCache.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => (b ? createImageBitmap(b) : null))
      .catch(() => null);
    imgCache.set(url, p);
    if (imgCache.size > 600) imgCache.delete(imgCache.keys().next().value!);
  }
  return p;
}

const tile2lat = (y: number, z: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI;

/** Source tiles (urls) a layer needs for the mercator tile z/x/y – to fetch all layers in parallel. */
function sourceUrls(layer: TileLayer, z: number, x: number, y: number, bbox?: [number, number, number, number]): string[] {
  const L = Math.max(0, Math.min(layer.maxZ, z + Math.ceil(Math.log2(128 / layer.px))));
  const span = 180 / 2 ** L;
  const lon0 = (x / 2 ** z) * 360 - 180;
  const lon1 = ((x + 1) / 2 ** z) * 360 - 180;
  const nCols = 2 * 2 ** L;
  const c0 = Math.floor((lon0 + 180) / span);
  const c1 = Math.min(Math.ceil((lon1 + 180) / span) - 1, c0 + 3);
  const r0 = Math.max(0, Math.floor((90 - tile2lat(y, z)) / span));
  const r1 = Math.min(2 ** L - 1, Math.ceil((90 - tile2lat(y + 1, z)) / span) - 1);
  const urls: string[] = [];
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++) {
      const w = -180 + c * span;
      const n = 90 - r * span;
      if (bbox && (w > bbox[2] || w + span < bbox[0] || n < bbox[1] || n - span > bbox[3])) continue;
      urls.push(layer.url(L, r, ((c % nCols) + nCols) % nCols));
    }
  return urls;
}

/** Draw one source layer into the 256 px mercator tile (z/x/y). */
async function drawLayer(g: OffscreenCanvasRenderingContext2D, layer: TileLayer, z: number, x: number, y: number, bbox?: [number, number, number, number]) {
  // a source level with about the output resolution (1 source tile ≈ 1 output tile)
  const L = Math.max(0, Math.min(layer.maxZ, z + Math.ceil(Math.log2(128 / layer.px))));
  const span = 180 / 2 ** L;
  const lon0 = (x / 2 ** z) * 360 - 180;
  const lon1 = ((x + 1) / 2 ** z) * 360 - 180;
  const latTop = tile2lat(y, z);
  const latBot = tile2lat(y + 1, z);
  const nCols = 2 * 2 ** L;
  const c0 = Math.floor((lon0 + 180) / span);
  const c1 = Math.min(Math.ceil((lon1 + 180) / span) - 1, c0 + 3);
  const r0 = Math.max(0, Math.floor((90 - latTop) / span));
  const r1 = Math.min(2 ** L - 1, Math.ceil((90 - latBot) / span) - 1);
  const jobs: Promise<void>[] = [];
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (bbox) {
        // regional mosaics: only the source tiles that touch their footprint exist
        const w = -180 + c * span;
        const n = 90 - r * span;
        if (w > bbox[2] || w + span < bbox[0] || n < bbox[1] || n - span > bbox[3]) continue;
      }
      jobs.push(
        loadImg(layer.url(L, r, ((c % nCols) + nCols) % nCols)).then((img) => {
          if (!img) return;
          const tLon0 = -180 + c * span;
          const dx = ((tLon0 - lon0) / (lon1 - lon0)) * 256;
          const dw = (span / (lon1 - lon0)) * 256;
          const tTop = 90 - r * span;
          if (z >= 9) {
            // small tile: latitude is linear in y here, so one smooth (bilinear) draw per source tile –
            // no blocky row-by-row stretching when the imagery is over-zoomed
            const k = 256 / (latTop - latBot);
            const y0 = (latTop - tTop) * k;
            const y1 = (latTop - (tTop - span)) * k;
            g.imageSmoothingEnabled = true;
            g.imageSmoothingQuality = 'high';
            g.drawImage(img, 0, 0, img.width, img.height, dx - 0.25, y0 - 0.25, dw + 0.5, y1 - y0 + 0.5);
            return;
          }
          for (let py = 0; py < 256; py++) {
            const lat = tile2lat(y + (py + 0.5) / 256, z);
            const v = (tTop - lat) / span;
            if (v < 0 || v >= 1) continue;
            g.drawImage(img, 0, Math.floor(v * img.height), img.width, 1, dx, py, dw + 0.5, 1);
          }
        }),
      );
    }
  }
  await Promise.all(jobs);
}

const isGlobal = (b: [number, number, number, number]) => b[2] - b[0] >= 300;

let protocolReady = false;
function registerPlanetProtocol() {
  if (protocolReady) return;
  protocolReady = true;
  // planet://<body>/<auto | global | product label | ov~product label>/<z>/<x>/<y>
  addProtocol('planet', async (params) => {
    const m = /^planet:\/\/(\w+)\/([^/]+)\/(\d+)\/(\d+)\/(\d+)/.exec(params.url);
    const cfg = m ? PLANET_MAPS[m[1]] : undefined;
    if (!m || !cfg) throw new Error('unknown planet tile');
    const id = decodeURIComponent(m[2]);
    const [z, x, y] = [+m[3], +m[4], +m[5]];
    const canvas = new OffscreenCanvas(256, 256);
    const g = canvas.getContext('2d')!;
    const lon0 = (x / 2 ** z) * 360 - 180;
    const lon1 = ((x + 1) / 2 ** z) * 360 - 180;
    const latN = tile2lat(y, z);
    const latS = tile2lat(y + 1, z);
    const touches = (b: [number, number, number, number]) => !(b[2] < lon0 || b[0] > lon1 || b[3] < latS || b[1] > latN);
    const products = cfg.products ?? [];

    // thematic overlay: transparent, only inside its footprint
    if (id.startsWith('ov~')) {
      const p = products.find((q) => q.id === id.slice(3));
      if (p && touches(p.bbox)) {
        await Promise.all(sourceUrls(p.layer, z, x, y, p.bbox).map(loadImg));
        await drawLayer(g, p.layer, z, x, y, p.bbox);
      }
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      return { data: await blob.arrayBuffer() };
    }

    g.fillStyle = '#10131c';
    g.fillRect(0, 0, 256, 256);
    // fetch everything this tile is made of in parallel, then composite in order
    {
      const want: Promise<unknown>[] = [];
      const warm = (l: TileLayer, bb?: [number, number, number, number]) => sourceUrls(l, z, x, y, bb).forEach((u) => want.push(loadImg(u)));
      const prod = products.find((q) => q.id === id);
      warm(cfg.detail3d(0));
      if (!(prod && isGlobal(prod.bbox))) warm(cfg.detail3d(99));
      if (prod) {
        if (touches(prod.bbox)) warm(prod.layer, isGlobal(prod.bbox) ? undefined : prod.bbox);
      } else if (id === 'auto' && z >= 8) {
        for (const p of products) if (p.group === 'mosaic' && touches(p.bbox)) warm(p.layer, p.bbox);
      } else if (id !== 'auto' && id !== 'global') {
        const l = cfg.layers.find((q) => q.id === id);
        if (l) warm(l);
      }
      await Promise.all(want);
    }
    // base: colour mosaic, the sharp global mosaic (which has holes) on top …
    const under = cfg.detail3d(0);
    const sharp = cfg.detail3d(99);
    const product = products.find((q) => q.id === id);
    const globalProduct = !!product && isGlobal(product.bbox);
    await drawLayer(g, under, z, x, y);
    if (!globalProduct && sharp !== under && z + Math.ceil(Math.log2(128 / under.px)) > under.maxZ) await drawLayer(g, sharp, z, x, y);
    if (product) {
      if (touches(product.bbox)) await drawLayer(g, product.layer, z, x, y, globalProduct ? undefined : product.bbox);
    } else if (id === 'auto' && z >= 8) {
      // … then the regional HiRISE mosaics over their footprints (finest last)
      for (const p of products) if (p.group === 'mosaic' && touches(p.bbox)) await drawLayer(g, p.layer, z, x, y, p.bbox);
    } else if (id !== 'auto' && id !== 'global') {
      await drawLayer(g, cfg.layers.find((l) => l.id === id) ?? cfg.layers[0], z, x, y);
    }
    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
    return { data: await blob.arrayBuffer() };
  });
}

// ----- rover models (three.js custom layer, mercator, real size) -----------------

interface ModelItem {
  craft: string;
  url: string;
  sizeM: number;
  lon: number;
  lat: number;
  obj?: THREE.Object3D;
}

class RoverModels implements CustomLayerInterface {
  id = 'rover-models';
  type = 'custom' as const;
  renderingMode = '3d' as const;
  private camera = new THREE.Camera();
  private scene = new THREE.Scene();
  private renderer?: THREE.WebGLRenderer;
  private map?: MlMap;
  private loader = new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath('./draco/'));
  /** where the models stand (updated from the tracks) */
  items: ModelItem[] = [];
  private loading = new Set<string>();

  onAdd(map: MlMap, gl: WebGLRenderingContext | WebGL2RenderingContext) {
    this.map = map;
    this.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
    this.renderer.autoClear = false;
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(0, -70, 100).normalize();
    this.scene.add(sun);
  }

  /** Fetch the models of the current items (once). */
  load() {
    for (const it of this.items) {
      if (it.obj || this.loading.has(it.craft) || !it.url || !this.map) continue;
      this.loading.add(it.craft);
      this.loader
        .loadAsync(it.url)
        .then((g) => {
          const box = new THREE.Box3().setFromObject(g.scene);
          const size = box.getSize(new THREE.Vector3());
          const k = it.sizeM / Math.max(size.x, size.y, size.z);
          g.scene.position.sub(box.getCenter(new THREE.Vector3()));
          const inner = new THREE.Group();
          inner.add(g.scene);
          inner.scale.setScalar(k);
          inner.position.y = (size.y / 2) * k; // wheels on the ground
          const holder = new THREE.Group();
          holder.add(inner);
          holder.userData.craft = it.craft;
          holder.traverse((o) => (o.frustumCulled = false));
          this.scene.add(holder);
          // items are rebuilt on refresh: find ours again by craft id
          this.byCraft.set(it.craft, holder);
          this.map?.triggerRepaint();
        })
        .catch((e) => console.warn('Modell', it.craft, e));
    }
  }
  private byCraft = new Map<string, THREE.Object3D>();

  render(_gl: WebGLRenderingContext | WebGL2RenderingContext, args: { defaultProjectionData: { mainMatrix: ArrayLike<number> } }) {
    const map = this.map;
    if (!map || !this.renderer || map.getZoom() < 11) return;
    const rotX = new THREE.Matrix4().makeRotationX(Math.PI / 2);
    // Multiply in double precision here (the model sits at ≈ 0.7 in mercator units but is only
    // 1e-7 big): the shader then only sees small clip-space numbers.
    const proj = new THREE.Matrix4().fromArray(Array.from(args.defaultProjectionData.mainMatrix));
    for (const it of this.items) {
      const obj = this.byCraft.get(it.craft);
      if (!obj) continue;
      const mc = MercatorCoordinate.fromLngLat([it.lon, it.lat], 0);
      const s = mc.meterInMercatorCoordinateUnits();
      obj.matrixAutoUpdate = false;
      obj.matrix.copy(proj).multiply(new THREE.Matrix4().makeTranslation(mc.x, mc.y, mc.z).scale(new THREE.Vector3(s, -s, s)).multiply(rotX));
      obj.matrixWorldNeedsUpdate = true;
    }
    this.camera.projectionMatrix.identity();
    this.camera.projectionMatrixInverse.identity();
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
  }

  onRemove() {
    this.renderer?.dispose();
  }
}

// ----- the view ---------------------------------------------------------------------

const TRACKS: { id: 'm20' | 'msl'; color: string; name: string; craft: string }[] = [
  { id: 'm20', color: '#ffb347', name: 'Perseverance', craft: 'perseverance' },
  { id: 'msl', color: '#5ad1ff', name: 'Curiosity', craft: 'curiosity' },
];

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };
const MAX_ZOOM = 21; // beyond the imagery (≈ 5 m/px): rover models at real size

export function createPlanetMapView(deps: PlanetDeps): PlanetMapView {
  const el = document.createElement('main');
  el.className = 'view globe-view planet-view';
  el.hidden = true;
  el.innerHTML = `
    <div class="map"></div>
    <div class="globe-top">
      <button class="btn icon-btn panel-toggle" aria-label="Ebenen" title="Ebenen" aria-expanded="true">
        <svg viewBox="0 0 24 24"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/></svg>
      </button>
      <div class="search"><svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg><input class="pm-search" type="search" list="pm-places" placeholder="Ort oder Rover suchen …" aria-label="Suchen" autocomplete="off"/><datalist id="pm-places"></datalist></div>
    </div>
    <aside class="panel pm-panel"></aside>
    <div class="base-switch"></div>
    <div class="pm-active" aria-label="Angezeigte Ebenen"></div>
    <section class="space-info pm-info" hidden></section>`;

  const mapEl = el.querySelector<HTMLElement>('.map')!;
  const panel = el.querySelector<HTMLElement>('.pm-panel')!;
  const searchEl = el.querySelector<HTMLInputElement>('.pm-search')!;
  const placesEl = el.querySelector<HTMLDataListElement>('#pm-places')!;
  const baseSwitch = el.querySelector<HTMLElement>('.base-switch')!;
  const activeEl = el.querySelector<HTMLElement>('.pm-active')!;
  const info = el.querySelector<HTMLElement>('.pm-info')!;
  if (window.innerWidth <= 720) panel.hidden = true;

  let map: MlMap | null = null;
  let ready = false;
  let bodyId = 'mars';
  let projection: 'globe' | 'mercator' = 'globe';
  let layerId = 'auto';
  let panelTab: 'layers' | 'places' = 'layers';
  const show = { sites: true, tracks: true, heli: true, labels: true };
  let pending: { lat: number; lon: number; zoom: number; fromSpace?: boolean; jump?: boolean } | null = null;
  let pendingSelect: { focus?: string; site?: string } | null = null;
  const models = new RoverModels();
  let projCtl: HTMLElement | null = null;
  /** camera at the first open (no flight from a default view) */
  let initial: { lat: number; lon: number; zoom: number; fromSpace?: boolean } | null = null;
  let tracksLoaded = false;
  /** active thematic overlays (product ids) */
  const overlays = new Set<string>();

  const cfg = () => PLANET_MAPS[bodyId];
  const places = () => (bodyId === 'mars' ? [...TRACKS.map((t) => ({ id: t.id as string, name: t.name })), ...MARS_SITES.filter((x) => !x.hideFlag).map((x) => ({ id: x.id, name: x.name }))] : []);
  const tileUrl = () => `planet://${bodyId}/${encodeURIComponent(layerId)}/{z}/{x}/{y}`;
  const setTiles = () => (map?.getSource('base') as { setTiles?: (t: string[]) => void } | undefined)?.setTiles?.([tileUrl()]);

  // ----- data on the map -------------------------------------------------------
  const setData = (id: string, features: Feature[]) => (map?.getSource(id) as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features });

  function refreshData() {
    if (!map || !ready || bodyId !== 'mars') return;
    const t = getMarsTracks();
    const now = Date.now();
    const line = (pts: ArrayLike<number>, n: number, props: Record<string, unknown>): Feature => {
      const coords: number[][] = [];
      for (let i = 0; i < n; i++) coords.push([pts[i * 2], pts[i * 2 + 1]]);
      return { type: 'Feature', properties: props, geometry: { type: 'LineString', coordinates: coords } };
    };
    const lines: Feature[] = [];
    if (t && show.tracks)
      for (const tr of TRACKS) {
        const track: Track = t[tr.id];
        lines.push(line(track.ll, trackCount(track, now), { color: tr.color }));
      }
    setData('tracks', lines);
    const heli: Feature[] = [];
    if (t && show.heli) {
      const t0 = Date.parse(t.heli.sol0);
      for (const f of t.heli.flights) if (t0 + f.sol * SOL_MS <= now) heli.push(line(f.pts, f.pts.length / 2, { n: f.n }));
    }
    setData('heli', heli);

    const pts: Feature[] = [];
    const point = (id: string, kind: string, name: string, lon: number, lat: number, color: string): Feature => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lon, lat] } as Point,
      properties: { id, kind, name, color },
    });
    if (show.sites) for (const s of MARS_SITES.filter((x) => !x.hideFlag)) pts.push(point(s.id, 'site', s.name, s.lon, s.lat, '#ffffff'));
    models.items = [];
    for (const tr of TRACKS) {
      const p = roverAt(t?.[tr.id], now) ?? (tr.id === 'm20' ? [77.4509, 18.4446] : [137.4417, -4.5895]);
      if (show.tracks) pts.push(point(tr.craft, 'rover', tr.name, p[0], p[1], tr.color));
      const craft = CRAFT.find((c) => c.id === tr.craft);
      if (craft?.model) models.items.push({ craft: tr.craft, url: craft.model.url, sizeM: craft.model.sizeM, lon: p[0], lat: p[1] });
    }
    const h = t ? heliAt(now) : null;
    if (h && show.heli) pts.push(point('ingenuity', 'heli', 'Ingenuity', h[0], h[1], '#ff5ad1'));
    setData('points', pts);
    // models are only fetched once the user is close enough to see them
    if (map.getZoom() >= 10) models.load();
    map.triggerRepaint();
  }

  function applyLabels() {
    if (map?.getLayer('points-label')) map.setLayoutProperty('points-label', 'visibility', show.labels ? 'visible' : 'none');
  }

  // ----- info card ---------------------------------------------------------------
  function showInfo(p: Record<string, unknown>) {
    const kind = String(p.kind);
    const id = String(p.id);
    const rows: [string, string][] = [];
    let body = '';
    let label = 'Landestelle';
    let flag = '';
    let coordLon = 0;
    let coordLat = 0;
    if (kind === 'site') {
      const s = MARS_SITES.find((x) => x.id === id);
      if (!s) return;
      body = `<p>${escapeHtml(s.text)}</p>`;
      rows.push(['Landung', new Date(s.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })], ['Nation', COUNTRY[s.flag]], ['Ort', s.region]);
      if (s.craft) rows.push(['Mission', s.craft]);
      flag = `<img class="sp-flag" src="${flagDataUrl(s.flag)}" alt=""/>`;
      [coordLon, coordLat] = [s.lon, s.lat];
    } else if (kind === 'rover') {
      label = 'Rover';
      const tr = TRACKS.find((x) => x.craft === id)!;
      const t = getMarsTracks()?.[tr.id];
      const p0 = roverAt(t, Date.now());
      [coordLon, coordLat] = p0 ?? (tr.id === 'm20' ? [77.45, 18.44] : [137.44, -4.59]);
      if (t) {
        const n = trackCount(t, Date.now());
        rows.push(['Marstag (Sol)', fmt.num(solAt(Date.now(), t.sol0), 0)], ['Gefahrene Strecke', `${fmt.num(trackKm(t, n), 1)} km`]);
      }
      body = '<p>Die Linie zeigt die bisherige Fahrstrecke (NASA MMGIS), der Punkt die letzte bekannte Position. Beim Heranzoomen erscheint das 3D-Modell in Originalgröße.</p>';
    } else {
      label = 'Hubschrauber';
      const f = getMarsTracks()?.heli.flights ?? [];
      rows.push(['Flüge', String(f.length)], ['Flugstrecke gesamt', `${fmt.num(f.reduce((a, x) => a + x.len, 0) / 1000, 1)} km`]);
      [coordLon, coordLat] = heliAt(Date.now()) ?? [77.45, 18.44];
      body = '<p>Ingenuity flog zwischen April 2021 und Januar 2024 72-mal. Der Punkt markiert den letzten Landeplatz.</p>';
    }
    rows.push(['Koordinaten', `${fmt.num(Math.abs(coordLat), 3)}° ${coordLat >= 0 ? 'N' : 'S'}, ${fmt.num(Math.abs(coordLon), 3)}° ${coordLon >= 0 ? 'O' : 'W'}`]);
    info.hidden = false;
    info.innerHTML = `<button class="sp-close" aria-label="Schließen">×</button>
      <div class="sp-kind">${label} · ${escapeHtml(cfg().name)}</div>
      <h2 class="sp-site-title">${flag}${escapeHtml(String(p.name))}</h2>
      ${body}
      <dl>${rows.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join('')}</dl>
      <div class="sp-actions"><button class="btn small" data-a="zoom">Heranzoomen</button></div>`;
    info.querySelector('.sp-close')!.addEventListener('click', () => (info.hidden = true));
    info.querySelector('[data-a=zoom]')!.addEventListener('click', () => map?.flyTo({ center: [coordLon, coordLat], zoom: kind === 'site' ? 10 : 15.5, speed: 1.4 }));
  }

  // ----- map ---------------------------------------------------------------------
  function buildStyle() {
    const round = { 'line-cap': 'round' as const, 'line-join': 'round' as const };
    return {
      version: 8 as const,
      projection: { type: projection },
      glyphs: OFM_GLYPHS,
      sky: { 'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0] },
      sources: {
        base: {
          type: 'raster' as const,
          tiles: [tileUrl()],
          tileSize: 256,
          maxzoom: 18, // regional HiRISE mosaics reach 25 cm/px
          attribution: [...new Set(cfg().layers.map((l) => l.credit))].join(' · '),
        },
        tracks: { type: 'geojson' as const, data: EMPTY },
        heli: { type: 'geojson' as const, data: EMPTY },
        points: { type: 'geojson' as const, data: EMPTY },
      },
      layers: [
        { id: 'space', type: 'background' as const, paint: { 'background-color': '#05070d' } },
        { id: 'base', type: 'raster' as const, source: 'base' },
        { id: 'tracks-casing', type: 'line' as const, source: 'tracks', layout: round, paint: { 'line-color': 'rgba(0,0,0,0.6)', 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 3, 14, 7] } },
        { id: 'tracks', type: 'line' as const, source: 'tracks', layout: round, paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1.6, 14, 4] } },
        { id: 'heli', type: 'line' as const, source: 'heli', layout: round, paint: { 'line-color': '#ff5ad1', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.4, 16, 4] } },
        {
          id: 'points',
          type: 'circle' as const,
          source: 'points',
          paint: {
            'circle-color': ['get', 'color'],
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 4, 10, 7, 15, 9],
            'circle-opacity': ['interpolate', ['linear'], ['zoom'], 17.5, 1, 19, ['case', ['==', ['get', 'kind'], 'site'], 1, 0]],
            'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 17.5, 1, 19, ['case', ['==', ['get', 'kind'], 'site'], 1, 0]],
            'circle-stroke-color': 'rgba(0,0,0,0.8)',
            'circle-stroke-width': 2,
          },
        },
        {
          id: 'points-label',
          type: 'symbol' as const,
          source: 'points',
          layout: {
            'text-field': ['get', 'name'],
            'text-font': FONT_BOLD,
            'text-size': 12,
            'text-anchor': 'left' as const,
            'text-offset': [1, 0],
            'text-optional': true,
          },
          paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.85)', 'text-halo-width': 1.4 },
        },
      ],
    };
  }

  const ovSource = (id: string) => `ov-${id.replace(/[^\w-]/g, '_')}`;

  function setOverlay(id: string, on: boolean) {
    const p = cfg().products?.find((q) => q.id === id);
    if (!p || !map || !ready) return;
    const sid = ovSource(id);
    if (on) {
      overlays.add(id);
      if (!map.getSource(sid)) {
        map.addSource(sid, {
          type: 'raster',
          tiles: [`planet://${bodyId}/${encodeURIComponent('ov~' + id)}/{z}/{x}/{y}`],
          tileSize: 256,
          maxzoom: 18,
          ...(isGlobal(p.bbox) ? {} : { bounds: p.bbox }),
          attribution: p.layer.credit,
        });
        map.addLayer({ id: sid, type: 'raster', source: sid, paint: { 'raster-opacity': 0.6 } }, 'tracks-casing');
      }
    } else {
      overlays.delete(id);
      if (map.getLayer(sid)) map.removeLayer(sid);
      if (map.getSource(sid)) map.removeSource(sid);
    }
  }

  function initMap() {
    registerPlanetProtocol();
    map = new MlMap({
      container: mapEl,
      style: buildStyle() as never,
      center: initial ? [initial.lon, initial.lat] : [77.45, 18.44],
      zoom: initial ? (initial.fromSpace ? 0.3 : initial.zoom) : 3,
      maxPitch: 60,
      maxZoom: MAX_ZOOM,
      minZoom: 0.3, // below this the 3D globe hands over to the solar system
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-right');

    // 2D / 3D / solar system (same control as the Earth map)
    projCtl = document.createElement('div');
    projCtl.className = 'maplibregl-ctrl maplibregl-ctrl-group proj-ctl';
    projCtl.setAttribute('role', 'group');
    projCtl.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-proj]');
      if (!btn || !map) return;
      if (btn.dataset.proj === 'space') {
        const c = map.getCenter();
        deps.onOpenSpace(bodyId, c.lat, c.lng);
        return;
      }
      setProjection(btn.dataset.proj as typeof projection);
    });
    renderProj();
    map.addControl({ onAdd: () => projCtl!, onRemove: () => projCtl!.remove() }, 'top-right');

    // zooming further out of the 3D globe leaves the planet
    let outTicks = 0;
    let outTimer = 0;
    map.getContainer().addEventListener(
      'wheel',
      (e) => {
        if (!map || projection !== 'globe' || e.deltaY <= 0 || map.getZoom() > map.getMinZoom() + 0.05) {
          outTicks = 0;
          return;
        }
        clearTimeout(outTimer);
        outTimer = window.setTimeout(() => (outTicks = 0), 900);
        if (++outTicks >= 4) {
          outTicks = 0;
          const c = map.getCenter();
          deps.onOpenSpace(bodyId, c.lat, c.lng);
        }
      },
      { passive: true },
    );

    map.on('load', () => {
      ready = true;
      map!.addLayer(models);
      applyLabels();
      if (pending) {
        goto(pending);
        pending = null;
      }
      refreshData();
      void loadMarsTracks().then(() => {
        tracksLoaded = true;
        refreshData();
        if (pendingSelect) selectBy(pendingSelect);
        pendingSelect = null;
      });
    });
    map.on('click', 'points', (e) => {
      const f = e.features?.[0] as MapGeoJSONFeature | undefined;
      if (f) showInfo(f.properties);
    });
    map.on('mouseenter', 'points', () => (map!.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', 'points', () => (map!.getCanvas().style.cursor = ''));
    map.on('zoomend', () => {
      if (map && map.getZoom() >= 10) models.load();
    });
    map.on('moveend', () => {
      if (!map || el.hidden) return;
      const c = map.getCenter();
      const h = `#/planet?body=${bodyId}&view=${projection === 'globe' ? '3d' : '2d'}&lat=${c.lat.toFixed(3)}&lon=${c.lng.toFixed(3)}&zoom=${map.getZoom().toFixed(2)}`;
      if (location.hash !== h) history.replaceState(null, '', h);
    });
  }

  function renderProj() {
    if (!projCtl) return;
    projCtl.innerHTML =
      (['mercator', 'globe'] as const)
        .map((p) => `<button type="button" data-proj="${p}" class="${projection === p ? 'on' : ''}" aria-pressed="${projection === p}" title="${p === 'globe' ? '3D-Globus' : '2D-Karte'}">${p === 'globe' ? '3D' : '2D'}</button>`)
        .join('') +
      `<button type="button" data-proj="space" title="Ins Sonnensystem" aria-label="Ins Sonnensystem"><svg viewBox="0 0 24 24" class="ctl-ic"><circle cx="12" cy="12" r="4.5"/><ellipse cx="12" cy="12" rx="10" ry="3.6" transform="rotate(-20 12 12)"/></svg></button>`;
  }

  function setProjection(next: typeof projection) {
    if (next === projection) return;
    projection = next;
    map?.setProjection({ type: next });
    renderProj();
  }

  function goto(p: { lat: number; lon: number; zoom: number; fromSpace?: boolean; jump?: boolean }) {
    if (!map) return;
    if (p.jump) map.jumpTo({ center: [p.lon, p.lat], zoom: p.zoom });
    else if (p.fromSpace) {
      // coming back from the solar system: start far out and dive in
      map.jumpTo({ center: [p.lon, p.lat], zoom: map.getMinZoom() });
      map.easeTo({ zoom: p.zoom, duration: 1600 });
    } else map.flyTo({ center: [p.lon, p.lat], zoom: p.zoom, speed: 1.4, essential: true });
  }

  function selectBy(o: { focus?: string; site?: string }) {
    if (o.focus) showInfo({ id: o.focus, kind: o.focus === 'ingenuity' ? 'heli' : 'rover', name: o.focus === 'ingenuity' ? 'Ingenuity' : TRACKS.find((t) => t.craft === o.focus)?.name ?? o.focus });
    else if (o.site) showInfo({ id: o.site, kind: 'site', name: MARS_SITES.find((s) => s.id === o.site)?.name ?? o.site });
  }

  // ----- overlays & the "what is shown" indicator -------------------------------
  const ovColor = (p: { title: string }) => (/Geology/i.test(p.title) ? '#c9a46a' : /Valley/i.test(p.title) ? '#5ad1ff' : '#c58bff');
  /** global overlays first, regional ones after */
  const ovProducts = () =>
    (cfg().products ?? [])
      .filter((p) => p.group === 'overlay')
      .sort((x, y) => Number(isGlobal(y.bbox)) - Number(isGlobal(x.bbox)) || overlayName(x).localeCompare(overlayName(y), 'de'));
  /** short names: "MRO CRISM Fe-Mg Smectite Indicator, CRISM tile 1303" → "Smectit (CRISM)" */
  function overlayName(p: { title: string }) {
    const t = p.title;
    if (/Geology/i.test(t)) return 'Geologie';
    if (/Valley/i.test(t)) return 'Täler';
    if (/Smectite/i.test(t)) return 'Smektit (CRISM)';
    if (/Sulfate/i.test(t)) return 'Sulfat (CRISM)';
    return t.replace(/^MRO |^MGS /, '');
  }
  function toggleOverlay(id: string) {
    const on = !overlays.has(id);
    setOverlay(id, on);
    // regional overlays only exist in their footprint: take the user there
    const p = cfg().products?.find((q) => q.id === id);
    if (on && p && !isGlobal(p.bbox) && map) {
      const c = map.getCenter();
      if (c.lng < p.bbox[0] || c.lng > p.bbox[2] || c.lat < p.bbox[1] || c.lat > p.bbox[3]) {
        const span = Math.max(p.bbox[2] - p.bbox[0], p.bbox[3] - p.bbox[1]);
        goto({ lat: (p.bbox[1] + p.bbox[3]) / 2, lon: (p.bbox[0] + p.bbox[2]) / 2, zoom: Math.max(3, Math.min(9, Math.log2(360 / span) + 1)) });
      }
    }
    renderPanel();
    renderBase();
    renderActive();
  }

  /** all selectable base maps (global ones; regional ones depend on the map centre) */
  function baseOptions() {
    const c = cfg();
    const products = c.products ?? [];
    const hasMosaics = products.some((p) => p.group === 'mosaic');
    return [
      { id: 'auto', label: hasMosaics ? 'Automatisch (Farbe → 5 m → HiRISE)' : 'Automatisch', short: 'Automatisch', img: thumb(c.detail3d(0)) },
      ...(hasMosaics ? [{ id: 'global', label: 'Farbmosaik (Viking, 232 m)', short: 'Farbmosaik', img: thumb(c.detail3d(0)) }] : []),
      ...c.layers.map((l) => ({ id: l.id, label: l.label, short: l.label.replace(/ \(.*$/, ''), img: thumb(l) })),
      ...products.filter((p) => p.group === 'base' && isGlobal(p.bbox)).map((p) => ({ id: p.id, label: baseName(p.title), short: baseName(p.title), img: thumb(p.layer) })),
    ];
  }
  function baseName(t: string) {
    if (/Color Hillshade Blend/.test(t)) return 'Höhe & Tiefe (MOLA/HRSC, 200 m)';
    if (/THEMIS-IR Day/.test(t)) return 'Infrarot (THEMIS, 100 m)';
    if (/^Mars Express HRSC/.test(t)) return t.replace(/^Mars Express HRSC, /, 'HRSC · ').replace(/ Color Mosaic| Mosaic/g, '');
    return t;
  }

  /** the chips on the map: current base map + everything drawn over it (✕ hides) */
  function renderActive() {
    const mars = bodyId === 'mars';
    const all = baseOptions();
    const regional = (cfg().products ?? []).find((p) => p.id === layerId);
    const cur = all.find((o) => o.id === layerId) ?? (regional ? { short: baseName(regional.title) } : all[0]);
    const chips: { label: string; color?: string; off?: string }[] = [];
    for (const p of ovProducts()) if (overlays.has(p.id)) chips.push({ label: overlayName(p), color: ovColor(p), off: `ov:${p.id}` });
    if (show.sites) chips.push({ label: 'Landestellen', color: '#ffffff', off: 'sites' });
    if (mars && show.tracks) chips.push({ label: 'Rover-Spuren', color: 'linear-gradient(90deg,#ffb347,#5ad1ff)', off: 'tracks' });
    if (mars && show.heli) chips.push({ label: 'Ingenuity', color: '#ff5ad1', off: 'heli' });
    activeEl.innerHTML =
      `<span class="pm-chip base" title="Aktuelle Karte">${escapeHtml(cur.short)}</span>` +
      chips
        .map((c) => `<button type="button" class="pm-chip" data-off="${c.off}" title="Ausblenden"><i style="background:${c.color}"></i>${escapeHtml(c.label)}<b aria-hidden="true">×</b></button>`)
        .join('');
  }
  activeEl.addEventListener('click', (e) => {
    const k = (e.target as HTMLElement).closest<HTMLElement>('[data-off]')?.dataset.off;
    if (!k) return;
    if (k.startsWith('ov:')) toggleOverlay(k.slice(3));
    else {
      show[k as keyof typeof show] = false;
      refreshData();
      applyLabels();
      renderPanel();
      renderActive();
    }
  });

  // ----- panel, search, base maps (same look as the Earth map) ------------------
  function renderPanel() {
    const mars = bodyId === 'mars';
    const tile = (opt: string, on: boolean, color: string, label: string) =>
      `<button type="button" class="ltile ${on ? 'on' : ''}" data-opt="${opt}" aria-pressed="${on}"><span class="swatch" style="background:${color}"></span><span class="ltile-label">${label}</span></button>`;
    panel.innerHTML = `
      <div class="ptabs" role="tablist">
        <button type="button" role="tab" class="ptab ${panelTab === 'layers' ? 'on' : ''}" data-tab="layers">Ebenen</button>
        <button type="button" role="tab" class="ptab ${panelTab === 'places' ? 'on' : ''}" data-tab="places">Orte</button>
      </div>
      <div class="panel-scroll">
        <h3>${escapeHtml(cfg().name)}</h3>
        ${
          panelTab === 'layers'
            ? `<h3 class="sp-sub">Markierungen</h3>
              <div class="tile-grid three">
                ${tile('sites', show.sites, '#ffffff', 'Landestellen')}
                ${mars ? tile('tracks', show.tracks, 'linear-gradient(135deg,#ffb347,#5ad1ff)', 'Rover-Spuren') : ''}
                ${mars ? tile('heli', show.heli, '#ff5ad1', 'Ingenuity') : ''}
                ${tile('labels', show.labels, '#8899bb', 'Namen')}
              </div>
              ${
                ovProducts().length
                  ? `<h3 class="sp-sub">Überlagerungen</h3>
              <div class="tile-grid three">${ovProducts()
                .map((p) => tile(`ov:${p.id}`, overlays.has(p.id), ovColor(p), overlayName(p)).replace('data-opt=', 'data-ov-tile='))
                .join('')}</div>
              <p class="small muted">Überlagerungen liegen halbtransparent über der gewählten Karte. Regionale (Mineralien) gelten nur in ihrem Gebiet.</p>`
                  : ''
              }`
            : `<div class="sp-sites pm-jump">${places().map((p) => `<button class="sp-site" data-place="${p.id}">${escapeHtml(p.name)}</button>`).join('')}
                ${mars ? '<button class="sp-site" data-place="olympus">Olympus Mons</button><button class="sp-site" data-place="valles">Valles Marineris</button>' : ''}</div>`
        }
      </div>`;
    panel.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((b) =>
      b.addEventListener('click', () => {
        panelTab = b.dataset.tab as typeof panelTab;
        renderPanel();
      }),
    );
    panel.querySelectorAll<HTMLButtonElement>('[data-opt]').forEach((b) =>
      b.addEventListener('click', () => {
        const k = b.dataset.opt as keyof typeof show;
        show[k] = !show[k];
        refreshData();
        applyLabels();
        renderPanel();
        renderActive();
      }),
    );
    panel.querySelectorAll<HTMLButtonElement>('[data-ov-tile]').forEach((b) =>
      b.addEventListener('click', () => toggleOverlay(b.dataset.ovTile!.slice(3))),
    );
    panel.querySelectorAll<HTMLButtonElement>('[data-place]').forEach((b) => b.addEventListener('click', () => goTo(b.dataset.place!)));
  }

  function goTo(id: string) {
    const known: Record<string, [number, number, number]> = { olympus: [18.65, -133.8, 5.5], valles: [-13.9, -59.2, 5] };
    if (known[id]) return goto({ lat: known[id][0], lon: known[id][1], zoom: known[id][2] });
    if (id === 'm20' || id === 'msl') {
      const p = roverAt(getMarsTracks()?.[id], Date.now()) ?? (id === 'm20' ? [77.45, 18.44] : [137.44, -4.59]);
      goto({ lat: p[1], lon: p[0], zoom: 14 });
      const tr = TRACKS.find((x) => x.id === id)!;
      return showInfo({ id: tr.craft, kind: 'rover', name: tr.name });
    }
    const s = MARS_SITES.find((x) => x.id === id);
    if (s) {
      goto({ lat: s.lat, lon: s.lon, zoom: 10 });
      showInfo({ id: s.id, kind: 'site', name: s.name });
    }
  }

  searchEl.addEventListener('change', () => {
    const q = searchEl.value.trim().toLowerCase();
    const hit = places().find((p) => p.name.toLowerCase() === q) ?? places().find((p) => p.name.toLowerCase().includes(q));
    if (hit) {
      goTo(hit.id);
      searchEl.blur();
    }
  });
  el.querySelector('.panel-toggle')!.addEventListener('click', (e) => {
    panel.hidden = !panel.hidden;
    (e.currentTarget as HTMLElement).setAttribute('aria-expanded', String(!panel.hidden));
  });

  const thumb = (l: TileLayer) => l.url(2, 1, 4);
  /** popup: only maps (standard maps + regional maps at the current centre) – overlays live in the panel */
  function renderBase(open = false) {
    const c = cfg();
    const center = map?.getCenter();
    const here = (b: [number, number, number, number]) => !center || (center.lng >= b[0] && center.lng <= b[2] && center.lat >= b[1] && center.lat <= b[3]);
    const std = baseOptions();
    const regional = (c.products ?? []).filter((p) => p.group === 'region' && here(p.bbox));
    const cur = std.find((o) => o.id === layerId) ?? (regional.find((p) => p.id === layerId) ? { ...std[0], img: thumb(regional.find((p) => p.id === layerId)!.layer) } : std[0]);
    baseSwitch.innerHTML = `
      <button type="button" class="base-current" aria-expanded="${open}" title="Karte wählen">
        <span class="thumb"><img alt="" src="${cur.img}"/></span>
        <span class="base-current-label"><svg viewBox="0 0 24 24"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/></svg>Karte</span>
      </button>
      <div class="base-pop" ${open ? '' : 'hidden'}>
        <div class="base-options">
          ${std.map((o) => `<button type="button" class="base-opt ${o.id === layerId ? 'on' : ''}" data-base="${o.id}"><span class="thumb"><img alt="" loading="lazy" src="${o.img}"/></span><span>${escapeHtml(o.label)}</span></button>`).join('')}
          ${regional.map((p) => `<button type="button" class="base-opt ${p.id === layerId ? 'on' : ''}" data-base="${escapeHtml(p.id)}"><span class="thumb"><img alt="" loading="lazy" src="${thumb(p.layer)}"/></span><span>${escapeHtml(baseName(p.title))}</span></button>`).join('')}
        </div>
      </div>`;
    const pop = baseSwitch.querySelector<HTMLElement>('.base-pop')!;
    const btn = baseSwitch.querySelector<HTMLButtonElement>('.base-current')!;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      renderBase(pop.hidden); // re-render: the regional entries depend on the map centre
    });
    baseSwitch.querySelectorAll<HTMLButtonElement>('[data-base]').forEach((b) =>
      b.addEventListener('click', () => {
        layerId = b.dataset.base!;
        setTiles();
        renderBase(true);
        renderActive();
      }),
    );
  }
  document.addEventListener('click', (e) => {
    const pop = baseSwitch.querySelector<HTMLElement>('.base-pop');
    if (pop && !pop.hidden && !baseSwitch.contains(e.target as Node)) renderBase(false);
  });

  return {
    el,
    activate(o) {
      const changed = o.body !== bodyId || !map;
      bodyId = PLANET_MAPS[o.body]?.layers.length ? o.body : 'mars';
      if (o.projection) {
        if (map) setProjection(o.projection);
        else projection = o.projection;
      }
      el.hidden = false;
      if (changed) {
        layerId = 'auto';
        placesEl.innerHTML = places().map((p) => `<option value="${escapeHtml(p.name)}"></option>`).join('');
        renderPanel();
        renderBase();
        renderActive();
      }
      const zoom = o.zoom ?? (o.focus ? 14.5 : o.site ? 9 : o.fromSpace ? 2.5 : 4);
      if (!map && o.lat != null && o.lon != null) initial = { lat: o.lat, lon: o.lon, zoom, fromSpace: o.fromSpace };
      if (!map) initMap();
      else {
        map.resize();
        setTiles();
      }
      info.hidden = true;
      if (o.lat != null && o.lon != null) {
        const p = { lat: o.lat, lon: o.lon, zoom, fromSpace: o.fromSpace };
        if (map && ready) goto(p);
        else if (initial) pending = p.fromSpace ? p : null; // first open: the map was created there already
        else pending = p;
      }
      if (o.focus || o.site) {
        if (tracksLoaded) selectBy(o);
        else pendingSelect = o;
      }
      if (ready) refreshData();
    },
    deactivate() {
      el.hidden = true;
      info.hidden = true;
    },
  };
}
