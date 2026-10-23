import { rawFetch } from './capture';
import type { TileGroup, TileRec } from './tiles';

// Mockup: all tiles a map source has loaded, drawn as a pannable / zoomable world map with a grid and a z/x/y id per tile.

const TS = 256;
const MAX_ZOOM = 22;
const MAX_LOADING = 12;

export interface TileMapView {
  el: HTMLElement;
  /** new tiles arrived */
  refresh(): void;
  destroy(): void;
}

const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
};

const icon = (k: keyof typeof ICONS) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[k]}</svg>`;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const idOf = (t: TileRec) => `${t.z}/${t.x}/${t.y}`;

export function createTileMap(group: TileGroup): TileMapView {
  const el = document.createElement('div');
  el.className = 'rdi-tm';
  el.innerHTML = `
    <canvas></canvas>
    <div class="rdi-tm-stat"></div>
    <div class="rdi-tm-bar" role="group" aria-label="Kartensteuerung">
      <button type="button" data-a="grid" class="on" aria-pressed="true">Gitter</button>
      <button type="button" data-a="in" aria-label="Hineinzoomen">${icon('plus')}</button>
      <button type="button" data-a="out" aria-label="Herauszoomen">${icon('minus')}</button>
      <button type="button" data-a="fit" aria-label="Alle Kacheln zeigen" title="Alle Kacheln zeigen">${icon('fit')}</button>
    </div>
    <div class="rdi-tm-info" hidden></div>`;
  const canvas = el.querySelector('canvas')!;
  const ctx = canvas.getContext('2d')!;
  const stat = el.querySelector<HTMLElement>('.rdi-tm-stat')!;
  const info = el.querySelector<HTMLElement>('.rdi-tm-info')!;

  let W = 0;
  let H = 0;
  let dpr = 1;
  let cx = 0.5;
  let cy = 0.5;
  let zoom = 0;
  let grid = true;
  let hover: TileRec | null = null;
  let selected: TileRec | null = null;
  let sorted: TileRec[] = [];
  let raf = 0;
  let fitted = false;
  let loadedInfo = '';

  // ----- images (raster tiles are loaded as plain <img>, which needs no CORS) -----
  const imgs = new Map<string, HTMLImageElement | 'err'>();
  const queue: string[] = [];
  let loading = 0;
  const pump = () => {
    while (loading < MAX_LOADING && queue.length) {
      const url = queue.shift()!;
      const im = new Image();
      loading++;
      const done = (ok: boolean) => {
        loading--;
        imgs.set(url, ok ? im : 'err');
        schedule();
        pump();
      };
      im.onload = () => done(true);
      im.onerror = () => done(false);
      im.src = url;
    }
  };
  const want = (url: string) => {
    if (imgs.has(url) || queue.includes(url)) return;
    queue.push(url);
    pump();
  };

  // ----- geometry -----
  const scale = () => TS * 2 ** zoom;
  const rectOf = (t: TileRec) => {
    const n = 2 ** t.z;
    const s = scale();
    return { x: (t.x / n - cx) * s + W / 2, y: (t.y / n - cy) * s + H / 2, size: s / n };
  };

  function fit() {
    if (!sorted.length || !W) {
      cx = cy = 0.5;
      zoom = Math.log2(Math.min(W, H) / TS) || 0;
      return;
    }
    let x0 = 1, y0 = 1, x1 = 0, y1 = 0;
    for (const t of sorted) {
      const n = 2 ** t.z;
      x0 = Math.min(x0, t.x / n);
      y0 = Math.min(y0, t.y / n);
      x1 = Math.max(x1, (t.x + 1) / n);
      y1 = Math.max(y1, (t.y + 1) / n);
    }
    cx = (x0 + x1) / 2;
    cy = (y0 + y1) / 2;
    zoom = Math.max(-1, Math.min(14, Math.log2(Math.min((W - 40) / (TS * (x1 - x0)), (H - 40) / (TS * (y1 - y0))))));
  }

  const zoomAt = (px: number, py: number, dz: number) => {
    const s0 = scale();
    const ux = (px - W / 2) / s0 + cx;
    const uy = (py - H / 2) / s0 + cy;
    zoom = Math.max(-2, Math.min(MAX_ZOOM, zoom + dz));
    const s1 = scale();
    cx = ux - (px - W / 2) / s1;
    cy = uy - (py - H / 2) / s1;
    schedule();
  };

  function pick(px: number, py: number): TileRec | null {
    for (let i = sorted.length - 1; i >= 0; i--) {
      const r = rectOf(sorted[i]);
      if (px >= r.x && px < r.x + r.size && py >= r.y && py < r.y + r.size) return sorted[i];
    }
    return null;
  }

  // ----- drawing -----
  function draw() {
    raf = 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#151517';
    ctx.fillRect(0, 0, W, H);

    // the world square (everything outside has no tiles)
    const s = scale();
    ctx.strokeStyle = 'rgba(255,255,255,.12)';
    ctx.setLineDash([4, 4]);
    ctx.strokeRect((0 - cx) * s + W / 2, (0 - cy) * s + H / 2, s, s);
    ctx.setLineDash([]);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 10px ui-monospace, Menlo, monospace';
    ctx.lineJoin = 'round';

    for (const t of sorted) {
      const r = rectOf(t);
      if (r.size < 1.5 || r.x > W || r.y > H || r.x + r.size < 0 || r.y + r.size < 0) continue;
      let drawn = false;
      if (group.kind === 'raster' || group.kind === 'dem') {
        const im = imgs.get(t.url);
        if (im && im !== 'err') {
          ctx.drawImage(im, r.x, r.y, r.size, r.size);
          drawn = true;
        } else if (!im && r.size >= 6) want(t.url);
      }
      if (!drawn) {
        ctx.fillStyle = `hsl(${group.kind === 'vector' ? 215 : 30} 8% ${15 + (t.z % 4) * 3}%)`;
        ctx.fillRect(r.x, r.y, r.size, r.size);
      }
      if (grid && r.size >= 5) {
        ctx.strokeStyle = 'rgba(0,0,0,.55)';
        ctx.lineWidth = 3;
        ctx.strokeRect(r.x, r.y, r.size, r.size);
        ctx.strokeStyle = 'rgba(255,255,255,.7)';
        ctx.lineWidth = 1;
        ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.size - 1, r.size - 1);
      }
      if (grid && r.size >= 40) {
        const label = idOf(t);
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,.8)';
        ctx.strokeText(label, r.x + r.size / 2, r.y + r.size / 2);
        ctx.fillStyle = '#fff';
        ctx.fillText(label, r.x + r.size / 2, r.y + r.size / 2);
      }
    }

    for (const t of [hover, selected]) {
      if (!t) continue;
      const r = rectOf(t);
      ctx.fillStyle = t === selected ? 'rgba(255,255,255,.18)' : 'rgba(255,255,255,.1)';
      ctx.fillRect(r.x, r.y, r.size, r.size);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = t === selected ? 3 : 2;
      ctx.strokeRect(r.x, r.y, r.size, r.size);
    }

    const zs = sorted.map((t) => t.z);
    stat.textContent = sorted.length ? `${sorted.length} Kacheln · Stufen ${Math.min(...zs)}–${Math.max(...zs)} · Zoom ${zoom.toFixed(1)}` : 'Noch keine Kacheln geladen';
  }
  const schedule = () => {
    if (!raf) raf = requestAnimationFrame(draw);
  };

  // ----- info card -----
  function renderInfo() {
    const t = selected ?? hover;
    info.hidden = !t;
    if (!t) return;
    const web = /^https?:/.test(t.url);
    const im = imgs.get(t.url);
    info.innerHTML = `
      <div class="rdi-tm-id">${idOf(t)}</div>
      <div class="rdi-tm-sub">${group.kind === 'vector' ? 'Vektorkachel (PBF)' : group.kind === 'custom' ? 'Lokal berechnetes Raster' : group.kind === 'dem' ? 'Höhenkachel' : 'Rasterkachel'}${im && im !== 'err' ? ` · ${im.naturalWidth}×${im.naturalHeight} px` : ''}${im === 'err' ? ' · nicht ladbar' : ''}</div>
      <div class="rdi-tm-url" title="${esc(t.url)}">${esc(t.url)}</div>
      ${selected && web ? `<div class="rdi-tm-act"><a href="${esc(t.url)}" target="_blank" rel="noopener">Öffnen</a><button type="button" data-a="copy">URL kopieren</button>${group.kind === 'vector' ? '<button type="button" data-a="decode">Inhalt lesen</button>' : ''}</div>` : ''}
      ${selected && loadedInfo ? `<div class="rdi-tm-layers">${loadedInfo}</div>` : ''}
      ${!selected ? '<div class="rdi-tm-sub">Klicken zum Auswählen</div>' : ''}`;
  }

  async function decode(t: TileRec) {
    loadedInfo = 'Wird gelesen …';
    renderInfo();
    try {
      const [{ VectorTile }, { PbfReader }] = await Promise.all([import('@mapbox/vector-tile'), import('pbf')]);
      const buf = await (await rawFetch(t.url)).arrayBuffer();
      const tile = new VectorTile(new PbfReader(buf));
      loadedInfo = `<b>${(buf.byteLength / 1024).toFixed(1)} kB</b><ul>${Object.entries(tile.layers)
        .map(([name, l]) => `<li><span>${esc(name)}</span><b>${l.length}</b></li>`)
        .join('')}</ul>`;
    } catch (e) {
      loadedInfo = `Konnte nicht gelesen werden: ${esc(e instanceof Error ? e.message : String(e))}`;
    }
    if (selected === t) renderInfo();
  }

  // ----- events -----
  let drag: { x: number; y: number; moved: boolean } | null = null;
  const local = (e: PointerEvent | WheelEvent | MouseEvent) => {
    const b = canvas.getBoundingClientRect();
    return { x: e.clientX - b.left, y: e.clientY - b.top };
  };
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    drag = { x: e.clientX, y: e.clientY, moved: false };
  });
  canvas.addEventListener('pointermove', (e) => {
    if (drag) {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      if (drag.moved) {
        cx -= dx / scale();
        cy -= dy / scale();
        drag.x = e.clientX;
        drag.y = e.clientY;
        schedule();
      }
      return;
    }
    const p = local(e);
    const t = pick(p.x, p.y);
    if (t !== hover) {
      hover = t;
      renderInfo();
      schedule();
    }
  });
  canvas.addEventListener('pointerup', (e) => {
    const moved = drag?.moved;
    drag = null;
    if (moved) return;
    const p = local(e);
    const t = pick(p.x, p.y);
    selected = t && t === selected ? null : t;
    loadedInfo = '';
    renderInfo();
    schedule();
  });
  canvas.addEventListener('pointerleave', () => {
    if (!drag && hover) {
      hover = null;
      renderInfo();
      schedule();
    }
  });
  canvas.addEventListener('dblclick', (e) => {
    const p = local(e);
    zoomAt(p.x, p.y, 1);
  });
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const p = local(e);
      zoomAt(p.x, p.y, -e.deltaY * (e.deltaMode ? 0.05 : 0.0025));
    },
    { passive: false },
  );
  el.querySelector('.rdi-tm-bar')!.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-a]');
    if (!b) return;
    if (b.dataset.a === 'grid') {
      grid = !grid;
      b.classList.toggle('on', grid);
      b.setAttribute('aria-pressed', String(grid));
    } else if (b.dataset.a === 'in') zoomAt(W / 2, H / 2, 1);
    else if (b.dataset.a === 'out') zoomAt(W / 2, H / 2, -1);
    else fit();
    schedule();
  });
  info.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-a]');
    if (!b || !selected) return;
    if (b.dataset.a === 'copy') void navigator.clipboard?.writeText(selected.url);
    else if (b.dataset.a === 'decode') void decode(selected);
  });

  const ro = new ResizeObserver(() => {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    dpr = window.devicePixelRatio || 1;
    W = r.width;
    H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    if (!fitted && sorted.length) {
      fit();
      fitted = true;
    }
    schedule();
  });
  ro.observe(el);

  function refresh() {
    sorted = [...group.tiles.values()].sort((a, b) => a.z - b.z);
    if (!fitted && W && sorted.length) {
      fit();
      fitted = true;
    }
    schedule();
  }
  refresh();

  return {
    el,
    refresh,
    destroy() {
      ro.disconnect();
      cancelAnimationFrame(raf);
      queue.length = 0;
      imgs.clear();
    },
  };
}
