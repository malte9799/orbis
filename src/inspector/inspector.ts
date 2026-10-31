import { toast } from '../util';
import { clearCaptures, currentRoute, getCaptures, onCaptures, rawFetch, type Capture } from './capture';
import { isGlyphUrl } from './glyphs';
import { createGlbView, type GlbView } from './glb';
import { clearTiles, getTileGroups, tileUrls, type TileGroup } from './tiles';
import { createTileMap, type TileMapView } from './tilemap';
import { providerOf } from './sources';

// Mockup of the "Datenquellen · Rohdaten" view:
//   top left     the whole page, scaled down to a quarter of the screen
//   top right    every data source the page used
//   bottom half  the raw response of the selected source (JSON tree / text / image)

const ROUTE_LABEL: Record<string, string> = { forecast: 'Vorhersage', globe: 'Karte', space: 'Weltall', stars: 'Sterne', games: 'Spiele' };
const KIND_LABEL: Record<Capture['kind'], string> = { json: 'JSON', xml: 'XML', text: 'TXT', image: 'IMG', model: '3D', binary: 'BIN' };
const TILE_LABEL: Record<TileGroup['kind'], string> = { raster: 'Rasterkacheln', dem: 'Höhenkacheln', vector: 'Vektorkacheln', custom: 'lokales Raster' };
const PAGE = 100;
const MAX_TEXT = 300_000;
const parsed = new WeakMap<Capture, unknown>();

// size of the three tiles, kept for the session (and in this browser)
const LAYOUT_KEY = 'orbis.rdi.layout';
const layout = (() => {
  try {
    const v = JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? '{}') as { fx?: number; fy?: number };
    return { fx: Number.isFinite(v.fx) ? v.fx! : 0.5, fy: Number.isFinite(v.fy) ? v.fy! : 0.5 };
  } catch {
    return { fx: 0.5, fy: 0.5 };
  }
})();
function saveLayout() {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  } catch {
    /* storage unavailable */
  }
}

/** The quarter-screen layout needs room: on phones the inspector does not exist. */
const phone = window.matchMedia('(max-width: 700px)');

let overlay: HTMLElement | null = null;
let stop: (() => void) | null = null;

const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 7 3 12l5 5M16 7l5 5-5 5M14 4l-4 16"/></svg>';
const CHEVRON = '<svg viewBox="0 0 24 24" aria-hidden="true" class="rdi-chev"><path d="M9 6l6 6-6 6"/></svg>';
const LABEL = 'Datenquellen · Rohdaten';

export type RawDataVariant =
  /** fixed round icon at the bottom right, label slides out on hover */
  | 'fab'
  /** plain icon button; the host styles it through `cls` (e.g. the HUD's own button class) */
  | 'button'
  /** full-width menu row for panels and dialogs */
  | 'row';

/** Adds the entry point for the raw-data view. Phones never see it. */
export function mountRawDataLink(parent: HTMLElement, variant: RawDataVariant = 'fab', o: { cls?: string; beforeOpen?: () => void } = {}) {
  const b = document.createElement('button');
  b.type = 'button';
  b.setAttribute('aria-label', LABEL);
  b.addEventListener('click', () => {
    o.beforeOpen?.();
    open();
  });
  if (variant === 'fab') {
    b.className = 'rdi-link';
    b.innerHTML = `${ICON}<span class="rdi-link-text">${LABEL}</span>`;
    const row = document.createElement('div');
    row.className = 'rdi-link-row rdi-mount';
    row.append(b);
    parent.append(row);
    return;
  }
  b.classList.add('rdi-mount');
  if (variant === 'row') {
    b.className += ' rdi-row';
    b.innerHTML = `${ICON}<span>${LABEL}</span>${CHEVRON}`;
  } else {
    if (o.cls) b.className += ` ${o.cls}`;
    b.title = LABEL;
    b.classList.add('rdi-icon');
    b.innerHTML = ICON;
  }
  parent.append(b);
}

export const openRawData = () => open();

function open() {
  if (overlay || phone.matches) return;
  const shell = document.getElementById('shell')!;
  const scrollY = window.scrollY;
  // the preview is live: navigating inside it changes what "this page" means
  let route = currentRoute();
  let scope: 'page' | 'all' = 'page';
  let selected: string | null = null;
  let capIdx = 0;
  let glyphToken = 0;
  let rawSig = '';
  let rawMode: 'tree' | 'raw' = 'tree';
  let side: 'sent' | 'recv' = 'recv';

  overlay = document.createElement('div');
  overlay.className = 'rdi';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Datenquellen und Rohdaten');
  overlay.innerHTML = `
    <section class="rdi-list">
      <header>
        <h2>Datenquellen <small class="muted" data-r="count"></small></h2>
        <div class="rdi-seg" role="group" aria-label="Umfang">
          <button type="button" data-scope="page" class="on">Diese Seite</button>
          <button type="button" data-scope="all">Alle</button>
        </div>
        <button type="button" class="rdi-btn rdi-clear" data-r="clear" title="Alle angezeigten Datenquellen entfernen">${TRASH_ICON}Leeren</button>
        <button type="button" class="rdi-x" data-r="close" aria-label="Schließen" title="Schließen (Esc)">
          <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
      </header>
      <div class="rdi-scroll" data-r="list"></div>
    </section>
    <section class="rdi-raw">
      <header data-r="rawhead"></header>
      <div class="rdi-statusbar" data-r="status" hidden></div>
      <div class="rdi-scroll rdi-rawbody" data-r="rawbody"></div>
    </section>
    <div class="rdi-gut rdi-gut-v" data-g="v" title="Ziehen zum Ändern der Breite · Doppelklick: Ausgangsgröße"></div>
    <div class="rdi-gut rdi-gut-h" data-g="h" title="Ziehen zum Ändern der Höhe · Doppelklick: Ausgangsgröße"></div>
    <div class="rdi-gut rdi-gut-x" data-g="x" title="Ziehen: Breite und Höhe · Doppelklick: Ausgangsgröße"></div>`;
  const $ = <T extends HTMLElement>(r: string) => overlay!.querySelector<T>(`[data-r=${r}]`)!;
  const listEl = $('list');
  const rawHead = $('rawhead');
  const rawBody = $('rawbody');
  const statusEl = $('status');

  // The page keeps its full size and is scaled into its tile. Tiles: preview (top left), list (top right), raw data (bottom);
  // the gaps between them are drag handles. fx / fy = share of the free width / height that the top-left tile takes.
  const GAP = 12;
  const clampF = (f: number) => Math.min(0.85, Math.max(0.15, f));
  const fit = () => {
    const cw = layout.fx * (innerWidth - 3 * GAP);
    const ch = layout.fy * (innerHeight - 3 * GAP);
    overlay!.style.setProperty('--rdi-cw', `${cw}px`);
    overlay!.style.setProperty('--rdi-ch', `${ch}px`);
    overlay!.querySelectorAll('[data-g]').forEach((g) => {
      const axis = (g as HTMLElement).dataset.g!;
      g.classList.toggle('snapped', (axis !== 'h' ? layout.fx === 0.5 : true) && (axis !== 'v' ? layout.fy === 0.5 : true));
    });
    shell.style.setProperty('--rdi-sx', String(cw / innerWidth));
    shell.style.setProperty('--rdi-sy', String(ch / innerHeight));
  };
  const SNAP = 14; // px: within this distance of the original split the handle snaps back to it
  overlay.querySelectorAll<HTMLElement>('[data-g]').forEach((g) => {
    const axis = g.dataset.g!;
    g.addEventListener('dblclick', () => {
      if (axis !== 'h') layout.fx = 0.5;
      if (axis !== 'v') layout.fy = 0.5;
      saveLayout();
      fit();
    });
    g.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      g.setPointerCapture(e.pointerId);
      document.body.classList.add('rdi-dragging');
      document.body.dataset.rdiCursor = axis === 'v' ? 'col' : axis === 'h' ? 'row' : 'move';
      const x0 = e.clientX;
      const y0 = e.clientY;
      const fx0 = layout.fx;
      const fy0 = layout.fy;
      const freeW = innerWidth - 3 * GAP;
      const freeH = innerHeight - 3 * GAP;
      const move = (m: PointerEvent) => {
        if (axis !== 'h') {
          let f = clampF(fx0 + (m.clientX - x0) / freeW);
          if (Math.abs(f - 0.5) * freeW < SNAP) f = 0.5;
          layout.fx = f;
        }
        if (axis !== 'v') {
          let f = clampF(fy0 + (m.clientY - y0) / freeH);
          if (Math.abs(f - 0.5) * freeH < SNAP) f = 0.5;
          layout.fy = f;
        }
        fit();
      };
      const up = () => {
        g.removeEventListener('pointermove', move);
        g.removeEventListener('pointerup', up);
        g.removeEventListener('pointercancel', up);
        document.body.classList.remove('rdi-dragging');
        delete document.body.dataset.rdiCursor;
        saveLayout();
      };
      g.addEventListener('pointermove', move);
      g.addEventListener('pointerup', up);
      g.addEventListener('pointercancel', up);
    });
  });
  fit();
  window.addEventListener('resize', fit);

  document.body.classList.add('rdi-open');
  shell.scrollTop = scrollY;
  document.body.append(overlay);

  // ----- entries: one per tile source / per endpoint, grouped by provider -----
  interface Entry {
    id: string;
    provider: string;
    kind: 'tiles' | 'font' | Capture['kind'];
    label: string;
    meta: string;
    bad: boolean;
    /** at least one request went through the data proxy */
    proxied: boolean;
    caps: Capture[];
    /** shown count: unique files in a gallery, requests otherwise */
    count: number;
    tiles?: TileGroup;
  }

  function entries(): Entry[] {
    const out = new Map<string, Entry>();
    for (const c of getCaptures()) {
      if ((scope === 'page' && c.route !== route) || tileUrls.has(c.url)) continue;
      // images the page loads itself (textures, icons) are grouped per folder
      const key = c.imgUrl ? `g:${c.host}${new URL(c.url).pathname.replace(/[^/]*$/, '')}` : `f:${c.method} ${endpointPath(c)}`;
      let e = out.get(key);
      if (!e) out.set(key, (e = { id: key, provider: providerOf(c.host), kind: c.kind, label: '', meta: '', bad: false, proxied: false, caps: [], count: 0 }));
      e.caps.push(c);
    }
    for (const e of out.values()) {
      const last = e.caps[e.caps.length - 1];
      const u = new URL(apiUrl(last));
      e.proxied = e.caps.some((c) => c.target);
      e.kind = isGlyphUrl(last.url) ? 'font' : last.kind;
      const gallery = e.caps.length > 1 && e.caps.every((c) => c.imgUrl);
      e.count = gallery ? new Set(e.caps.map((c) => c.url)).size : e.caps.length;
      e.label = gallery ? u.pathname.replace(/[^/]*$/, '') : e.caps.length > 1 ? endpointPath(last).replace(/^[^/]*/, '') : u.pathname + u.search;
      e.bad = !!last.error || !last.ok;
      if (gallery) {
        const total = e.caps.reduce((n, c) => n + (c.size ?? 0), 0);
        e.meta = `${e.count} Bilder${total ? ` · ${fmtSize(total)}` : ''}`;
      }
      else e.meta = `${last.error ? errorTitle(last) : last.status ? `${last.status}${last.statusText ? ` ${last.statusText}` : ''}` : '…'} · ${last.size == null && (last.skipped || last.kind === 'model') ? '–' : fmtSize(last.size)} · ${last.ms} ms${scope === 'all' ? ` · ${ROUTE_LABEL[last.route] ?? last.route}` : ''}`;
    }
    for (const g of getTileGroups()) {
      if (!g.tiles.size || (scope === 'page' && !g.routes.has(route))) continue;
      const zs = [...g.tiles.values()].map((t) => t.z);
      const label = TILE_LABEL[g.kind];
      out.set(`t:${g.key}`, {
        id: `t:${g.key}`,
        provider: g.host ? providerOf(g.host) : 'Orbis (lokal berechnet)',
        kind: 'tiles',
        label: `${g.sourceId} · ${label}`,
        meta: `${g.tiles.size} Kacheln · Stufe ${Math.min(...zs)}–${Math.max(...zs)}`,
        bad: false,
        proxied: false,
        caps: [],
        count: g.tiles.size,
        tiles: g,
      });
    }
    return [...out.values()];
  }

  // The list is updated in place: rows keep their DOM node (and their position) while requests keep arriving,
  // so a tap lands on the row it was aimed at even when a lot is loading.
  const seen = new Map<string, number>();
  const rowEls = new Map<string, HTMLElement>();
  const groupEls = new Map<string, { el: HTMLElement; title: HTMLElement; count: HTMLElement }>();
  const setText = (el: Element, v: string) => el.textContent !== v && (el.textContent = v);
  const place = (parent: HTMLElement, el: HTMLElement, i: number) => parent.children[i] !== el && parent.insertBefore(el, parent.children[i] ?? null);

  function renderList() {
    const items = entries();
    setText($('count'), `${items.length}`);
    $<HTMLButtonElement>('clear').disabled = !items.length;
    for (const e of items) if (!seen.has(e.id)) seen.set(e.id, seen.size);
    items.sort((a, b) => seen.get(a.id)! - seen.get(b.id)!);
    const groups = new Map<string, Entry[]>();
    for (const e of items) (groups.get(e.provider) ?? groups.set(e.provider, []).get(e.provider)!).push(e);

    listEl.querySelector('.rdi-empty')?.remove();
    if (!items.length) {
      rowEls.clear();
      groupEls.clear();
      listEl.innerHTML = `<p class="muted rdi-empty">Auf dieser Seite wurden noch keine Daten geladen.</p>`;
      return;
    }
    const liveRows = new Set<string>();
    let gi = 0;
    for (const [name, list] of groups) {
      let g = groupEls.get(name);
      if (!g) {
        const el = document.createElement('div');
        el.className = 'rdi-group';
        el.innerHTML = `<h3><span></span> <small></small></h3>`;
        g = { el, title: el.querySelector('h3 span')!, count: el.querySelector('h3 small')! };
        groupEls.set(name, g);
      }
      setText(g.title, name);
      setText(g.count, `${list.length}`);
      place(listEl, g.el, gi++);
      list.forEach((e, i) => {
        liveRows.add(e.id);
        let row = rowEls.get(e.id);
        if (!row) {
          row = document.createElement('div');
          row.className = 'rdi-item';
          row.innerHTML = `<button type="button" class="rdi-item-main">
              <span class="rdi-kind"></span>
              <span class="rdi-path"><span class="rdi-label"></span><i class="rdi-count" hidden></i></span>
              <span class="rdi-meta"><span class="rdi-badge rdi-badge-proxy" hidden title="Über den Daten-Proxy geladen">PROXY</span><span class="rdi-meta-text"></span></span>
            </button>
            <button type="button" class="rdi-ibtn rdi-copy" data-copy="url" aria-label="URL kopieren" title="URL kopieren">${COPY_ICON}</button>`;
          row.querySelector('.rdi-item-main')!.addEventListener('click', () => select(e.id));
          rowEls.set(e.id, row);
        }
        const main = row.firstElementChild as HTMLElement;
        const cap = e.caps[e.caps.length - 1];
        const url = e.tiles?.template ?? apiUrl(cap);
        row.classList.toggle('on', e.id === selected);
        row.dataset.url = url;
        main.setAttribute('aria-pressed', String(e.id === selected));
        const kind = main.querySelector('.rdi-kind')!;
        setText(kind, e.kind === 'tiles' ? 'MAP' : e.kind === 'font' ? 'FONT' : KIND_LABEL[e.kind]);
        kind.className = `rdi-kind k-${e.kind}`;
        const path = main.querySelector<HTMLElement>('.rdi-path')!;
        path.title = url;
        setText(main.querySelector('.rdi-label')!, e.label);
        const cnt = main.querySelector<HTMLElement>('.rdi-count')!;
        cnt.hidden = e.count < 2;
        setText(cnt, `×${e.count}`);
        main.querySelector<HTMLElement>('.rdi-badge-proxy')!.hidden = !e.proxied;
        const meta = main.querySelector('.rdi-meta')!;
        meta.classList.toggle('bad', e.bad);
        setText(main.querySelector('.rdi-meta-text')!, e.meta);
        place(g.el, row, i + 1);
      });
    }
    for (const [k, el] of rowEls) if (!liveRows.has(k)) (el.remove(), rowEls.delete(k));
    for (const [k, g] of groupEls) if (!groups.has(k)) (g.el.remove(), groupEls.delete(k));
  }

  let tm: { key: string; view: TileMapView } | null = null;
  let glb: GlbView | null = null;
  let galleryView: { el: HTMLElement; update(caps: Capture[]): void; destroy(): void } | null = null;
  let galleryKey = '';
  const destroyTm = () => {
    tm?.view.destroy();
    tm = null;
    glb?.destroy();
    glb = null;
    galleryView?.destroy();
    galleryView = null;
    galleryKey = '';
    rawBody.classList.remove('is-map');
  };

  const sig = (c: Capture) => `${c.id}|${capIdx}|${c.imgUrl ? 1 : 0}|${c.status}|${c.size}|${c.text ? 1 : 0}|${c.objectUrl ? 1 : 0}|${c.skipped ?? ''}|${c.error ?? ''}|${rawMode}|${side}`;

  function renderRaw(force = false) {
    const e = entries().find((x) => x.id === selected);
    statusEl.hidden = true;
    if (!e) {
      destroyTm();
      rawHead.innerHTML = `<h2>Rohdaten</h2>`;
      rawBody.innerHTML = `<p class="muted rdi-empty">Quelle oben rechts auswählen, um die Rohdaten zu sehen.</p>`;
      return;
    }

    if (e.tiles) {
      if (tm?.key === e.id) return tm.view.refresh();
      destroyTm();
      rawSig = '';
      rawHead.innerHTML = `${urlBox('KACHELN', e.tiles.template)}
        <div class="rdi-actions"><span class="rdi-hint">Ziehen · Mausrad zoomt · Klick wählt eine Kachel</span></div>`;
      rawBody.replaceChildren();
      rawBody.classList.add('is-map');
      tm = { key: e.id, view: createTileMap(e.tiles) };
      rawBody.append(tm.view.el);
      return;
    }
    if (e.caps.length > 1 && e.caps.every((c) => c.imgUrl)) {
      const dir = new URL(e.caps[0].url).pathname.replace(/[^/]*$/, '');
      const hint = `${e.count} Bilder · Klick zeigt das Bild groß`;
      // same folder as before: add what is new, keep scroll position and selection
      if (galleryView && galleryKey === e.id) {
        galleryView.update(e.caps);
        const h = rawHead.querySelector('.rdi-hint');
        if (h) h.textContent = hint;
        return;
      }
      destroyTm();
      rawSig = '';
      rawHead.innerHTML = `${urlBox('BILDER', new URL(e.caps[0].url).host + dir)}
        <div class="rdi-actions"><span class="rdi-hint">${hint}</span></div>`;
      rawBody.replaceChildren();
      rawBody.classList.add('is-map');
      galleryView = gallery(e.caps);
      galleryKey = e.id;
      rawBody.append(galleryView.el);
      return;
    }

    const n = e.caps.length;
    capIdx = Math.min(capIdx, n - 1);
    const c = e.caps[capIdx];
    if (!force && sig(c) === rawSig) return;
    rawSig = sig(c);
    destroyTm();
    const canTree = c.kind === 'json' && !!c.text && !c.truncated;
    rawHead.innerHTML = `
      ${urlBox(c.method, apiUrl(c), c.target ? c.url : undefined)}
      <div class="rdi-actions">
        <div class="rdi-seg" role="group" aria-label="Richtung"><button type="button" data-side="sent" class="${side === 'sent' ? 'on' : ''}">Gesendet</button><button type="button" data-side="recv" class="${side === 'recv' ? 'on' : ''}">Empfangen</button></div>
        ${n > 1 ? `<div class="rdi-seg rdi-step" role="group" aria-label="Anfrage wählen"><button type="button" data-step="-1" aria-label="Vorherige Anfrage" ${capIdx === 0 ? 'disabled' : ''}>‹</button><span>${capIdx + 1} / ${n}</span><button type="button" data-step="1" aria-label="Nächste Anfrage" ${capIdx === n - 1 ? 'disabled' : ''}>›</button></div>` : ''}
        ${canTree && side === 'recv' ? `<div class="rdi-seg"><button type="button" data-mode="tree" class="${rawMode === 'tree' ? 'on' : ''}">Baum</button><button type="button" data-mode="raw" class="${rawMode === 'raw' ? 'on' : ''}">Roh</button></div>` : ''}
        ${side === 'recv' && c.text ? `<button type="button" class="rdi-btn" data-r="copy">${COPY_ICON}Rohdaten kopieren</button>` : ''}
        ${side === 'sent' && c.reqBody ? `<button type="button" class="rdi-btn" data-r="copy">${COPY_ICON}Body kopieren</button>` : ''}
      </div>`;
    rawHead.querySelectorAll<HTMLButtonElement>('[data-side]').forEach((b) =>
      b.addEventListener('click', () => {
        side = b.dataset.side as 'sent' | 'recv';
        renderRaw(true);
      }),
    );
    rawHead.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((b) =>
      b.addEventListener('click', () => {
        rawMode = b.dataset.mode as 'tree' | 'raw';
        renderRaw(true);
      }),
    );
    rawHead.querySelectorAll<HTMLButtonElement>('[data-step]').forEach((b) =>
      b.addEventListener('click', () => {
        capIdx += Number(b.dataset.step);
        renderRaw(true);
      }),
    );
    rawHead.querySelector('[data-r=copy]')?.addEventListener('click', () => {
      void copyText(side === 'sent' ? c.reqBody ?? '' : c.text ?? '', side === 'sent' ? 'Body kopiert' : 'Rohdaten kopiert');
    });

    rawBody.replaceChildren();
    if (side === 'sent') {
      statusEl.hidden = true;
      rawBody.append(sentView(c));
      return;
    }
    statusEl.hidden = false;
    statusEl.innerHTML = statusBar(c);
    if (c.kind === 'model') {
      rawBody.classList.add('is-map');
      glb = createGlbView(c.url);
      rawBody.append(glb.el);
      return;
    }
    if (isGlyphUrl(c.url)) {
      rawBody.innerHTML = `<p class="muted rdi-empty">Schrift wird gelesen …</p>`;
      const token = ++glyphToken;
      void import('./glyphs').then((m) => m.loadGlyphView(c.url)).then(
        (v) => token === glyphToken && rawBody.replaceChildren(v),
        (err) => token === glyphToken && (rawBody.innerHTML = `<p class="rdi-err">${esc(String(err instanceof Error ? err.message : err))}</p>`),
      );
      return;
    }
    if (c.error) rawBody.append(errorView(c));
    else if (c.skipped) rawBody.innerHTML = `<p class="muted rdi-empty">${esc(c.skipped)} (${esc(c.mime || 'unbekannter Typ')}, ${fmtSize(c.size)}) – keine Vorschau.</p>`;
    else if (c.objectUrl || c.imgUrl) rawBody.innerHTML = `<div class="rdi-img"><img src="${esc(c.objectUrl ?? c.imgUrl!)}" alt="Rohbild"></div>`;
    else if (c.text == null) rawBody.innerHTML = `<p class="muted rdi-empty">Wird geladen …</p>`;
    else if (canTree && rawMode === 'tree') {
      try {
        if (!parsed.has(c)) parsed.set(c, JSON.parse(c.text));
        rawBody.append(jsonTree(parsed.get(c), null, 0, true));
      } catch {
        rawBody.append(pre(c.text));
      }
    } else {
      if (c.truncated) rawBody.insertAdjacentHTML('beforeend', `<p class="rdi-note">Sehr große Antwort: nur die ersten ${fmtSize(c.truncated)} von ${fmtSize(c.size)} wurden geladen, daher kein Baum.</p>`);
      // pretty-printing a multi-MB document would block the page: show it as received
      if (c.kind === 'json' && !c.truncated && c.text.length < 1_500_000) {
        try {
          rawBody.append(pre(JSON.stringify(JSON.parse(c.text), null, 2)));
          return;
        } catch {
          /* fall through to the plain text */
        }
      }
      rawBody.append(pre(c.text));
    }
  }

  function select(id: string) {
    selected = id;
    // newest request first
    capIdx = Number.MAX_SAFE_INTEGER;
    renderList();
    renderRaw(true);
  }

  // New requests are batched (at most ~4 redraws a second) and never redraw while a finger / the mouse is down on the list.
  let raf = 0;
  let timer = 0;
  let last = 0;
  let pressing = false;
  let dirty = false;
  const flush = () => {
    timer = 0;
    if (pressing) return void (dirty = true);
    dirty = false;
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      renderList();
      renderRaw();
    });
  };
  const schedule = () => {
    if (timer) return;
    timer = window.setTimeout(flush, Math.max(0, 250 - (performance.now() - last)));
  };
  const unsub = onCaptures(schedule);
  const release = () => {
    if (!pressing) return;
    pressing = false;
    if (dirty) setTimeout(schedule, 120);
  };
  listEl.addEventListener('pointerdown', () => (pressing = true));
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);

  overlay.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-copy]');
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    const kind = b.dataset.copy;
    const text = kind === 'url' ? b.closest<HTMLElement>('[data-url]')?.dataset.url : kind === 'val' ? jsonText(b.closest<HTMLElement>('.j-row')) : b.dataset.text;
    if (text) void copyText(text, 'In die Zwischenablage kopiert', b);
  });

  overlay.querySelectorAll<HTMLButtonElement>('[data-scope]').forEach((b) =>
    b.addEventListener('click', () => {
      scope = b.dataset.scope as 'page' | 'all';
      overlay!.querySelectorAll('[data-scope]').forEach((x) => x.classList.toggle('on', x === b));
      renderList();
    }),
  );
  $('clear').addEventListener('click', () => {
    const r = scope === 'page' ? route : undefined;
    clearCaptures(r);
    clearTiles(r);
    seen.clear();
    selected = null;
    destroyTm();
    rawSig = '';
    renderList();
    renderRaw(true);
    toast(scope === 'page' ? 'Datenquellen dieser Seite geleert' : 'Alle Datenquellen geleert');
  });
  statusEl.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('[data-hdr]')) return;
    const h = statusEl.querySelector<HTMLElement>('.rdi-hdrs');
    if (h) h.hidden = !h.hidden;
  });
  $('close').addEventListener('click', close);
  const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
  window.addEventListener('keydown', onKey);
  const onHash = () => {
    route = currentRoute();
    renderList();
    renderRaw();
  };
  window.addEventListener('hashchange', onHash);
  phone.addEventListener('change', onPhone);

  stop = () => {
    destroyTm();
    phone.removeEventListener('change', onPhone);
    window.removeEventListener('resize', fit);
    ['--rdi-sx', '--rdi-sy'].forEach((v) => shell.style.removeProperty(v));
    unsub();
    clearTimeout(timer);
    window.removeEventListener('pointerup', release);
    window.removeEventListener('pointercancel', release);
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('hashchange', onHash);
    const y = shell.scrollTop;
    document.body.classList.remove('rdi-open');
    overlay?.remove();
    overlay = null;
    window.scrollTo(0, y);
  };

  renderList();
  renderRaw();
}

function onPhone() {
  if (phone.matches) close();
}

function close() {
  stop?.();
  stop = null;
}

// ---------- helpers ----------

const COPY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" class="rdi-ic-copy"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15"/></svg><svg viewBox="0 0 24 24" aria-hidden="true" class="rdi-ic-ok"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';

/** the API that was asked: for proxied requests the target behind the proxy */
const apiUrl = (c: Capture) => c.target ?? c.url;

/** URL line of the raw-data header: label, URL, copy button; a second line names the proxy a request went through */
function urlBox(label: string, url: string, proxyUrl?: string) {
  const link = /^https?:/.test(url) ? `<a href="${esc(url)}" target="_blank" rel="noopener" title="${esc(url)}">${esc(url)}</a>` : `<span title="${esc(url)}">${esc(url)}</span>`;
  return `<div class="rdi-urlbox">
    <div class="rdi-url"><b>${esc(label)}</b>${link}<button type="button" class="rdi-ibtn" data-copy="text" data-text="${esc(url)}" aria-label="URL kopieren" title="URL kopieren">${COPY_ICON}</button></div>
    ${proxyUrl ? `<div class="rdi-url rdi-url-sub"><span class="rdi-badge rdi-badge-proxy">PROXY</span><span title="${esc(proxyUrl)}">${esc(proxyUrl)}</span><button type="button" class="rdi-ibtn" data-copy="text" data-text="${esc(proxyUrl)}" aria-label="Proxy-URL kopieren" title="Proxy-URL kopieren">${COPY_ICON}</button></div>` : ''}
  </div>`;
}

async function copyText(text: string, done: string, btn?: HTMLElement) {
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch {
    // no clipboard permission (http, iframe): the old way still works from a click
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.append(ta);
    ta.select();
    try {
      ok = document.execCommand('copy');
    } catch {
      /* ignore */
    }
    ta.remove();
  }
  if (ok && btn) {
    btn.classList.add('done');
    setTimeout(() => btn.classList.remove('done'), 1200);
  }
  toast(ok ? done : 'Kopieren nicht möglich', ok ? 'info' : 'error');
}

const TRASH_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9 7V4.5h6V7"/></svg>';

const fmtTime = (t: number) => new Date(t).toLocaleTimeString('de-DE', { hour12: false }) + `.${String(t % 1000).padStart(3, '0')}`;

/** short name of what went wrong */
function errorTitle(c: Capture) {
  return c.aborted ? 'Abgebrochen' : c.errorName === 'TypeError' ? 'Netzwerkfehler' : 'Fehler';
}

function errorExplain(c: Capture) {
  const via = c.target ? ' Die Anfrage ging über den Daten-Proxy: ob dieser oder die API dahinter ausgefallen ist, sagt der Browser nicht.' : '';
  if (c.errorName === 'TimeoutError') return `Die Seite hat nach einer festen Zeit aufgegeben (Timeout), es kam keine Antwort an.${via}`;
  if (c.aborted) return `Die Seite hat die Anfrage selbst beendet – meist weil eine neuere Anfrage sie ersetzt hat, ein Timeout griff oder die Ansicht gewechselt wurde. Eine Antwort des Servers wurde nicht mehr gelesen.${via}`;
  if (c.errorName === 'TypeError') return `Es kam keine Antwort an: Server nicht erreichbar, keine Verbindung, von CORS blockiert oder von einem Werbeblocker verworfen. Der Browser nennt den genauen Grund aus Sicherheitsgründen nicht.${via}`;
  return via.trim();
}

/** key / value rows; a value with `copy` gets a copy button */
function kv(rows: [string, string, boolean?][]) {
  return `<dl class="rdi-kv">${rows.map(([k, v, copy]) => `<dt>${esc(k)}</dt><dd><span title="${esc(v)}">${esc(v)}</span>${copy ? `<button type="button" class="rdi-ibtn" data-copy="text" data-text="${esc(v)}" aria-label="${esc(k)} kopieren" title="Kopieren">${COPY_ICON}</button>` : ''}</dd>`).join('')}</dl>`;
}

function errorView(c: Capture) {
  const d = document.createElement('div');
  d.className = 'rdi-errbox';
  const msg = c.error ?? '';
  d.innerHTML = `<h3>${esc(errorTitle(c))}</h3>
    <p>${esc(errorExplain(c))}</p>
    ${kv([
      ['Meldung', msg, true],
      ['Fehlertyp', c.errorName ?? '–'],
      ['Nach', `${c.ms} ms`],
      ['Gestartet', fmtTime(c.t)],
      ['Methode', c.method],
      ['URL', apiUrl(c), true],
      ...(c.target ? ([['Proxy', c.url, true]] as [string, string, boolean][]) : []),
    ])}`;
  return d;
}

/** status line above the response: code, text, type, size, time, and the response headers on demand */
function statusBar(c: Capture) {
  if (c.error) return `<span class="rdi-code bad">${esc(errorTitle(c))}</span><span>${c.ms} ms</span>`;
  const bad = !c.ok;
  const hdrs = c.resHeaders?.length ? c.resHeaders : null;
  return `<span class="rdi-code ${bad ? 'bad' : 'ok'}">${c.status || '…'}${c.statusText ? ` ${esc(c.statusText)}` : ''}</span>
    ${c.mime ? `<span>${esc(c.mime)}</span>` : ''}<span>${fmtSize(c.size)}</span><span>${c.ms} ms</span><span>${fmtTime(c.t)}</span>
    ${hdrs ? `<button type="button" class="rdi-btn rdi-small" data-hdr>Header (${hdrs.length})</button>` : ''}
    ${hdrs ? `<div class="rdi-hdrs" hidden>${kv(hdrs.map(([k, v]) => [k, v, true] as [string, string, boolean]))}</div>` : ''}`;
}

/** the "Gesendet" tab: what the page asked for */
function sentView(c: Capture) {
  const d = document.createElement('div');
  d.className = 'rdi-sent';
  let params: [string, string][] = [];
  try {
    params = [...new URL(apiUrl(c)).searchParams.entries()];
  } catch {
    /* odd URL */
  }
  const sec = (title: string, body: string) => `<section><h4>${title}</h4>${body}</section>`;
  d.innerHTML =
    sec('Anfrage', kv([['Methode', c.method], ['URL', apiUrl(c), true], ...(c.target ? ([['Über Proxy', c.url, true]] as [string, string, boolean][]) : []), ['Gestartet', fmtTime(c.t)], ['Seite', ROUTE_LABEL[c.route] ?? c.route]])) +
    (params.length ? sec(`Parameter (${params.length})`, kv(params.map(([k, v]) => [k, v, true] as [string, string, boolean]))) : '') +
    (c.reqHeaders ? sec(`Header (${c.reqHeaders.length})`, c.reqHeaders.length ? kv(c.reqHeaders.map(([k, v]) => [k, v, true] as [string, string, boolean])) : '<p class="muted">keine eigenen Header – der Browser ergänzt seine Standard-Header.</p>') : '<p class="muted">Vom Browser selbst geladen (Bild, Textur …): Header und Body sind nicht einsehbar.</p>');
  if (c.reqBody) d.insertAdjacentHTML('beforeend', sec('Body', ''));
  if (c.reqBody) d.lastElementChild!.append(pre(c.reqBody));
  return d;
}

const jsonValues = new WeakMap<Element, unknown>();
function jsonText(row: HTMLElement | null) {
  if (!row || !jsonValues.has(row)) return '';
  const v = jsonValues.get(row);
  return typeof v === 'string' ? v : typeof v === 'object' && v !== null ? JSON.stringify(v, null, 2) : String(v);
}
const JSON_COPY = `<button type="button" class="rdi-ibtn j-copy" data-copy="val" aria-label="Wert kopieren" title="Wert kopieren">${COPY_ICON}</button>`;

/** host + path with counters (tile numbers, glyph ranges …) replaced by "*", so repeated requests collapse into one entry */
function endpointPath(c: Capture) {
  const u = new URL(apiUrl(c));
  return `${u.host}${u.pathname
    .split('/')
    .map((seg) => (/^\d+(-\d+)?(\.\w+)?$/.test(seg) ? `*${seg.replace(/^[\d-]+/, '')}` : seg))
    .join('/')}`;
}

// Thumbnails and the large images stay cached across rebuilds: re-selecting an entry or a new request arriving
// must not decode the 8k textures again. (The downloads themselves come from the browser / service-worker cache.)
const THUMB_W = 208;
const THUMB_H = 128;
const thumbCache = new Map<string, ImageBitmap>();
const THUMB_MAX = 300;
const bigCache = new Map<string, HTMLImageElement>();
const BIG_MAX = 6;

function remember<T>(map: Map<string, T>, key: string, value: T, max: number, free?: (v: T) => void) {
  map.delete(key);
  map.set(key, value);
  while (map.size > max) {
    const [k, v] = map.entries().next().value!;
    map.delete(k);
    free?.(v);
  }
}

/** thumbnails of every image in a folder (left) and the selected one large (right).
 *  Only thumbnails that are scrolled into view are made, downscaled while decoding, two at a time. */
function gallery(initial: Capture[]): { el: HTMLElement; update(caps: Capture[]): void; destroy(): void } {
  const el = document.createElement('div');
  el.className = 'rdi-gal';
  el.innerHTML = `<div class="rdi-gal-grid rdi-scroll"></div><div class="rdi-gal-big"></div>`;
  const grid = el.querySelector<HTMLElement>('.rdi-gal-grid')!;
  const big = el.querySelector<HTMLElement>('.rdi-gal-big')!;
  const name = (c: Capture) => decodeURIComponent(c.url.split('/').pop()!.split('?')[0]);
  let shown: number | null = null;
  const show = (c: Capture) => {
    shown = c.id;
    grid.querySelectorAll('.on').forEach((b) => b.classList.remove('on'));
    grid.querySelector(`[data-id="${c.id}"]`)?.classList.add('on');
    // the full image is only requested for the one the user picked
    let img = bigCache.get(c.url);
    if (!img) {
      img = new Image();
      img.alt = name(c);
      img.src = c.url;
    }
    remember(bigCache, c.url, img, BIG_MAX);
    big.replaceChildren(img);
    big.insertAdjacentHTML('beforeend', `<div class="rdi-gal-cap"><b>${esc(name(c))}</b><span>${c.size ? `${fmtSize(c.size)} · ` : ''}${c.ms} ms</span><a href="${esc(c.url)}" target="_blank" rel="noopener">Öffnen</a><button type="button" class="rdi-ibtn" data-copy="text" data-text="${esc(c.url)}" aria-label="URL kopieren" title="URL kopieren">${COPY_ICON}</button></div>`);
  };

  let dead = false;
  const queue: HTMLCanvasElement[] = [];
  let running = 0;
  const visible = new Set<HTMLCanvasElement>();
  const capOf = new Map<HTMLCanvasElement, Capture>();

  const paint = (c: HTMLCanvasElement, src: CanvasImageSource, w: number, h: number) => {
    const k = Math.max(THUMB_W / w, THUMB_H / h);
    c.getContext('2d')!.drawImage(src, (THUMB_W - w * k) / 2, (THUMB_H - h * k) / 2, w * k, h * k);
    c.dataset.done = '1';
  };

  async function thumb(c: HTMLCanvasElement) {
    const cap = capOf.get(c)!;
    const url = cap.url;
    let src: ImageBitmap | HTMLImageElement;
    try {
      const blob = await (await rawFetch(url)).blob();
      // the resource timeline often reports 0 bytes for cached files: the real size is known now
      if (!cap.size) {
        cap.size = blob.size;
        const label = c.parentElement?.querySelector('small');
        if (label) label.textContent = fmtSize(blob.size);
      }
      src = await createImageBitmap(blob, { resizeWidth: THUMB_W * 2, resizeQuality: 'low' });
    } catch {
      // no CORS: a plain <img> can still be drawn
      src = await new Promise<HTMLImageElement>((ok, no) => {
        const im = new Image();
        im.onload = () => ok(im);
        im.onerror = no;
        im.src = url;
      });
    }
    paint(c, src, 'naturalWidth' in src ? src.naturalWidth : src.width, 'naturalHeight' in src ? src.naturalHeight : src.height);
    if ('close' in src) src.close();
    // keep the finished (small) thumbnail for the next time this gallery is built
    void createImageBitmap(c).then((bmp) => remember(thumbCache, url, bmp, THUMB_MAX, (old) => old.close()));
  }
  const pump = () => {
    while (!dead && running < 2 && queue.length) {
      const c = queue.shift()!;
      if (!visible.has(c) || c.dataset.done) continue;
      running++;
      thumb(c)
        .catch(() => c.parentElement?.classList.add('broken'))
        .finally(() => {
          running--;
          pump();
        });
    }
  };
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const c = e.target as HTMLCanvasElement;
        if (e.isIntersecting) {
          visible.add(c);
          if (!c.dataset.done) queue.push(c);
        } else visible.delete(c);
      }
      pump();
    },
    { root: grid, rootMargin: '60px' },
  );

  const haveUrl = new Set<string>();
  function update(caps: Capture[]) {
    for (const c of caps) {
      // the same file is often requested several times: one thumbnail per URL
      if (haveUrl.has(c.url)) continue;
      haveUrl.add(c.url);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `rdi-thumb${c.id === shown ? ' on' : ''}`;
      b.dataset.id = String(c.id);
      b.title = c.url;
      b.innerHTML = `<canvas width="${THUMB_W}" height="${THUMB_H}"></canvas><span>${esc(name(c))}</span><small>${c.size ? fmtSize(c.size) : '–'}</small>`;
      const cv = b.querySelector('canvas')!;
      capOf.set(cv, c);
      const cached = thumbCache.get(c.url);
      if (cached) {
        paint(cv, cached, cached.width, cached.height);
        remember(thumbCache, c.url, cached, THUMB_MAX, (old) => old.close());
      } else io.observe(cv);
      b.addEventListener('click', () => show(c));
      grid.append(b);
    }
  }
  update(initial);
  big.innerHTML = '<p class="muted rdi-empty">Bild links auswählen</p>';
  return {
    el,
    update,
    destroy() {
      dead = true;
      io.disconnect();
      queue.length = 0;
    },
  };
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

function fmtSize(n: number | null) {
  if (n == null) return '…';
  return n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} kB` : `${(n / 1048576).toFixed(1)} MB`;
}

function pre(text: string) {
  const p = document.createElement('pre');
  p.className = 'rdi-pre';
  p.textContent = text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT)}\n\n… ${fmtSize(text.length - MAX_TEXT)} abgeschnitten` : text;
  return p;
}

function prim(v: unknown) {
  const s = document.createElement('span');
  s.className = `j-${v === null ? 'null' : typeof v}`;
  s.textContent = typeof v === 'string' ? JSON.stringify(v) : String(v);
  return s;
}

/** Collapsible JSON tree; children are only built when a node is first opened. */
function jsonTree(v: unknown, key: string | null, depth: number, open = false): HTMLElement {
  const row = document.createElement(typeof v === 'object' && v !== null ? 'details' : 'div');
  row.className = 'j-row';
  const label = key == null ? '' : `<span class="j-key">${esc(key)}</span>: `;

  jsonValues.set(row, v);
  if (typeof v !== 'object' || v === null) {
    row.innerHTML = label;
    row.append(prim(v));
    row.insertAdjacentHTML('beforeend', JSON_COPY);
    return row;
  }

  const isArr = Array.isArray(v);
  const entries = isArr ? (v as unknown[]).map((x, i) => [String(i), x] as const) : Object.entries(v);
  const allPrim = entries.every(([, x]) => typeof x !== 'object' || x === null);
  const preview = allPrim
    ? ` <span class="j-preview">${esc(entries.slice(0, 8).map(([, x]) => (typeof x === 'string' ? JSON.stringify(x) : String(x))).join(', '))}${entries.length > 8 ? ', …' : ''}</span>`
    : '';
  const summary = document.createElement('summary');
  summary.innerHTML = `${label}<span class="j-count">${isArr ? `[${entries.length}]` : `{${entries.length}}`}</span>${isArr && allPrim ? preview : ''}${JSON_COPY}`;
  row.append(summary);

  // children are built in pages of PAGE; the "more" row loads the next ones
  const fill = () => {
    if (row.querySelector('.j-kids')) return;
    const kids = document.createElement('div');
    kids.className = 'j-kids';
    let shown = 0;
    const more = document.createElement('div');
    more.className = 'j-more';
    const showMore = (n: number) => {
      const end = Math.min(entries.length, shown + n);
      const frag = document.createDocumentFragment();
      for (; shown < end; shown++) {
        const [k, x] = entries[shown];
        frag.append(jsonTree(x, isArr ? `[${k}]` : k, depth + 1));
      }
      kids.insertBefore(frag, more);
      const left = entries.length - shown;
      more.hidden = left <= 0;
      more.innerHTML = `<span>${left} weitere</span><button type="button" data-n="${PAGE}">+${Math.min(PAGE, left)}</button>${left > PAGE ? `<button type="button" data-n="${Math.min(left, 1000)}">+${Math.min(left, 1000)}</button>` : ''}`;
    };
    more.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-n]');
      if (b) showMore(Number(b.dataset.n));
    });
    kids.append(more);
    showMore(PAGE);
    row.append(kids);
  };
  row.addEventListener('toggle', () => (row as HTMLDetailsElement).open && fill());
  if (open) {
    (row as HTMLDetailsElement).open = true;
    fill();
  }
  return row;
}
