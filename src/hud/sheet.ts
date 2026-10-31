import type { HudHost } from './hud';
import type { HudUi } from './core';
import { glyphSvg } from '../globe/icons';
import { escapeHtml as esc } from '../util';
import { ico } from './icons';
import type { Karte } from './karten';
import { t } from '../i18n';

// The bottom sheet of the phone portrait layout: three detents (peek / half / full), dragged by its
// handle. The HUD renders the content; this module owns the sheet element, its height and the drag.

export interface SheetDeps {
  host: HudHost;
  root: HTMLElement;
  ui: HudUi;
  layout(): string;
  /** a place card that is shown in the sheet instead of the Karte */
  placeNode: HTMLElement | null;
  /** the "save as new Karte" form while it is open */
  form: unknown;
  cur(): string;
  view(id: string): Karte;
  iconList: (...args: any[]) => any;
  nameEl: (...args: any[]) => any;
  statusLine: (...args: any[]) => any;
  contentOf: (...args: any[]) => any;
  stackBody: (...args: any[]) => any;
  stackFoot: (...args: any[]) => any;
  dialogInner: (...args: any[]) => any;
  galleryInner: (...args: any[]) => any;
  evSeg: (...args: any[]) => any;
  trafficChips: (...args: any[]) => any;
  render: (...args: any[]) => any;
  reg: (...args: any[]) => any;
  finePointer: (...args: any[]) => any;
  addInner: (...args: any[]) => any;
  mglyph: (...args: any[]) => any;
}

export function createSheet(dep: SheetDeps) {
  const { host, root, ui } = dep;
  const { view, iconList, nameEl, statusLine, contentOf, stackBody, stackFoot, dialogInner, galleryInner, evSeg, trafficChips, render, reg, finePointer, addInner, mglyph } = dep;
  let sheetEl: HTMLElement | null = null;
  let peekH = 190;
  let drag: { y0: number; h0: number; t0: number; moved: boolean; id: number } | null = null;
  let suppressClick = false;
  const halfH = () => Math.round(window.innerHeight * 0.55);
  const detentOf = (): 'peek' | 'half' | 'full' => (ui.save || ui.gallery || ui.add ? 'full' : ui.edit ? 'half' : 'peek');
  const globeView = () => root.closest<HTMLElement>('.globe-view');

  function detachDock() {
    const dock = host.dock();
    const gv = globeView();
    if (gv && dock.parentElement !== gv) gv.appendChild(dock);
  }

  function sheetHeader(k: Karte, d: 'peek' | 'half' | 'full'): string {
    if (d === 'full') {
      const title = ui.save ? t('hud.dlg.title') : ui.gallery ? t('hud.karten.galleryTitle') : t('hud.add.title');
      return `<div class="sh-title"><b>${title}</b><button type="button" class="sh-done" data-act="${ui.save ? 'cancel' : 'sheetdone'}">${ui.save ? t('hud.cancel') : t('hud.done')}</button></div>`;
    }
    const { html, more } = iconList(k, 4);
    return `<div class="kh" data-act="sheettoggle" role="button" tabindex="0" aria-expanded="${d === 'half'}" aria-label="${esc(k.name)}: ${d === 'half' ? t('hud.sheet.fold') : t('hud.sheet.unfold')}">${mglyph(k, 32)}
      <div class="tx">${d === 'half' ? nameEl(k) : `<b>${esc(k.name)}</b>`}<small>${esc(statusLine(k))}</small></div>
      <div class="lic">${html}${more ? `<span class="more">+${more}</span>` : ''}</div>
      <span class="cv ${d === 'peek' ? 'up' : ''}" aria-hidden="true">${ico('chevd', 2.2)}</span></div>`;
  }

  /** the newest event, one line (phone sheet, hazard Karten) */
  function tickerInner(): string {
    const e = host.events(ui.evHours)[0];
    return e
      ? `<span class="evg">${glyphSvg(e.kind, e.color, 28)}</span><div><b>${esc(e.title)}</b><small>${esc(e.sub)}</small></div><time>${esc(e.when)}</time>`
      : `<span class="muted">${t('hud.evEmpty')}</span>`;
  }

  function renderSheet() {
    const r = reg('sheet');
    const gv = globeView();
    if (dep.layout() !== 'portrait') {
      r.innerHTML = '';
      sheetEl = null;
      detachDock();
      gv?.style.removeProperty('--sheet-h');
      lastSheetH = -1;
      if (gv) delete gv.dataset.detent;
      return;
    }
    const k = view(dep.cur());
    const d = dep.placeNode ? 'peek' : detentOf();
    if (!sheetEl || !r.contains(sheetEl)) {
      r.innerHTML = '<div class="hud-sheet hud-glass"></div>';
      sheetEl = r.firstElementChild as HTMLElement;
      sheetObserver.disconnect();
      sheetObserver.observe(sheetEl);
    }
    const el = sheetEl;
    const prevH = el.offsetHeight;
    const prevD = el.dataset.detent;
    const scroll = el.querySelector('.sh-body')?.scrollTop ?? 0;
    const { hazard, traffic } = contentOf(k);
    let body = '';
    let foot = '';
    let header = sheetHeader(k, d);
    if (dep.placeNode) {
      header = '';
      body = '<div class="sh-place"></div>';
    } else if (d === 'full') body = ui.save ? `<div class="dlg" role="group" aria-label="${t('hud.dlg.title')}">${dialogInner()}</div>` : ui.gallery ? galleryInner() : addInner();
    else if (d === 'half') {
      body = stackBody(k);
      foot = `<div class="foot">${stackFoot(k)}</div>`;
    } else if (k.main) body = '<div class="sh-dock"></div>';
    else if (hazard) {
      body = `<div class="ticker" aria-live="polite">${tickerInner()}</div>${evSeg()}`;
    } else if (traffic.length && !k.menu) body = `<div class="chipsr">${trafficChips(k, traffic)}</div>`;

    el.innerHTML = `<div class="sh-drag"><div class="grab"></div>${header}</div><div class="sh-body">${body}</div>${foot}`;
    el.dataset.detent = d;
    el.classList.toggle('is-place', !!dep.placeNode);
    el.classList.toggle('is-dialog', ui.save && d === 'full');
    const dockSlot = el.querySelector('.sh-dock');
    if (dockSlot) dockSlot.appendChild(host.dock());
    else detachDock();
    if (dep.placeNode) el.querySelector('.sh-place')!.appendChild(dep.placeNode);
    const sb = el.querySelector('.sh-body');
    if (sb) sb.scrollTop = scroll;
    if (gv) gv.dataset.detent = dep.placeNode ? 'peek' : d;
    if (d === 'full' && ui.add && finePointer()) el.querySelector<HTMLInputElement>('#hud-aq')?.focus();

    // animate from the previous height (also settles a drag that left an inline height)
    const dragged = el.style.height !== '';
    el.style.height = '';
    el.style.transition = 'none';
    const nh = el.offsetHeight;
    if (d === 'peek' && !dep.placeNode) peekH = nh;
    if (prevH && Math.abs(prevH - nh) > 2 && (prevD !== d || dragged)) {
      el.style.height = `${prevH}px`;
      void el.offsetHeight;
      el.style.transition = 'height .22s ease';
      el.style.height = `${nh}px`;
      const done = () => {
        el.style.transition = '';
        el.style.height = '';
        el.removeEventListener('transitionend', done);
        syncSheetH();
      };
      el.addEventListener('transitionend', done);
      window.setTimeout(done, 320);
    } else el.style.transition = '';
    // the map controls ride on the sheet: hand them the height it is heading to right away
    syncSheetH(nh);
  }
  /**
   * --sheet-h on the map view = the sheet's current height above the bottom safe area (the map
   * controls sit 12px above the sheet).
   * Set on every render, while dragging and whenever the sheet resizes for other reasons (legend,
   * timeline or ticker loading, safe area changes).
   */
  let lastSheetH = -1;
  function syncSheetH(h = sheetEl?.offsetHeight ?? 0) {
    if (!sheetEl || dep.layout() !== 'portrait') return;
    const gv = globeView();
    if (!gv) return;
    // without the bottom safe area: the CSS adds that itself, so a changing safe area needs no JS
    const pad = parseFloat(getComputedStyle(sheetEl).paddingBottom) || 0;
    h = Math.round(h - pad);
    if (h === lastSheetH) return;
    lastSheetH = h;
    gv.style.setProperty('--sheet-h', `${h}px`);
  }
  const sheetObserver = new ResizeObserver(() => syncSheetH());

  function closeOverlay() {
    ui.add = false;
    ui.gallery = false;
    if (ui.save) {
      ui.save = false;
      dep.form = null;
    }
  }

  // drag the handle / header between the detents
  root.addEventListener('pointerdown', (e) => {
    const zone = (e.target as HTMLElement).closest('.sh-drag');
    if (!zone || !sheetEl || dep.layout() !== 'portrait' || (e.target as HTMLElement).closest('.sh-done, input')) return;
    drag = { y0: e.clientY, h0: sheetEl.offsetHeight, t0: performance.now(), moved: false, id: e.pointerId };
  });
  window.addEventListener('pointermove', (e) => {
    if (!drag || !sheetEl || e.pointerId !== drag.id) return;
    const dy = e.clientY - drag.y0;
    if (!drag.moved) {
      if (Math.abs(dy) < 8) return;
      drag.moved = true;
      sheetEl.style.transition = 'none';
      globeView()?.classList.add('sheet-dragging');
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    }
    const d = sheetEl.dataset.detent;
    const lo = d === 'full' ? halfH() : peekH;
    const hi = d === 'full' ? drag.h0 : halfH();
    const h = Math.max(lo, Math.min(hi, drag.h0 - dy));
    sheetEl.style.height = `${h}px`;
    syncSheetH(h);
  });
  const endDrag = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dr = drag;
    drag = null;
    globeView()?.classList.remove('sheet-dragging');
    if (!dr.moved || !sheetEl) return;
    suppressClick = true;
    window.setTimeout(() => (suppressClick = false), 60);
    const dy = e.clientY - dr.y0;
    const v = -dy / Math.max(1, performance.now() - dr.t0); // px/ms, positive = upwards
    const d = sheetEl.dataset.detent;
    if (dep.placeNode) {
      if (dy > 40) dep.placeNode = null;
    } else if (d === 'full') {
      if (dy > 70) closeOverlay();
    } else {
      const curH = Math.max(peekH, Math.min(halfH(), dr.h0 - dy));
      const half = v > 0.4 ? true : v < -0.4 ? false : curH > (peekH + halfH()) / 2;
      ui.edit = half;
      if (!half) {
        ui.open = null;
        ui.pick = false;
      }
    }
    render();
  };
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  return {
    renderSheet,
    detentOf,
    globeView,
    closeOverlay,
    tickerInner,
    syncSheetH: (h?: number) => syncSheetH(h),
    suppressClick: () => suppressClick,
    dragging: () => !!drag?.moved,
    el: () => sheetEl,
  };
}
