import { PLANET_MAPS, type TileLayer } from '../space/planets';
import { MARS_SITES, getMarsTracks, loadMarsTracks, roverAt, solAt, trackCount, trackKm, heliAt, type Track } from '../space/mars';
import { COUNTRY, flagDataUrl } from '../space/moon';
import { escapeHtml, fmt } from '../util';

// 2D map of a planet (equirectangular tile pyramids, see space/planets.ts) – the counterpart
// of the Earth map for the other bodies: zooming far into a planet in the space view opens
// it, "3D" returns to the globe. Overlays: landing sites, rover traverses, Ingenuity flights.

export interface PlanetMapView {
  el: HTMLElement;
  activate(o: { body: string; lat?: number; lon?: number; zoom?: number; focus?: string }): void;
  deactivate(): void;
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

export function createPlanetMapView(onOpenSpace: (body: string, lat: number, lon: number, focus?: string, site?: string) => void): PlanetMapView {
  const el = document.createElement('main');
  el.className = 'view space-view planet-view';
  el.hidden = true;
  el.innerHTML = `
    <canvas class="pm-canvas"></canvas>
    <aside class="panel pm-panel">
      <div class="panel-scroll">
        <h2 class="pm-title"></h2>
        <div class="pm-switch" role="group" aria-label="Darstellung">
          <button class="btn small on" data-v="2d">2D</button>
          <button class="btn small" data-v="3d">3D</button>
        </div>
        <h3 class="sp-sub">Karte</h3>
        <div class="pm-maps" role="radiogroup" aria-label="Karte"></div>
        <p class="small muted pm-credit"></p>
      </div>
    </aside>
    <div class="pm-layers" aria-label="Angezeigte Ebenen">
      <div class="pm-now" title="Aktuell dargestellte Karte"></div>
      <div class="pm-chips"></div>
      <select class="pm-jump" aria-label="Springen zu"></select>
    </div>
    <button class="btn icon-btn space-list-toggle pm-toggle" aria-label="Karte wählen" title="Karte wählen">
      <svg viewBox="0 0 24 24"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/></svg>
    </button>
    <section class="space-info pm-info" hidden></section>
    <div class="pm-status"><span class="pm-coord"></span><span class="pm-scale"><i></i><b></b></span></div>`;

  const canvas = el.querySelector<HTMLCanvasElement>('.pm-canvas')!;
  const ctx = canvas.getContext('2d')!;
  const panel = el.querySelector<HTMLElement>('.pm-panel')!;
  const titleEl = el.querySelector<HTMLElement>('.pm-title')!;
  const mapsEl = el.querySelector<HTMLElement>('.pm-maps')!;
  const nowEl = el.querySelector<HTMLElement>('.pm-now')!;
  const chipsEl = el.querySelector<HTMLElement>('.pm-chips')!;
  const jumpEl = el.querySelector<HTMLSelectElement>('.pm-jump')!;
  const creditEl = el.querySelector<HTMLElement>('.pm-credit')!;
  const info = el.querySelector<HTMLElement>('.pm-info')!;
  const coordEl = el.querySelector<HTMLElement>('.pm-coord')!;
  const scaleBar = el.querySelector<HTMLElement>('.pm-scale i')!;
  const scaleTxt = el.querySelector<HTMLElement>('.pm-scale b')!;
  if (window.innerWidth <= 720) panel.hidden = true;

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
  /** overlay visibility (each overlay is one chip in the layer indicator) */
  const show: Record<string, boolean> = { sites: true, m20: true, msl: true, heli: true };
  const roverKey = (craft?: string) => (craft === 'curiosity' ? 'msl' : 'm20');
  const markerShown = (m: Marker) => (m.kind === 'site' ? show.sites : m.kind === 'heli' ? show.heli : show[roverKey(m.craft)]);
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
    const lyr = layerFor(z);
    if (nowEl.dataset.id !== lyr.id) {
      nowEl.dataset.id = lyr.id;
      nowEl.textContent = lyr.label;
    }
    const span = 180 / 2 ** z;
    const lat0 = cLat + H / 2 / ppd;
    const lat1 = cLat - H / 2 / ppd;
    const rowA = Math.max(0, Math.floor((90 - lat0) / span));
    const rowB = Math.min(2 ** z - 1, Math.floor((90 - lat1) / span));
    const lon0 = cLon - W / 2 / ppd;
    const lon1 = cLon + W / 2 / ppd;
    const n = 2 * 2 ** z;
    const missing: { z: number; r: number; c: number; d: number }[] = [];
    ctx.fillStyle = '#05070d';
    ctx.fillRect(0, 0, W, H);
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
    for (const tr of TRACKS) {
      if (!show[tr.id]) continue;
      {
        const track: Track = t[tr.id];
        strokeTrack(track.ll, trackCount(track, now), 'rgba(0,0,0,0.55)', 4.5);
        strokeTrack(track.ll, trackCount(track, now), tr.color, 2.5);
      }
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
      if (!markerShown(m)) continue;
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
      const h = `#/planet?body=${bodyId}&lat=${cLat.toFixed(3)}&lon=${cLon.toFixed(3)}&zoom=${Math.log2(ppd / 1.4222).toFixed(2)}`;
      if (location.hash !== h) history.replaceState(null, '', h);
    }, 300);
  }

  function pick(x: number, y: number) {
    let best: Marker | null = null;
    let bd = 16;
    for (const m of markers) {
      if (!markerShown(m)) continue;
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
    info.querySelector('[data-a=3d]')!.addEventListener('click', () => onOpenSpace(bodyId, m.lat, m.lon, m.craft, m.siteId));
  }

  function flyTo(lat: number, lon: number, z = 9) {
    cLat = lat;
    cLon = lon;
    ppd = Math.min(ppdMax(), Math.max(ppdMin(), 1.4222 * 2 ** z));
    clampView();
    invalidate();
    persist();
  }

  // ----- panel -------------------------------------------------------------
  el.querySelector('.pm-switch')!.addEventListener('click', (e) => {
    const v = (e.target as HTMLElement).closest<HTMLElement>('[data-v]')?.dataset.v;
    if (v === '3d') onOpenSpace(bodyId, cLat, cLon);
  });
  el.querySelector('.pm-toggle')!.addEventListener('click', () => (panel.hidden = !panel.hidden));
  function setLayer(id: string) {
    const cfg = PLANET_MAPS[bodyId];
    const l = id === 'auto' ? cfg.detail3d(99) : cfg.layers.find((x) => x.id === id);
    if (!l) return;
    layerId = id;
    mapsEl.querySelectorAll<HTMLElement>('.pm-map').forEach((b) => b.classList.toggle('on', b.dataset.id === id));
    creditEl.textContent = `Karte: ${id === 'auto' ? [cfg.detail3d(0), cfg.detail3d(99)].map((x) => x.credit).filter((v, i, a) => a.indexOf(v) === i).join(' · ') : l.credit}`;
    nowEl.dataset.id = '';
    clampView();
    invalidate();
  }
  mapsEl.addEventListener('click', (e) => {
    const id = (e.target as HTMLElement).closest<HTMLElement>('.pm-map')?.dataset.id;
    if (id) setLayer(id);
  });

  /** overlay chips: colour swatch + name, filled = shown */
  function renderChips() {
    const mars = bodyId === 'mars';
    const items: { key: string; label: string; color: string; shape: 'dot' | 'line'; n?: number }[] = [];
    if (mars) {
      items.push({ key: 'sites', label: 'Landestellen', color: '#ffffff', shape: 'dot', n: MARS_SITES.filter((x) => !x.hideFlag).length });
      for (const t of TRACKS) items.push({ key: t.id, label: t.name, color: t.color, shape: 'line' });
      items.push({ key: 'heli', label: 'Ingenuity-Flüge', color: '#ff5ad1', shape: 'line' });
    }
    chipsEl.innerHTML = items
      .map(
        (i) =>
          `<button class="pm-chip ${show[i.key] ? 'on' : ''}" data-l="${i.key}" aria-pressed="${show[i.key]}" title="${show[i.key] ? 'Ausblenden' : 'Einblenden'}"><i class="sw ${i.shape}" style="--c:${i.color}"></i>${escapeHtml(i.label)}${i.n != null ? `<b>${i.n}</b>` : ''}</button>`,
      )
      .join('');
    chipsEl.hidden = !items.length;
  }
  chipsEl.addEventListener('click', (e) => {
    const k = (e.target as HTMLElement).closest<HTMLElement>('.pm-chip')?.dataset.l;
    if (!k) return;
    show[k] = !show[k];
    renderChips();
    invalidate();
  });

  function setupBody() {
    const cfg = PLANET_MAPS[bodyId];
    titleEl.textContent = cfg.name;
    const maps = [{ id: 'auto', label: 'Automatisch', sub: 'Farbe, beim Hineinzoomen bis ≈ 5 m' }, ...cfg.layers.map((l) => ({ id: l.id, label: l.label, sub: '' }))];
    mapsEl.innerHTML = maps
      .map((m) => `<button class="pm-map" role="radio" data-id="${m.id}"><span>${escapeHtml(m.label)}</span>${m.sub ? `<small>${escapeHtml(m.sub)}</small>` : ''}</button>`)
      .join('');
    setLayer('auto');
    renderChips();
    const mars = bodyId === 'mars';
    jumpEl.hidden = !mars;
    jumpEl.innerHTML = mars
      ? `<option value="">Springen zu …</option>
         <optgroup label="Rover">${TRACKS.map((t) => `<option value="go:${t.id}">${t.name}</option>`).join('')}</optgroup>
         <optgroup label="Landestellen">${MARS_SITES.filter((s) => !s.hideFlag)
           .map((s) => `<option value="site:${s.id}">${escapeHtml(s.name)}</option>`)
           .join('')}</optgroup>
         <optgroup label="Landschaften"><option value="go:olympus">Olympus Mons</option><option value="go:valles">Valles Marineris</option></optgroup>`
      : '';
  }
  jumpEl.addEventListener('change', () => {
    const v = jumpEl.value;
    jumpEl.value = '';
    if (!v) return;
    const [kind, id] = v.split(':');
    const t = getMarsTracks();
    if (kind === 'go' && id === 'olympus') return flyTo(18.65, -133.8, 5.5);
    if (kind === 'go' && id === 'valles') return flyTo(-13.9, -59.2, 5);
    if (kind === 'go' && (id === 'm20' || id === 'msl')) {
      const p = roverAt(t?.[id], Date.now());
      const tr = TRACKS.find((x) => x.id === id)!;
      if (p) flyTo(p[1], p[0], 11);
      else flyTo(id === 'm20' ? 18.44 : -4.59, id === 'm20' ? 77.45 : 137.44, 10);
      show[id] = true;
      renderChips();
      const m = markers.find((x) => x.craft === tr.craft);
      if (m) select(m);
      return;
    }
    const s = MARS_SITES.find((x) => x.id === id);
    if (s) {
      flyTo(s.lat, s.lon, 10);
      show.sites = true;
      renderChips();
      const m = markers.find((x) => x.siteId === s.id);
      if (m) select(m);
    }
  });

  // ----- lifecycle ---------------------------------------------------------
  return {
    el,
    activate(o) {
      bodyId = PLANET_MAPS[o.body]?.layers.length ? o.body : 'mars';
      setupBody();
      const first = !active;
      active = true;
      el.hidden = false;
      resize();
      if (first || o.lat != null) {
        const z = o.zoom ?? 8.5;
        cLat = o.lat ?? 0;
        cLon = o.lon ?? 0;
        ppd = Math.min(ppdMax(), Math.max(ppdMin(), 1.4222 * 2 ** z));
        clampView();
      }
      rebuildMarkers();
      void loadMarsTracks().then(() => {
        rebuildMarkers();
        invalidate();
      });
      if (o.focus) {
        const m = markers.find((x) => x.craft === o.focus);
        if (m) select(m);
      }
      invalidate();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    },
    deactivate() {
      active = false;
      el.hidden = true;
      cancelAnimationFrame(raf);
    },
  };
}
