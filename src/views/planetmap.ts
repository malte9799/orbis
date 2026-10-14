import { PLANET_MAPS, type TileLayer } from '../space/planets';
import { MARS_SITES, getMarsTracks, loadMarsTracks, roverAt, solAt, trackCount, trackKm, heliAt, type Track } from '../space/mars';
import { COUNTRY, flagDataUrl } from '../space/moon';
import { escapeHtml, fmt } from '../util';

// 2D map of a planet (equirectangular tile pyramids, see space/planets.ts) – the counterpart
// of the Earth map for the other bodies: zooming far into a planet in the space view opens
// it, "3D" returns to the globe. Overlays: landing sites, rover traverses, Ingenuity flights.

export interface PlanetMapView {
  el: HTMLElement;
  activate(o: { body: string; view: '2d' | '3d'; lat?: number; lon?: number; zoom?: number; focus?: string; site?: string }): void;
  deactivate(): void;
}

/** What the planet map needs from the rest of the app (routing, the 3D renderer). */
export interface PlanetDeps {
  /** switch view / jump: writes the route */
  go(body: string, view: '2d' | '3d', lat: number, lon: number, o?: { focus?: string; site?: string }): void;
  solar(body: string): void;
  /** the 3D renderer (space view in planet mode) */
  three: {
    setLayer(id: string): void;
    setOverlays(o: { sites?: boolean; tracks?: boolean; labels?: boolean }): void;
    center(): { lat: number; lon: number } | null;
    zoomBy(f: number): void;
  };
}

interface Marker {
  id: string;
  kind: 'site' | 'rover' | 'heli';
  name: string;
  lat: number;
  lon: number;
  color: string;
  /** kind of 3D target (space view focus id) */
  craft?: string;
  siteId?: string;
}

interface Img {
  img: HTMLImageElement;
  state: 'loading' | 'ready' | 'error';
}

const MAX_LOADS = 10;
const MAX_CACHED = 400;
const TRACKS: { id: 'm20' | 'msl'; color: string; name: string; craft: string }[] = [
  { id: 'm20', color: '#ffb347', name: 'Perseverance', craft: 'perseverance' },
  { id: 'msl', color: '#5ad1ff', name: 'Curiosity', craft: 'curiosity' },
];

export function createPlanetMapView(deps: PlanetDeps): PlanetMapView {
  const el = document.createElement('main');
  el.className = 'view globe-view planet-view';
  el.hidden = true;
  el.innerHTML = `
    <canvas class="pm-canvas"></canvas>
    <div class="globe-top">
      <button class="btn icon-btn panel-toggle" aria-label="Ebenen" title="Ebenen" aria-expanded="true">
        <svg viewBox="0 0 24 24"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/></svg>
      </button>
      <div class="search"><svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="21" y2="21"/></svg><input class="pm-search" type="search" list="pm-places" placeholder="Ort oder Rover suchen …" aria-label="Suchen" autocomplete="off"/><datalist id="pm-places"></datalist></div>
    </div>
    <aside class="panel pm-panel"></aside>
    <div class="base-switch"></div>
    <div class="maplibregl-ctrl-top-right pm-ctrls"></div>
    <div class="pm-status"><span class="pm-coord"></span><span class="pm-scale"><i></i><b></b></span></div>
    <section class="space-info pm-info" hidden></section>`;

  const canvas = el.querySelector<HTMLCanvasElement>('.pm-canvas')!;
  const ctx = canvas.getContext('2d')!;
  const panel = el.querySelector<HTMLElement>('.pm-panel')!;
  const searchEl = el.querySelector<HTMLInputElement>('.pm-search')!;
  const placesEl = el.querySelector<HTMLDataListElement>('#pm-places')!;
  const ctrlsEl = el.querySelector<HTMLElement>('.pm-ctrls')!;
  const baseSwitch = el.querySelector<HTMLElement>('.base-switch')!;
  const statusEl = el.querySelector<HTMLElement>('.pm-status')!;
  const info = el.querySelector<HTMLElement>('.pm-info')!;
  const coordEl = el.querySelector<HTMLElement>('.pm-coord')!;
  const scaleBar = el.querySelector<HTMLElement>('.pm-scale i')!;
  const scaleTxt = el.querySelector<HTMLElement>('.pm-scale b')!;
  if (window.innerWidth <= 720) panel.hidden = true;
  let view: '2d' | '3d' = '3d';
  let panelTab: 'layers' | 'places' = 'layers';

  let bodyId = 'mars';
  /** selected layer; 'auto' = colour mosaic far out, the sharpest one close in (as in the 3D view) */
  let layerId = 'auto';
  const layerFor = (z: number): TileLayer => (layerId === 'auto' ? PLANET_MAPS[bodyId].detail3d(z) : PLANET_MAPS[bodyId].layers.find((l) => l.id === layerId) ?? PLANET_MAPS[bodyId].layers[0]);
  const maxZOf = () => (layerId === 'auto' ? Math.max(...PLANET_MAPS[bodyId].layers.map((l) => l.maxZ)) : layerFor(0).maxZ);
  const pxMax = () => layerFor(99).px;
  let cLat = 18.4;
  let cLon = 77.4;
  let ppd = 6; // screen pixels per degree
  let W = 0;
  let H = 0;
  let dpr = 1;
  let active = false;
  let raf = 0;
  let dirty = true;
  const show = { sites: true, tracks: true, heli: true, labels: true };
  let markers: Marker[] = [];
  let selected: string | null = null;

  const cache = new Map<string, Img>();
  let loads = 0;

  // ----- helpers -----------------------------------------------------------
  const R = () => PLANET_MAPS[bodyId].radiusKm;
  const ppdMin = () => Math.max(H / 180, 1.2);
  const ppdMax = () => ((pxMax() * 2 ** maxZOf()) / 180) * 3;
  const sx = (lon: number) => W / 2 + (((lon - cLon + 540) % 360) - 180) * ppd;
  const sy = (lat: number) => H / 2 - (lat - cLat) * ppd;
  const wrapLon = (l: number) => ((((l + 180) % 360) + 360) % 360) - 180;
  const invalidate = () => (dirty = true);

  function clampView() {
    ppd = Math.min(ppdMax(), Math.max(ppdMin(), ppd));
    cLat = Math.max(-90, Math.min(90, cLat));
    cLon = wrapLon(cLon);
  }

  // ----- tiles -------------------------------------------------------------
  const key = (z: number, r: number, c: number) => `${layerFor(z).id}/${z}/${r}/${c}`;

  function request(z: number, r: number, c: number) {
    const k = key(z, r, c);
    if (cache.has(k) || loads >= MAX_LOADS) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const entry: Img = { img, state: 'loading' };
    cache.set(k, entry);
    loads++;
    img.onload = () => {
      loads--;
      entry.state = 'ready';
      invalidate();
    };
    img.onerror = () => {
      loads--;
      entry.state = 'error';
      invalidate();
    };
    img.src = layerFor(z).url(z, r, c);
  }

  function evict() {
    if (cache.size <= MAX_CACHED) return;
    for (const [k, v] of cache) {
      if (cache.size <= MAX_CACHED * 0.8) break;
      if (v.state !== 'loading') cache.delete(k);
    }
  }

  function drawTiles() {
    // the finest level with ≥ 1 texel per device pixel, but never finer than the server has
    const wantFor = (px: number) => Math.ceil(Math.log2((ppd * dpr * 180) / px));
    let z = Math.max(0, Math.min(maxZOf(), wantFor(layerFor(wantFor(256)).px)));
    z = Math.max(0, Math.min(maxZOf(), wantFor(layerFor(z).px)));
    const missing: { z: number; r: number; c: number; d: number }[] = [];
    ctx.fillStyle = '#05070d';
    ctx.fillRect(0, 0, W, H);
    const pass = (z: number) => {
      const span = 180 / 2 ** z;
      const lat0 = cLat + H / 2 / ppd;
      const lat1 = cLat - H / 2 / ppd;
      const rowA = Math.max(0, Math.floor((90 - lat0) / span));
      const rowB = Math.min(2 ** z - 1, Math.floor((90 - lat1) / span));
      const lon0 = cLon - W / 2 / ppd;
      const lon1 = cLon + W / 2 / ppd;
      const n = 2 * 2 ** z;
      for (let r = rowA; r <= rowB; r++) {
        const top = sy(90 - r * span);
        const h = span * ppd;
        for (let wc = Math.floor((lon0 + 180) / span); wc <= Math.floor((lon1 + 180) / span); wc++) {
          const c = ((wc % n) + n) % n;
          const x = W / 2 + (-180 + wc * span - cLon) * ppd;
          const w = span * ppd;
          const e = cache.get(key(z, r, c));
          if (e?.state === 'ready') ctx.drawImage(e.img, x, top, w + 0.6, h + 0.6);
          else {
            if (!e) missing.push({ z, r, c, d: Math.hypot(x + w / 2 - W / 2, top + h / 2 - H / 2) });
            // coarser ancestor while this one loads
            for (let up = 1; up <= z; up++) {
              const a = cache.get(key(z - up, r >> up, c >> up));
              if (a?.state !== 'ready') continue;
              const f = 2 ** up;
              const sw = a.img.width / f;
              const sh = a.img.height / f;
              ctx.drawImage(a.img, (c % f) * sw, (r % f) * sh, sw, sh, x, top, w + 0.6, h + 0.6);
              break;
            }
          }
        }
      }
    };
    // the colour mosaic underneath: the detail mosaic has holes and no colour
    if (layerId === 'auto' && z > 6) pass(6);
    pass(z);
    missing.sort((a, b) => a.d - b.d);
    for (const m of missing) {
      // a coarse ancestor first, so something shows while the fine tiles arrive
      const up = Math.min(m.z, 3);
      request(m.z - up, m.r >> up, m.c >> up);
    }
    for (const m of missing) request(m.z, m.r, m.c);
    evict();
    // keep loading as tiles arrive
    if (missing.length || loads) dirty = true;
  }

  // ----- overlays ----------------------------------------------------------
  function rebuildMarkers() {
    markers = [];
    if (bodyId !== 'mars') return;
    const t = getMarsTracks();
    const now = Date.now();
    // sites with a rover are shown by the rover marker (and its track) itself
    for (const s of MARS_SITES.filter((x) => !x.hideFlag)) markers.push({ id: s.id, siteId: s.id, kind: 'site', name: s.name, lat: s.lat, lon: s.lon, color: '#ffffff' });
    for (const tr of TRACKS) {
      const p = roverAt(t?.[tr.id], now);
      if (p) markers.push({ id: tr.craft, kind: 'rover', name: tr.name, lon: p[0], lat: p[1], color: tr.color, craft: tr.craft });
    }
    const h = heliAt(now);
    if (h && t) markers.push({ id: 'ingenuity', kind: 'heli', name: 'Ingenuity', lon: h[0], lat: h[1], color: '#ff5ad1', craft: 'ingenuity' });
  }

  function strokeTrack(pts: ArrayLike<number>, n: number, color: string, width: number) {
    if (n < 2) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let prevX = 0;
    for (let i = 0; i < n; i++) {
      const x = sx(pts[i * 2]);
      const y = sy(pts[i * 2 + 1]);
      if (i === 0 || Math.abs(x - prevX) > W) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      prevX = x;
    }
    ctx.stroke();
  }

  function drawOverlays() {
    const t = getMarsTracks();
    if (bodyId !== 'mars' || !t) return;
    const now = Date.now();
    if (show.tracks)
      for (const tr of TRACKS) {
        const track: Track = t[tr.id];
        strokeTrack(track.ll, trackCount(track, now), 'rgba(0,0,0,0.55)', 4.5);
        strokeTrack(track.ll, trackCount(track, now), tr.color, 2.5);
      }
    if (show.heli) {
      const t0 = Date.parse(t.heli.sol0);
      for (const f of t.heli.flights) {
        if (t0 + f.sol * 88_775_244 > now) continue;
        strokeTrack(f.pts, f.pts.length / 2, '#ff5ad1', 2);
      }
    }
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    for (const m of markers) {
      if (m.kind === 'site' && !show.sites) continue;
      if (m.kind === 'heli' && !show.heli) continue;
      if (m.kind === 'rover' && !show.tracks) continue;
      const x = sx(m.lon);
      const y = sy(m.lat);
      if (x < -40 || x > W + 40 || y < -20 || y > H + 20) continue;
      const sel = m.id === selected;
      const r = m.kind === 'site' ? 5 : 7;
      ctx.beginPath();
      ctx.arc(x, y, r + (sel ? 3 : 0), 0, Math.PI * 2);
      ctx.fillStyle = m.color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(0,0,0,0.75)';
      ctx.stroke();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.fillStyle = '#fff';
      ctx.strokeText(m.name, x + r + 6, y);
      ctx.fillText(m.name, x + r + 6, y);
    }
  }

  function updateScale() {
    const kmPerPxEq = (2 * Math.PI * R()) / 360 / ppd;
    const target = kmPerPxEq * 110;
    const pow = 10 ** Math.floor(Math.log10(target));
    const nice = [1, 2, 5, 10].map((m) => m * pow).find((v) => v >= target * 0.7) ?? pow * 10;
    scaleBar.style.width = `${nice / kmPerPxEq}px`;
    scaleTxt.textContent = nice >= 1 ? `${nice} km` : `${nice * 1000} m`;
  }

  function frame() {
    if (!active) return;
    raf = requestAnimationFrame(frame);
    if (!dirty) return;
    dirty = false;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawTiles();
    drawOverlays();
    updateScale();
  }

  function resize() {
    W = el.clientWidth;
    H = el.clientHeight;
    if (!W || !H) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    clampView();
    invalidate();
  }
  new ResizeObserver(resize).observe(el);

  // ----- interaction -------------------------------------------------------
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch = 0;
  let moved = 0;

  const lonAt = (x: number) => cLon + (x - W / 2) / ppd;
  const latAt = (y: number) => cLat - (y - H / 2) / ppd;

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    moved = 0;
    pinch = pointers.size === 2 ? dist() : 0;
  });
  const dist = () => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  canvas.addEventListener('pointermove', (e) => {
    coordEl.textContent = `${fmt.num(Math.abs(latAt(e.offsetY)), 3)}° ${latAt(e.offsetY) >= 0 ? 'N' : 'S'}, ${fmt.num(Math.abs(wrapLon(lonAt(e.offsetX))), 3)}° ${wrapLon(lonAt(e.offsetX)) >= 0 ? 'O' : 'W'}`;
    const p = pointers.get(e.pointerId);
    if (!p) return;
    if (pointers.size === 2) {
      pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      const d = dist();
      if (pinch) zoomAt(W / 2, H / 2, d / pinch);
      pinch = d;
      moved += 10;
      return;
    }
    const dx = e.offsetX - p.x;
    const dy = e.offsetY - p.y;
    moved += Math.abs(dx) + Math.abs(dy);
    cLon -= dx / ppd;
    cLat += dy / ppd;
    p.x = e.offsetX;
    p.y = e.offsetY;
    clampView();
    invalidate();
  });
  const up = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    pinch = 0;
    if (moved < 5 && e.type === 'pointerup') pick(e.offsetX, e.offsetY);
    persist();
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  function zoomAt(x: number, y: number, f: number) {
    const lon = lonAt(x);
    const lat = latAt(y);
    ppd = Math.min(ppdMax(), Math.max(ppdMin(), ppd * f));
    cLon = lon - (x - W / 2) / ppd;
    cLat = lat + (y - H / 2) / ppd;
    clampView();
    invalidate();
  }
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)));
      persist();
    },
    { passive: false },
  );
  canvas.addEventListener('dblclick', (e) => {
    zoomAt(e.offsetX, e.offsetY, 2);
    persist();
  });

  let persistTimer = 0;
  function persist() {
    clearTimeout(persistTimer);
    persistTimer = window.setTimeout(() => {
      if (!active) return;
      if (view !== '2d') return;
      const h = `#/planet?body=${bodyId}&view=2d&lat=${cLat.toFixed(3)}&lon=${cLon.toFixed(3)}&zoom=${Math.log2(ppd / 1.4222).toFixed(2)}`;
      if (location.hash !== h) history.replaceState(null, '', h);
    }, 300);
  }

  function pick(x: number, y: number) {
    let best: Marker | null = null;
    let bd = 16;
    for (const m of markers) {
      if ((m.kind === 'site' && !show.sites) || (m.kind === 'heli' && !show.heli) || (m.kind === 'rover' && !show.tracks)) continue;
      const d = Math.hypot(sx(m.lon) - x, sy(m.lat) - y);
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    if (best) select(best);
    else {
      selected = null;
      info.hidden = true;
      invalidate();
    }
  }

  function select(m: Marker) {
    selected = m.id;
    invalidate();
    const coord = `${fmt.num(Math.abs(m.lat), 3)}° ${m.lat >= 0 ? 'N' : 'S'}, ${fmt.num(Math.abs(m.lon), 3)}° ${m.lon >= 0 ? 'O' : 'W'}`;
    let body = '';
    let kind = 'Landestelle';
    const rows: [string, string][] = [['Koordinaten', coord]];
    if (m.kind === 'site') {
      const s = MARS_SITES.find((x) => x.id === m.siteId)!;
      body = `<p>${escapeHtml(s.text)}</p>`;
      rows.unshift(['Landung', new Date(s.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })], ['Nation', COUNTRY[s.flag]], ['Ort', s.region]);
      if (s.craft) rows.splice(2, 0, ['Mission', s.craft]);
    } else if (m.kind === 'rover') {
      const t = getMarsTracks()?.[m.craft === 'curiosity' ? 'msl' : 'm20'];
      kind = 'Rover';
      if (t) {
        const n = trackCount(t, Date.now());
        rows.unshift(['Marstag (Sol)', fmt.num(solAt(Date.now(), t.sol0), 0)], ['Gefahrene Strecke', `${fmt.num(trackKm(t, n), 1)} km`]);
      }
      body = '<p>Die Linie zeigt die bisherige Fahrstrecke (NASA MMGIS), der Punkt die letzte bekannte Position.</p>';
    } else {
      kind = 'Hubschrauber';
      const f = getMarsTracks()?.heli.flights ?? [];
      rows.unshift(['Flüge', String(f.length)], ['Flugstrecke gesamt', `${fmt.num(f.reduce((a, x) => a + x.len, 0) / 1000, 1)} km`]);
      body = '<p>Ingenuity flog zwischen April 2021 und Januar 2024 72-mal. Der Punkt markiert den letzten Landeplatz.</p>';
    }
    info.hidden = false;
    info.innerHTML = `<button class="sp-close" aria-label="Schließen">×</button>
      <div class="sp-kind">${kind} · ${escapeHtml(PLANET_MAPS[bodyId].name)}</div>
      <h2 class="sp-site-title">${m.kind === 'site' ? `<img class="sp-flag" src="${flagDataUrl(MARS_SITES.find((x) => x.id === m.siteId)!.flag)}" alt=""/>` : ''}${escapeHtml(m.name)}</h2>
      ${body}
      <dl>${rows.map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`).join('')}</dl>
      <div class="sp-actions"><button class="btn small" data-a="3d">In 3D ansehen</button></div>`;
    info.querySelector('.sp-close')!.addEventListener('click', () => {
      info.hidden = true;
      selected = null;
      invalidate();
    });
    info.querySelector('[data-a=3d]')!.addEventListener('click', () => deps.go(bodyId, '3d', m.lat, m.lon, { focus: m.craft, site: m.siteId }));
  }

  function flyTo(lat: number, lon: number, z = 9) {
    cLat = lat;
    cLon = lon;
    ppd = Math.min(ppdMax(), Math.max(ppdMin(), 1.4222 * 2 ** z));
    clampView();
    invalidate();
    persist();
  }

  // ----- controls (same look as the Earth map) -----------------------------
  const places = () => (bodyId === 'mars' ? [...TRACKS.map((t) => ({ id: t.id as string, name: t.name })), ...MARS_SITES.filter((x) => !x.hideFlag).map((x) => ({ id: x.id, name: x.name }))] : []);

  function renderCtrls() {
    ctrlsEl.innerHTML = `
      <div class="maplibregl-ctrl maplibregl-ctrl-group pm-zoom">
        <button type="button" data-z="in" aria-label="Vergrößern" title="Vergrößern">+</button>
        <button type="button" data-z="out" aria-label="Verkleinern" title="Verkleinern">−</button>
      </div>
      <div class="maplibregl-ctrl maplibregl-ctrl-group proj-ctl" role="group" aria-label="Ansicht">
        ${(['2d', '3d'] as const)
          .map((v) => `<button type="button" data-view="${v}" class="${view === v ? 'on' : ''}" aria-pressed="${view === v}" title="${v === '3d' ? '3D-Globus' : '2D-Karte'}">${v.toUpperCase()}</button>`)
          .join('')}
        <button type="button" data-view="solar" title="Ins Sonnensystem" aria-label="Ins Sonnensystem"><svg viewBox="0 0 24 24" class="ctl-ic"><circle cx="12" cy="12" r="4.5"/><ellipse cx="12" cy="12" rx="10" ry="3.6" transform="rotate(-20 12 12)"/></svg></button>
      </div>`;
  }
  ctrlsEl.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const z = t.closest<HTMLElement>('[data-z]')?.dataset.z;
    if (z) {
      const f = z === 'in' ? 1.6 : 1 / 1.6;
      if (view === '2d') zoomAt(W / 2, H / 2, f);
      else deps.three.zoomBy(f);
      return;
    }
    const v = t.closest<HTMLElement>('[data-view]')?.dataset.view;
    if (!v) return;
    if (v === 'solar') return deps.solar(bodyId);
    if (v === view) return;
    if (v === '2d') {
      const c = deps.three.center() ?? { lat: cLat, lon: cLon };
      deps.go(bodyId, '2d', c.lat, c.lon);
    } else deps.go(bodyId, '3d', cLat, cLon);
  });

  const BASE_Z = (l: TileLayer) => l.url(2, 1, 4);
  function renderBase(open = false) {
    const cfg = PLANET_MAPS[bodyId];
    const opts = [{ id: 'auto', label: 'Automatisch', img: BASE_Z(cfg.detail3d(0)) }, ...cfg.layers.map((l) => ({ id: l.id, label: l.label, img: BASE_Z(l) }))];
    const cur = opts.find((o) => o.id === layerId) ?? opts[0];
    baseSwitch.innerHTML = `
      <button type="button" class="base-current" aria-expanded="${open}" title="Kartentyp wählen">
        <span class="thumb"><img alt="" src="${cur.img}"/></span>
        <span class="base-current-label"><svg viewBox="0 0 24 24"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/></svg>Karte</span>
      </button>
      <div class="base-pop" ${open ? '' : 'hidden'}>
        <div class="base-options">
          ${opts.map((o) => `<button type="button" class="base-opt ${o.id === cur.id ? 'on' : ''}" data-base="${o.id}" aria-pressed="${o.id === cur.id}"><span class="thumb"><img alt="" loading="lazy" src="${o.img}"/></span><span>${escapeHtml(o.label)}</span></button>`).join('')}
        </div>
        <p class="small muted" style="margin:8px 4px 0">${escapeHtml([...new Set(cfg.layers.map((l) => l.credit))].join(' · '))}</p>
      </div>`;
    const pop = baseSwitch.querySelector<HTMLElement>('.base-pop')!;
    const btn = baseSwitch.querySelector<HTMLButtonElement>('.base-current')!;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      pop.hidden = !pop.hidden;
      btn.setAttribute('aria-expanded', String(!pop.hidden));
    });
    baseSwitch.querySelectorAll<HTMLButtonElement>('[data-base]').forEach((b) =>
      b.addEventListener('click', () => {
        layerId = b.dataset.base!;
        deps.three.setLayer(layerId);
        clampView();
        invalidate();
        renderBase(false);
      }),
    );
  }
  document.addEventListener('click', (e) => {
    const pop = baseSwitch.querySelector<HTMLElement>('.base-pop');
    if (pop && !pop.hidden && !baseSwitch.contains(e.target as Node)) renderBase(false);
  });

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
        <h3>${escapeHtml(PLANET_MAPS[bodyId].name)}</h3>
        ${
          panelTab === 'layers'
            ? `<div class="tile-grid three">
                ${tile('sites', show.sites, '#ffffff', 'Landestellen')}
                ${mars ? tile('tracks', show.tracks, 'linear-gradient(135deg,#ffb347,#5ad1ff)', 'Rover-Spuren') : ''}
                ${mars ? tile('heli', show.heli, '#ff5ad1', 'Ingenuity') : ''}
                ${tile('labels', show.labels, '#8899bb', 'Namen')}
              </div>`
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
        deps.three.setOverlays({ sites: show.sites, tracks: show.tracks || show.heli, labels: show.labels });
        invalidate();
        renderPanel();
      }),
    );
    panel.querySelectorAll<HTMLButtonElement>('[data-place]').forEach((b) => b.addEventListener('click', () => goTo(b.dataset.place!)));
  }

  /** Jump to a place / rover (2D: pan there, 3D: the renderer flies there). */
  function goTo(id: string) {
    const t = getMarsTracks();
    const known: Record<string, [number, number, number]> = { olympus: [18.65, -133.8, 5.5], valles: [-13.9, -59.2, 5] };
    let lat: number | null = null;
    let lon = 0;
    let zoom = 10;
    let focus: string | undefined;
    let site: string | undefined;
    if (known[id]) [lat, lon, zoom] = known[id];
    else if (id === 'm20' || id === 'msl') {
      const p = roverAt(t?.[id], Date.now()) ?? (id === 'm20' ? [77.45, 18.44] : [137.44, -4.59]);
      [lon, lat] = p;
      zoom = 11;
      focus = TRACKS.find((x) => x.id === id)!.craft;
    } else {
      const s = MARS_SITES.find((x) => x.id === id);
      if (s) {
        lat = s.lat;
        lon = s.lon;
        site = s.id;
      }
    }
    if (lat == null) return;
    if (view === '3d') return deps.go(bodyId, '3d', lat, lon, { focus, site });
    flyTo(lat, lon, zoom);
    const m = markers.find((x) => (focus && x.craft === focus) || (site && x.siteId === site));
    if (m) select(m);
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

  function setupBody() {
    const cfg = PLANET_MAPS[bodyId];
    layerId = 'auto';
    placesEl.innerHTML = places().map((p) => `<option value="${escapeHtml(p.name)}"></option>`).join('');
    void cfg;
    renderPanel();
    renderBase();
  }

  // ----- lifecycle ---------------------------------------------------------
  return {
    el,
    activate(o) {
      const sameBody = active && bodyId === o.body;
      bodyId = PLANET_MAPS[o.body]?.layers.length ? o.body : 'mars';
      view = o.view;
      if (!sameBody) setupBody();
      el.classList.toggle('is-3d', view === '3d');
      statusEl.hidden = view !== '2d';
      renderCtrls();
      deps.three.setLayer(layerId);
      deps.three.setOverlays({ sites: show.sites, tracks: show.tracks || show.heli, labels: show.labels });
      const first = !active;
      active = true;
      el.hidden = false;
      resize();
      if (view === '2d' && (first || o.lat != null)) {
        cLat = o.lat ?? 0;
        cLon = o.lon ?? 0;
        ppd = Math.min(ppdMax(), Math.max(ppdMin(), 1.4222 * 2 ** (o.zoom ?? 6)));
        clampView();
      }
      rebuildMarkers();
      void loadMarsTracks().then(() => {
        rebuildMarkers();
        invalidate();
      });
      if (view === '2d' && (o.focus || o.site)) {
        const m = markers.find((x) => (o.focus && x.craft === o.focus) || (o.site && x.siteId === o.site));
        if (m) select(m);
      }
      invalidate();
      cancelAnimationFrame(raf);
      if (view === '2d') raf = requestAnimationFrame(frame);
    },
    deactivate() {
      active = false;
      el.hidden = true;
      cancelAnimationFrame(raf);
    },
  };
}
