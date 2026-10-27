import type { EventKind } from '../api/events';
import { glyphSvg } from '../globe/icons';
import { BASES } from '../globe/style';
import { createSearch } from '../search';
import type { Place } from '../store';
import { debounce, escapeHtml as esc, fmt, toast } from '../util';
import {
  BASE_GRADIENT,
  BASE_LABEL,
  baseThumb,
  CATALOG,
  CATS,
  catalogOf,
  INFRA_LAYER_IDS,
  INFRA_MENU,
  infraCatOf,
  ISOBAR_OPTION_MAINS,
  MAIN_BASES,
  TRAFFIC_LAYER_IDS,
  TRAFFIC_MENU,
  trafficCatOf,
  WX_MENU,
  type CatalogEntry,
  type WxMenuItem,
  type WxFamily,
} from './catalog';
import { buildActions } from './actions';
import { createSheet } from './sheet';
import { FILTERS } from './filters';
import type { HudCore, HudUi } from './core';
import { ico } from './icons';
import { clone, defaultBuildings3d, defaultTerrain3d, fullSignature, loadKarten, MAX_PINNED, newId, sanitizeKarte, saveKarten, signature, STANDARD, type Karte, type KLayer, type KView } from './karten';

// The map HUD: Karten bar, collapsed Karte card / editing stack, add-layer popover, gallery, save
// dialog, search and the content cards that follow what is on the map. It owns the Karten state and
// talks to the map engine only through HudHost.

export interface HudEvent {
  kind: EventKind;
  color: string;
  title: string;
  sub: string;
  when: string;
}
export interface LegendInfo {
  title: string;
  sub: string;
  gradient: string;
  ticks: { pos: number; label: string }[];
}
export interface LayerInfo {
  sub: string;
  live: boolean;
  count: number | null;
  /** stream delay in seconds (Blitze Live: shown beside the menu row, live updated) */
  delay?: number;
}

export interface HudHost {
  /** bring the map in line with this Karte (called on every change) */
  apply(k: Karte): void;
  info(id: string): LayerInfo;
  legend(): LegendInfo | null;
  events(hours: number): HudEvent[];
  view(): KView;
  goTo(v: KView): void;
  placeName(v: KView): Promise<string | undefined>;
  onPlace(p: Place): void;
  openSettings(): void;
  /** map control column (desktop): zoom by delta levels, fly to the own position, reset the bearing */
  zoomBy(delta: number): void;
  locate(): void;
  resetNorth(): void;
  /** camera tilt in degrees (0 = top-down); animated for the 2D/3D button, immediate while the slider is dragged */
  setPitch(deg: number, animate: boolean): void;
  families(): WxFamily[];
  /** the stack opened or closed (the map keeps its centre in the free area) */
  layout(): void;
  /** the persistent element holding legend + timeline (moved into the phone sheet) */
  dock(): HTMLElement;
  /** the place weather in the phone sheet was closed (remove the map marker) */
  placeClosed(): void;
}

export type Layout = 'desktop' | 'portrait' | 'landscape';

export interface Hud {
  el: HTMLElement;
  current(): Karte;
  /** update live numbers (counts, event list) without a full re-render */
  refreshLive(): void;
  /** width in px the editing stack occupies on the left (0 when collapsed) */
  stackWidth(): number;
  importShared(code: string | null): void;
  /** current layout class: desktop, phone portrait (bottom sheet) or phone landscape (side panel) */
  layout(): Layout;
  /** re-apply layout attributes once the HUD sits in the DOM */
  relayout(): void;
  /** phone portrait: show the weather at a tapped point inside the sheet */
  showPlace(node: HTMLElement): void;
  clearPlace(): void;
  /** map bearing in degrees: turns the compass needle */
  setBearing(deg: number): void;
  /** map pitch in degrees: keeps the 2D/3D button and its slider in sync */
  syncPitch(deg: number): void;
  placeOpen(): boolean;
  /** phone portrait: content inside the sheet changed size (legend / timeline shown or hidden) */
  syncSheet(): void;
}

// ---------------------------------------------------------------------------

const filterText = (l: KLayer): string => {
  const f = FILTERS[l.id];
  if (!f || !l.filter) return '';
  return f.options.filter(([v]) => (f.multi ? l.filter!.split(',').includes(v) : v === l.filter) && v).map(([, t]) => t).join(', ');
};

/** volume of the strike tick sounds ("Blitze Live"): stored as a vol-n token in the layer filter */
const BOLT_DEFAULT_VOL = 70;
const lightningVol = (l?: KLayer): number => {
  const t = (l?.filter ?? '').split(',').find((t) => t.startsWith('vol-'));
  const v = t ? Number(t.slice(4)) : NaN;
  return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : BOLT_DEFAULT_VOL;
};
const setLightningVol = (l: KLayer | undefined, v: number) => {
  if (!l) return;
  const toks = (l.filter ?? '').split(',').filter((t) => t && !t.startsWith('vol-'));
  const n = Math.max(0, Math.min(100, Math.round(v)));
  if (n !== BOLT_DEFAULT_VOL) toks.push(`vol-${n}`);
  l.filter = toks.join(',') || undefined;
  if (!l.filter) delete l.filter;
};

const ICONS = ['cloud', 'bolt', 'wave', 'train', 'plane2', 'warn', 'fire', 'mountain', 'sun', 'snow', 'pin', 'orbit'];
const COLORS = ['#4f8dff', '#d4a800', '#1fb5d6', '#36c2a8', '#ff6b8b', '#e53935', '#ff8a4c', '#a58bff'];

/** layers suggested for a Karte, in order of relevance */
function suggestionsFor(k: Karte): [string, string][] {
  const cats = k.layers.map((l) => catalogOf(l.id)?.cat);
  const traffic = cats.filter((c) => c === 'verkehr').length >= 2;
  const hazard = cats.filter((c) => c === 'gefahr').length >= 3;
  if (k.main && !traffic) return [['lightning', 'Gewitter und Einschläge live'], ['aq', 'Luftqualität und Pollenflug'], ['gauges', 'Pegelstände in Deutschland']];
  if (hazard) return [['radiation', 'Messnetz in ganz Europa'], ['lightning', 'Gewitter live'], ['rivers', 'Hochwasser an Flüssen']];
  if (traffic) return [['transit', 'Busse und Bahnen im Stadtverkehr'], ['railmap', 'Strecken unter den Zügen'], ['airports', 'Flughäfen mit Abflügen']];
  return [['webcams', 'Live-Webcams weltweit'], ['lightning', 'Blitze Live'], ['aircraft', 'Flugzeuge live']];
}

const isStd = (k: Karte) => !!k.std;
const rel = (t?: number) => (!t || Date.now() - t < 60000 ? 'gerade eben' : fmt.relative(t));

/** compass dial: the tick ring turns against the map bearing, the red marker on it points north, the letter is the heading */
const compassDial = () => {
  // 14 slots; the one at north is left out, the red marker sits there and turns with the ring
  const ticks = Array.from({ length: 13 }, (_, i) => `<line x1="22" y1="4.5" x2="22" y2="8" transform="rotate(${(i + 1) * (360 / 14)} 22 22)" stroke-width="1.3"/>`).join('');
  return `<svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="21.5" class="disc"/><g class="ring"><g stroke="#fff" stroke-linecap="round" opacity=".8">${ticks}</g><path d="M22 1.5l2.6 4.4h-5.2z" fill="#ff4d3d"/></g><text x="22" y="22" class="hd" text-anchor="middle" dominant-baseline="central">N</text></svg>`;
};

export function createHud(host: HudHost): Hud {
  const st = loadKarten();
  let cur = st.last;
  const ui: HudUi = { edit: false, add: false, gallery: false, save: false, pick: false, open: null, q: '', moreBases: false, evHours: 24, search: false, menu: false, rename: false, folded: false, basepick: false };
  let placeNode: HTMLElement | null = null;

  // layout: desktop (>= 720 x 500), phone portrait (< 720 wide) or phone landscape (< 500 high)
  const mqLand = window.matchMedia('(max-height: 499px) and (orientation: landscape)');
  const mqPort = window.matchMedia('(max-width: 719px)');
  const calcLayout = (): Layout => (mqLand.matches ? 'landscape' : mqPort.matches ? 'portrait' : 'desktop');
  let layout: Layout = calcLayout();
  const phone = () => layout !== 'desktop';
  let fresh = new Set<string>();
  let form: { name: string; icon: string; color: string; place: boolean; pin: boolean } | null = null;

  const root = document.createElement('div');
  root.className = 'hud';
  root.innerHTML = `
    <div class="hud-r" data-r="menu"></div>
    <div class="hud-r" data-r="bar"></div>
    <div class="hud-r" data-r="modes"></div>
    <div class="hud-r" data-r="main"></div>
    <div class="hud-r" data-r="sheet"></div>
    <div class="hud-r" data-r="add"></div>
    <div class="hud-r" data-r="gallery"></div>
    <div class="hud-r" data-r="content"></div>
    <div class="hud-tr">
      <div class="hud-sx"><button type="button" class="hud-sxb" data-act="search" title="Suchen ( / )" aria-label="Suchen"></button></div>
      <button type="button" class="hud-scx" data-act="search">Abbrechen</button>
      <button type="button" class="hud-ibtn" data-act="settings" title="Einstellungen" aria-label="Einstellungen">${ico('gear')}</button>
    </div>
    <div class="hud-ctl">
      <div class="hud-cg">
        <button type="button" data-act="basepick" title="Grundkarte" aria-label="Grundkarte wählen" aria-expanded="false">${ico('earth')}</button>
        <button type="button" data-act="locate" title="Mein Standort" aria-label="Mein Standort">${ico('navarrow')}</button>
      </div>
      <div class="hud-cg">
        <button type="button" data-act="zin" title="Hineinzoomen" aria-label="Hineinzoomen">${ico('plus', 2)}</button>
        <button type="button" data-act="zout" title="Herauszoomen" aria-label="Herauszoomen">${ico('minus', 2)}</button>
      </div>
      <div class="hud-cg hud-tilt">
        <button type="button" data-act="tilt" class="hud-tbtn" title="Neigung" aria-label="Kamera neigen">3D</button>
        <div class="hud-tsl"><input type="range" min="0" max="100" step="1" value="75" aria-label="Neigung"/></div>
      </div>
      <div class="hud-cg">
        <button type="button" data-act="north" class="hud-compass" title="Norden ausrichten" aria-label="Norden ausrichten">${compassDial()}</button>
      </div>
      <div class="hud-bp hud-glass" hidden></div>
    </div>
    <div class="hud-r" data-r="dialog"></div>`;
  const reg = (n: string) => root.querySelector<HTMLElement>(`[data-r="${n}"]`)!;
  const sx = root.querySelector<HTMLElement>('.hud-sx')!;
  const sxBtn = root.querySelector<HTMLButtonElement>('.hud-sxb')!;
  sxBtn.innerHTML = ico('search');

  // ----- data helpers ------------------------------------------------------
  const allKarten = (): Karte[] => [...STANDARD, ...st.own];
  const baseOf = (id: string): Karte => allKarten().find((k) => k.id === id) ?? STANDARD[0];
  const view = (id: string): Karte => st.drafts[id] ?? baseOf(id);
  const dirty = (id: string) => !!st.drafts[id] && signature(st.drafts[id]) !== signature(baseOf(id));
  const edit = (): Karte => (st.drafts[cur] ??= clone(baseOf(cur)));
  const persist = () => saveKarten({ own: st.own, pinned: st.pinned, last: cur, drafts: st.drafts });
  const pins = () => allKarten().filter((k) => st.pinned.includes(k.id));

  function afterEdit(rerender = true) {
    const d = st.drafts[cur];
    if (d && fullSignature(d) === fullSignature(baseOf(cur))) delete st.drafts[cur];
    persist();
    host.apply(view(cur));
    if (rerender) render();
  }

  const statusLine = (k: Karte) => (isStd(k) ? `Standardkarte${dirty(k.id) ? ' · geändert' : ''}` : `Eigene Karte · ${dirty(k.id) ? 'geändert' : `gespeichert ${rel(k.savedAt)}`}`);
  const mainFam = (k: Karte) => (k.main ? host.families().find((f) => f.id === k.main) : undefined);

  /** the glyph-square icons of a Karte: weather main first, then its layers.
   *  With toggle = true the layer icons (in the settings pill) switch the layer visibility. */
  function iconList(k: Karte, max: number, toggle = false): { html: string; more: number } {
    const parts: string[] = [];
    const f = mainFam(k);
    if (f) parts.push(`<span class="main" style="background:${f.color}" data-tip="${esc(f.label)}">${ico(f.icon, 2)}</span>`);
    k.layers.slice(0, max).forEach((l) => {
      const c = catalogOf(l.id);
      if (!c) return;
      const tip = `${esc(c.label)}${l.hidden ? ' – einblenden' : ' – ausblenden'}`;
      if (toggle) parts.push(`<button type="button" class="${l.hidden ? 'off' : ''}" style="background:${c.color}" data-act="eye" data-id="${esc(l.id)}" data-tip="${tip}" aria-pressed="${!l.hidden}" title="${tip}">${ico(c.icon, 2)}</button>`);
      else parts.push(`<span class="${l.hidden ? 'off' : ''}" style="background:${c.color}" data-tip="${tip}">${ico(c.icon, 2)}</span>`);
    });
    return { html: parts.join(''), more: Math.max(0, k.layers.length - max) };
  }
  /** the Karte name in the stack header: own Karten can be renamed in place */
  const nameEl = (k: Karte) =>
    ui.rename && !isStd(k)
      ? `<input id="hud-rn" class="rnin" type="text" maxlength="40" value="${esc(k.name)}" aria-label="Name der Karte" autocomplete="off"/>`
      : isStd(k)
        ? `<b>${esc(k.name)}</b>`
        : `<button type="button" class="rn" data-act="rename" title="Umbenennen" aria-label="${esc(k.name)} umbenennen"><b>${esc(k.name)}</b>${ico('edit')}</button>`;
  const mglyph = (k: Karte, s = 34) => `<span class="mglyph" style="background:${esc(k.color)};width:${s}px;height:${s}px">${ico(k.icon, 2)}</span>`;

  // ----- regions -----------------------------------------------------------
  function renderBar() {
    const scrollLeft = reg('bar').querySelector('.hud-bar')?.scrollLeft ?? 0;
    reg('bar').innerHTML = `<div class="hud-bar hud-glass" role="tablist" aria-label="Karten">
      ${pins()
        .map((k0, i) => {
          const k = view(k0.id);
          const folded = k.id === cur && !!k.menu;
          return `<button type="button" role="tab" aria-selected="${k.id === cur}" data-act="go" data-id="${esc(k.id)}" class="${k.id === cur ? 'on' : ''}" style="--mc:${esc(k.color)}" title="${esc(k.name)}"${folded ? ` aria-expanded="${!ui.folded}"` : ''}>
            <span class="mi">${ico(k.icon, 2)}</span><span class="nm">${esc(k.name)}</span>${folded ? `<span class="arr ${ui.folded ? 'down' : 'up'}" aria-hidden="true">${ico('chevd', 2)}</span>` : `<kbd>${i + 1}</kbd>`}</button>`;
        })
        .join('')}
      <span class="sep"></span>
      <button type="button" class="all ${ui.gallery ? 'open' : ''}" data-act="gallery" aria-expanded="${ui.gallery}">${ico('grid')}<span class="nm">${phone() ? 'Alle' : 'Alle Karten'}</span></button>
    </div>`;
    const bar = reg('bar').querySelector<HTMLElement>('.hud-bar')!;
    bar.scrollLeft = scrollLeft;
  }
  /**
   * The menu under the Karten bar. Weather Karten pick the layer (category row, then its variants
   * and options); the traffic and infra Karten switch their categories (Auto, Energie …) whose
   * rows toggle layers.
   */
  function modesInner(k: Karte): string {
    if (k.menu === 'wx') {
      const f = mainFam(k);
      const curVar = f ? (k.mainVar ?? f.variants[0][0]) : '';
      const isOn = (x: WxMenuItem['subs'][number]) =>
        // "Blitze Live" is on when the live layer is active and no storm main layer is chosen
        x.main === 'lightning'
          ? boltOn && !f
          : !!f && x.main === f.id && x.mainVar === curVar;
      // option chips of "Blitze Live" as a further indented list inside the Gewitter rows;
      // when Ton is on, a volume slider sits beside its chip
      const bolt = k.layers.find((x) => x.id === 'lightning');
      const boltOn = !!bolt && !bolt.hidden;
      const chip = (o: boolean, v: string, label: string) =>
        `<button type="button" class="tgl ${o ? 'on' : ''}" data-act="filter" data-id="lightning" data-v="${v}" aria-pressed="${o}">${label}</button>`;
      const has = (v: string) => (bolt?.filter ?? '').split(',').includes(v);
      const vol = lightningVol(bolt);
      const volRow = `<div class="volrow">${chip(has('sound'), 'sound', 'Ton')}<input type="range" class="rng volr" min="0" max="100" step="5" value="${vol}" data-vol="lightning" aria-label="Lautstärke der Tick-Töne"/></div>`;
      const boltChips =
        (has('sound') ? volRow : chip(has('sound'), 'sound', 'Ton')) +
        chip(has('wave'), 'wave', 'Kreis') +
        chip(has('detectors'), 'detectors', 'Detektoren') +
        chip(has('lines'), 'lines', 'Linien') +
        chip(has('thunder'), 'thunder', 'Donner');
      const subs = (it: WxMenuItem): string => {
        // beside "Blitze Live" the stream delay in seconds (live refresh via refreshLive, data-d)
        const delay = (x: WxMenuItem['subs'][number]) => (x.main === 'lightning' && boltOn ? '<em class="n" data-d="lightning"></em>' : '');
        const rows = it.subs.filter((x) => x.label).map((x) => `<button type="button" data-act="wxsub" data-id="${esc(it.id)}" data-v="${it.subs.indexOf(x)}" class="${isOn(x) ? 'on' : ''}" aria-pressed="${isOn(x)}">${esc(x.label)}${delay(x)}</button>`);
        if (f && ISOBAR_OPTION_MAINS.includes(f.id)) rows.push(`<button type="button" class="tgl ${k.isobars ? 'on' : ''}" data-act="wopt" data-v="isobars" aria-pressed="${!!k.isobars}">Isobaren</button>`);
        // when "Blitze Live" is chosen, its options follow as a nested list right underneath it
        if (it.id === 'storm' && boltOn) {
          const i = it.subs.findIndex((x) => x.main === 'lightning');
          if (i > -1 && rows[i]) rows.splice(i + 1, 0, `<div class="subs">${boltChips}</div>`);
        }
        return rows.length ? `<div class="subs">${rows.join('')}</div>` : '';
      };
      return `<div class="wxm hud-glass" role="group" aria-label="Wetterebene"><div class="mrow cats">${WX_MENU.map((it) => {
      // the Gewitter entry stays active while the live strikes are switched on
      const on = it.id === 'storm' ? boltOn || it.subs.some(isOn) : it.subs.some(isOn);
      return `<button type="button" data-act="wxcat" data-id="${esc(it.id)}" class="${on ? 'on' : ''}" aria-pressed="${on}" style="--lc:${esc(it.color)}" title="${esc(it.hint)}"><i>${ico(it.icon, 2)}</i><span>${esc(it.label)}</span></button>${on ? subs(it) : ''}`;
      }).join('')}</div></div>`;
    }
    const menu = k.menu === 'infra' ? INFRA_MENU : TRAFFIC_MENU;
    const cur = tmodeOf(k);
    const have = (id: string) => k.layers.some((l) => l.id === id && !l.hidden);
    const toggle = (label: string, layers: string[]) => {
      const on = layers.every(have);
      const n = on ? host.info(layers[0]).count : null;
      const c = catalogOf(layers[0]);
      // statt eines Schalters zeigt die Reihe den Farbpunkt der Ebene quasi als Legende
      return `<button type="button" class="tgl ${on ? 'on' : ''}" data-act="ttog" data-id="${esc(layers.join(','))}" aria-pressed="${on}"><span>${esc(label)}</span><em class="n" data-n="${esc(layers[0])}">${n != null ? n.toLocaleString('de-DE') : ''}</em>${c ? `<i class="dot" style="background:${esc(c.color)}"></i>` : ''}</button>`;
    };
    const label = k.menu === 'infra' ? 'Infrastruktur' : 'Verkehrsmittel';
    return `<div class="wxm hud-glass" role="group" aria-label="${esc(label)}"><div class="mrow cats">${menu.map((c) => {
      const on = c.id === cur;
      return `<button type="button" data-act="tcat" data-id="${esc(c.id)}" class="${on ? 'on' : ''}" aria-pressed="${on}" style="--lc:${esc(k.color)}"><i>${ico(c.icon, 2)}</i><span>${esc(c.label)}</span></button>${on ? `<div class="subs">${c.rows.map((r) => toggle(r.label, r.layers)).join('')}</div>` : ''}`;
    }).join('')}</div></div>`;
  }
  /** the chosen menu category (Karten saved before the menu: the one their layers belong to) */
  function tmodeOf(k: Karte): string {
    const ids = k.menu === 'infra' ? INFRA_LAYER_IDS : TRAFFIC_LAYER_IDS;
    const catOf = k.menu === 'infra' ? infraCatOf : trafficCatOf;
    return k.tmode ?? catOf(k.layers.find((l) => ids.has(l.id))?.id ?? '')?.id ?? '';
  }
  /** the one line of the folded menu: the layer / category chosen right now, e. g. "Satellit (HD)" */
  const SOURCE_PARENS = /\s*\((?:RainViewer|DWD|NASA|NOAA|IMERG|VIIRS|Meteosat|Open-Meteo|OSM)\)$/i;
  function foldedLabel(k: Karte): { label: string; icon: string; color: string } {
    const boltOn = k.layers.some((l) => l.id === 'lightning' && !l.hidden);
    if (k.menu === 'wx') {
      if (boltOn) return { label: 'Gewitter (Blitze Live)', icon: 'bolt', color: '#ffcc33' };
      const f = mainFam(k);
      if (!f || !k.main) return { label: 'Keine Ebene', icon: k.icon, color: k.color };
      const varId = k.mainVar ?? f.variants[0][0];
      for (const it of WX_MENU) {
        const sub = it.subs.find((x) => x.main === f.id && x.mainVar === varId);
        if (!sub) continue;
        const v = (sub.label || f.variants.find(([id]) => id === varId)?.[1] || '').replace(SOURCE_PARENS, '');
        return { label: v ? `${it.label} (${v})` : it.label, icon: it.icon, color: it.color };
      }
      return { label: f.label, icon: f.icon, color: f.color };
    }
    const menu = k.menu === 'infra' ? INFRA_MENU : TRAFFIC_MENU;
    const cat = menu.find((c) => c.id === tmodeOf(k));
    if (cat) {
      // erste aktive Reihe zeigen (z. B. "Auto · Straßen"); ohne aktive Reihe nur die Kategorie
      const on = cat.rows.filter((r) => r.layers.every((l) => k.layers.some((x) => x.id === l && !x.hidden)));
      const row = on.length === 1 ? on[0] : null;
      return row ? { label: `${cat.label} · ${row.label}`, icon: cat.icon, color: k.color } : { label: cat.id ? cat.label : 'Keine Kategorie', icon: cat.icon, color: k.color };
    }
    return { label: menu[0]?.label ?? k.name, icon: menu[0]?.icon ?? k.icon, color: k.color };
  }
  let lastFolded: boolean | null = null;
  function renderModes() {
    const r = reg('modes');
    // beside the editing stack the weather controls of the stack take over
    if (!view(cur).menu || (ui.edit && layout !== 'portrait')) {
      r.innerHTML = '';
      lastFolded = null;
      return;
    }
    const lx = r.querySelector('.wxm')?.scrollTop ?? 0;
    const k = view(cur);
    // height of the rendered menu before the swap: the fold/unfold animation starts from it
    const prevH = r.querySelector<HTMLElement>('.wxm')?.offsetHeight ?? 0;
    const folding = lastFolded !== null && lastFolded !== ui.folded;
    lastFolded = ui.folded;
    // collapsed: a single line naming the chosen sub-point; tapping it (or the Karte again) unfolds
    if (ui.folded) {
      const f = foldedLabel(k);
      r.innerHTML = `<div class="wxm folded hud-glass" role="group" aria-label="Ausgewählte Ebene"><button type="button" class="mrow" data-act="menuunfold" aria-expanded="false" title="Menü aufklappen">
        <span class="fl"><i style="--lc:${esc(f.color)}">${ico(f.icon, 2)}</i><span class="lb">${esc(f.label)}</span></span></button></div>`;
    } else {
      r.innerHTML = modesInner(k);
      const m = r.querySelector('.wxm');
      if (m) m.scrollTop = lx;
    }
    if (folding) foldAnimate(r.querySelector<HTMLElement>('.wxm'), prevH);
  }

  /** animate the menu between the full list and the one line (height + fade) */
  function foldAnimate(m: HTMLElement | null, fromH: number) {
    if (!m || !fromH) return;
    const toH = m.offsetHeight;
    m.style.overflow = 'hidden';
    void m.offsetHeight;
    m.animate(
      [
        { height: `${fromH}px`, opacity: Math.min(1, fromH / Math.max(1, toH)), transform: 'translateY(-4px)' },
        { height: `${toH}px`, opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 210, easing: 'cubic-bezier(.3,.9,.4,1)' },
    ).finished.then(() => {
      m.style.overflow = '';
      if (!ui.folded) m.scrollTop = 0;
    });
  }

  /** keep the active pill visible in the scrolling Karten bar */
  function revealActive() {
    const bar = reg('bar').querySelector<HTMLElement>('.hud-bar');
    const on = bar?.querySelector<HTMLElement>('button.on');
    if (!bar || !on) return;
    const l = on.offsetLeft;
    const r = l + on.offsetWidth;
    if (l < bar.scrollLeft) bar.scrollLeft = Math.max(0, l - 10);
    else if (r > bar.scrollLeft + bar.clientWidth - 30) bar.scrollLeft = r - bar.clientWidth + 40;
  }

  const placeText = (v: KView) => `${v.name ?? fmt.coords(v.center[1], v.center[0])} · Zoom ${Math.round(v.zoom)}`;

  /** the collapsed stack: a settings gear plus the active layer icons – icons only, names as hover tooltip */
  function summary(k: Karte) {
    const { html, more } = iconList(k, 8, true);
    return `<div class="sum hud-glass${dirty(k.id) ? ' changed' : ''}" role="group" aria-label="Einstellungen für ${esc(k.name)}${dirty(k.id) ? ' – geändert' : ''}">
      <button type="button" class="gear" data-act="edit" aria-expanded="false" aria-label="Einstellungen öffnen" data-tip="${esc(k.name)} – Einstellungen öffnen">${ico('gear', 2)}</button>
      <span class="lic">${html}${more ? `<span class="more" data-tip="+${more} weitere Ebenen">+${more}</span>` : ''}</span>
      ${k.view ? `<span class="pin" data-tip="Ausschnitt: ${esc(placeText(k.view))}">${ico('pin', 2)}</span>` : ''}
    </div>`;
  }

  function layerRow(l: KLayer): string {
    const c = catalogOf(l.id);
    if (!c) return '';
    const open = ui.open === l.id;
    const info = host.info(l.id);
    const f = FILTERS[l.id];
    const op = l.opacity ?? 100;
    const sub = [info.sub || c.hint, filterText(l)].filter(Boolean).join(' · ');
    return `<div class="lyr ${open ? 'open' : ''} ${l.hidden ? 'off' : ''} ${fresh.has(l.id) ? 'new' : ''}" data-lid="${esc(l.id)}">
      <span class="grip" data-grip title="Ziehen zum Sortieren (oder Alt + ↑/↓)" aria-hidden="true">${ico('grip', 3)}</span><span class="glyph" style="background:${c.color}">${ico(c.icon, 2)}</span>
      <div class="nm">${esc(c.label)}${c.region ? `<span class="tagr">${esc(c.region)}</span>` : ''}<small><span class="live" ${info.live ? '' : 'hidden'}>● </span><span data-sub="${esc(l.id)}">${esc(sub)}</span></small></div>
      <button type="button" class="ic" data-act="eye" data-id="${esc(l.id)}" title="${l.hidden ? 'Einblenden' : 'Ausblenden'}" aria-pressed="${!l.hidden}">${ico(l.hidden ? 'eyeoff' : 'eye')}</button>
      <button type="button" class="ic" data-act="open" data-id="${esc(l.id)}" title="Einstellungen" aria-expanded="${open}">${ico(open ? 'chevd' : 'sliders')}</button>
      ${
        open
          ? `<div class="more">
        ${c.kind === 'extra' ? `<label class="op"><span>Deckkraft</span><input type="range" class="rng" min="10" max="100" step="5" value="${op}" data-op="${esc(l.id)}" aria-label="Deckkraft"/><span data-opv>${op} %</span></label>` : ''}
        ${f ? `<div class="fl">${f.options.map(([v, t]) => `<button type="button" class="chip ${f.multi ? ((l.filter ?? '').split(',').includes(v) ? 'on' : '') : (l.filter ?? '') === v ? 'on' : ''}" data-act="filter" data-id="${esc(l.id)}" data-v="${esc(v)}">${esc(t)}</button>`).join('')}</div>` : ''}
        <div class="src"><span>${esc(c.hint)}</span><button type="button" data-act="remove" data-id="${esc(l.id)}">Entfernen</button></div>
      </div>`
          : ''
      }
    </div>`;
  }

  function mainCard(k: Karte): string {
    const fams = host.families();
    const f = mainFam(k);
    const pick = (cur2: string | null) =>
      `<div class="wxpick">${fams.map((x) => `<button type="button" data-act="main" data-id="${esc(x.id)}" class="${cur2 === x.id ? 'on' : ''}" title="${esc(x.hint)}">${ico(x.icon)}${esc(x.label)}</button>`).join('')}<button type="button" data-act="main" data-id="" class="${cur2 ? '' : 'on'}">${ico('x')}Keine</button></div>`;
    if (!f) {
      return `<div class="mainwx none"><div class="t"><div><b>Keine Wetterebene</b><small>Diese Karte zeigt kein Wetterfeld</small></div></div>${pick(null)}</div>`;
    }
    const lg = host.legend();
    const variantId = k.mainVar ?? f.variants[0][0];
    const opts: string[] = [];
    if (ISOBAR_OPTION_MAINS.includes(f.id)) opts.push(`<button type="button" class="chip ${k.isobars ? 'on' : ''}" data-act="wopt" data-v="isobars">Isobaren</button>`);
    return `<div class="mainwx" style="--lc:${f.color}">
      <div class="t"><span class="glyph" style="background:${f.color}">${ico(f.icon, 2)}</span><div><b>${esc(f.label)}</b><small>${esc(f.hint)}</small></div>
        <button type="button" class="sw" data-act="pick" aria-expanded="${ui.pick}">Wechseln ${ico('chevd')}</button></div>
      ${ui.pick ? pick(f.id) : ''}
      ${f.variants.length > 1 ? `<div class="seg">${f.variants.map(([v, t]) => `<button type="button" data-act="var" data-v="${esc(v)}" class="${variantId === v ? 'on' : ''}">${esc(t)}</button>`).join('')}</div>` : ''}
      ${opts.length ? `<div class="fl">${opts.join('')}</div>` : ''}
      ${lg?.gradient ? `<div class="g" style="background:${lg.gradient}"></div><div class="ticks">${lg.ticks.map((t) => `<span style="left:${t.pos}%">${esc(t.label)}</span>`).join('')}</div>` : ''}
    </div>`;
  }

  function stackBody(k: Karte): string {
    const timeTxt = k.main === 'sat' && (k.mainVar ?? 'sat-hd') === 'sat-hd' ? 'Tagesbild von gestern' : k.main && k.main !== 'radar' && k.main !== 'sat' ? 'Vorhersage, ab jetzt' : 'Live';
    const bases = BASES.map((b) => b.id);
    const others = bases.filter((b) => !MAIN_BASES.includes(b));
    const showMore = ui.moreBases || others.includes(k.base);
    return `
        <div class="slot"><span>Ebenen</span><small>oben liegt oben</small></div>
        ${k.layers.map(layerRow).join('') || '<div class="muted" style="font-size:12.5px;padding:4px">Noch keine Ebenen.</div>'}
        <button type="button" class="addbtn ${ui.add ? 'on' : ''}" data-act="add">${ico('plus')}Ebene hinzufügen</button>
        <div class="slot"><span>Wetter</span><small>höchstens eine</small></div>
        ${mainCard(k)}
        <div class="slot"><span>Grundkarte</span></div>
        <div class="baserow">${MAIN_BASES.map((b) => `<button type="button" data-act="base" data-id="${b}" class="${k.base === b ? 'on' : ''}" style="background:${BASE_GRADIENT[b]}" aria-pressed="${k.base === b}"><i class="bth">${baseThumb(b)}</i><span>${BASE_LABEL[b]}</span></button>`).join('')}</div>
        ${showMore ? `<div class="fl basemore">${others.map((b) => `<button type="button" class="chip ${k.base === b ? 'on' : ''}" data-act="base" data-id="${b}">${BASE_LABEL[b]}</button>`).join('')}</div>` : `<button type="button" class="linkbtn" data-act="morebases">Weitere Grundkarten</button>`}
        <div class="opt" data-act="tog" data-v="labels" role="switch" aria-checked="${k.labels}" tabindex="0">${ico('map')}<div>Ortsnamen & Grenzen</div><span class="toggle ${k.labels ? 'on' : ''}"></span></div>
        <div class="opt">${ico('sun')}<div>Tag/Nacht</div><div class="seg">${(['day', 'auto', 'night'] as const).map((v) => `<button type="button" data-act="night" data-v="${v}" class="${k.night === v ? 'on' : ''}" aria-pressed="${k.night === v}">${{ day: 'Tag', auto: 'Auto', night: 'Nacht' }[v]}</button>`).join('')}</div></div>
        <div class="opt" data-act="tog" data-v="buildings3d" role="switch" aria-checked="${k.buildings3d ?? defaultBuildings3d(k.base)}" tabindex="0">${ico('city')}<div>3D-Gebäude<small>ab Stadtzoom · Karte mit Strg + Ziehen kippen (OpenStreetMap)</small></div><span class="toggle ${k.buildings3d ?? defaultBuildings3d(k.base) ? 'on' : ''}"></span></div>
        <div class="opt" data-act="tog" data-v="terrain3d" role="switch" aria-checked="${k.terrain3d ?? defaultTerrain3d()}" tabindex="0">${ico('mountain')}<div>3D-Gelände<small>echte Höhen, nur bei geneigter Kamera (Strg + Ziehen) – von oben deaktiviert</small></div><span class="toggle ${k.terrain3d ?? defaultTerrain3d() ? 'on' : ''}"></span></div>
        <div class="opt" data-act="tog" data-v="wind" role="switch" aria-checked="${k.wind !== false}" tabindex="0">${ico('wind')}<div>Windpartikel<small>bei Wind & Böen und Satellit/Wolken (IR) sichtbar</small></div><span class="toggle ${k.wind !== false ? 'on' : ''}"></span></div>
        <div class="slot"><span>Gespeichert mit</span></div>
        <div class="opt" data-act="viewtog" role="switch" aria-checked="${!!k.view}" tabindex="0">${ico('pin')}<div>Ausschnitt<small>${k.view ? esc(placeText(k.view)) : 'nein, öffnet am aktuellen Ort'}</small></div><span class="toggle ${k.view ? 'on' : ''}"></span></div>
        <div class="opt">${ico('clock')}<div>Zeit<small>${timeTxt}</small></div></div>
    `;
  }
  function stackFoot(k: Karte): string {
    return `${
        dirty(cur)
          ? `<span class="st" title="Geändert"><i></i><span class="stl">Geändert</span></span><button type="button" class="ebtn ghost rv" data-act="revert" title="Zurücksetzen" aria-label="Zurücksetzen">${ico('reset')}<span class="lb">Zurücksetzen</span></button>${isStd(k) ? '' : '<button type="button" class="ebtn" data-act="overwrite">Speichern</button>'}<button type="button" class="ebtn pri" data-act="saveas">Als neue Karte</button>`
          : `<span class="st ok" title="${isStd(k) ? 'Standardkarte' : 'Gespeichert'}"><i></i></span><button type="button" class="ebtn ghost rv" data-act="revert" title="Auf den Ausgangszustand zurücksetzen" aria-label="Zurücksetzen" ${st.drafts[cur] ? '' : 'disabled'}>${ico('reset')}<span class="lb">Zurücksetzen</span></button><button type="button" class="ebtn ghost" data-act="share" title="Teilen" aria-label="Teilen">${ico('share')}<span class="lb">Teilen</span></button><button type="button" class="ebtn ghost" data-act="saveas" title="Duplizieren" aria-label="Duplizieren">${ico('copy')}<span class="lb">Duplizieren</span></button>`
      }`;
  }
  function stackPanel(k: Karte): string {
    return `<div class="stack hud-glass">
      <div class="mh" data-act="close" role="button" tabindex="0" aria-expanded="true" title="Zuklappen">${mglyph(k)}<div class="tx">${nameEl(k)}<small>${esc(statusLine(k))}</small></div><span class="chevi" aria-hidden="true">${ico('chevd', 2.2).replace('<svg ', '<svg class="up" ')}</span></div>
      <div class="scroll">${stackBody(k)}</div>
      <div class="foot">${stackFoot(k)}</div>
    </div>`;
  }

  function renderMain() {
    const k = view(cur);
    if (layout === 'portrait') {
      reg('main').innerHTML = '';
      return;
    }
    const scroll = reg('main').querySelector('.stack .scroll')?.scrollTop ?? 0;
    reg('main').innerHTML = ui.edit ? stackPanel(k) : summary(k);
    const sc = reg('main').querySelector('.stack .scroll');
    if (sc) sc.scrollTop = scroll;
    // the collapsed settings pill closes up to the menu row: directly beside the (folded) menu
    if (!ui.edit) {
      const s = reg('main').querySelector<HTMLElement>('.sum');
      const m = reg('modes').querySelector<HTMLElement>('.wxm');
      if (s && m && m.offsetWidth) s.style.left = `calc(var(--hud-l) + ${m.offsetWidth + 8}px)`;
    }
  }

  // --- add popover
  function addRow(c: CatalogEntry, sub: string, sug = false) {
    return `<div class="ar ${sug ? 'sug' : ''}" data-act="addlayer" data-id="${esc(c.id)}" role="button" tabindex="0"><span class="glyph" style="background:${c.color}">${ico(c.icon, 2)}</span>
      <div><b>${esc(c.label)}</b>${c.region ? `<span class="tagr">${esc(c.region)}</span>` : ''}<small>${esc(sub)}</small></div><span class="plus">${ico('plus', 2.4)}</span></div>`;
  }
  function addList(): string {
    const k = view(cur);
    const have = new Set(k.layers.map((l) => l.id));
    const q = ui.q.trim().toLowerCase();
    let body = '';
    const sg = q ? [] : suggestionsFor(k).filter(([id]) => !have.has(id) && catalogOf(id));
    // suggested layers appear in their own block only, not a second time in the categories
    const shown = new Set(sg.map(([id]) => id));
    if (sg.length) body += `<h4>${ico('sparkle', 2)}Passend zu dieser Karte</h4>${sg.map(([id, why]) => addRow(catalogOf(id)!, why, true)).join('')}`;
    for (const cat of CATS) {
      const items = CATALOG.filter((c) => c.cat === cat.id && !have.has(c.id) && !shown.has(c.id) && (!q || `${c.label} ${c.hint} ${cat.label}`.toLowerCase().includes(q)));
      if (items.length) body += `<h4>${esc(cat.label)}</h4>${items.map((c) => addRow(c, c.hint)).join('')}`;
    }
    return body || `<div class="empty">Keine Ebene für „${esc(ui.q)}“.</div>`;
  }
  const addInner = () =>
    `<label class="srch">${ico('search')}<input id="hud-aq" type="text" autocomplete="off" placeholder="Ebene suchen, z. B. „Blitze“" value="${esc(ui.q)}"/></label><div class="lst addlst">${addList()}</div>`;
  const finePointer = () => window.matchMedia('(pointer: fine)').matches;
  function renderAdd() {
    const r = reg('add');
    if (!(ui.edit && ui.add) || layout === 'portrait') {
      r.innerHTML = '';
      return;
    }
    if (!r.querySelector('.addpop')) {
      r.innerHTML = `<div class="addpop hud-glass">${addInner()}</div>`;
      if (finePointer()) queueMicrotask(() => r.querySelector<HTMLInputElement>('#hud-aq')?.focus());
    }
    r.querySelector('.addlst')!.innerHTML = addList();
  }

  // --- gallery
  function galleryCard(k0: Karte): string {
    const k = view(k0.id);
    const { html, more } = iconList(k, 8);
    const n = k.layers.length + (k.main ? 1 : 0);
    const f = mainFam(k);
    return `<div class="gc ${k.id === cur ? 'cur' : ''}" data-act="go" data-id="${esc(k.id)}" role="button" tabindex="0">
      <div class="th" style="background:radial-gradient(120% 120% at 20% 0%, ${esc(k.color)}55, transparent 60%), ${BASE_GRADIENT[k.base]}"><span class="thi">${ico(f ? f.icon : k.icon, 1.6)}</span></div>
      ${isStd(k) ? '<span class="std">Standard</span>' : ''}${dirty(k.id) ? '<span class="chg">geändert</span>' : ''}
      <button type="button" class="pin ${st.pinned.includes(k.id) ? 'on' : ''}" data-act="pin" data-id="${esc(k.id)}" title="${st.pinned.includes(k.id) ? 'Von der Leiste lösen' : 'An die Leiste heften'}" aria-pressed="${st.pinned.includes(k.id)}">${ico('starf')}</button>
      <div class="gt"><b><i style="background:${esc(k.color)}">${ico(k.icon, 2)}</i><span>${esc(k.name)}</span></b>
        <div class="icons">${html}${more ? `<span class="more">+${more}</span>` : ''}</div>
        <small>${n} Ebenen${k.view ? ` · ${esc((k.view.name ?? 'Ausschnitt').split(',')[0])}` : ''}</small></div>
      ${isStd(k) ? '' : `<button type="button" class="del" data-act="del" data-id="${esc(k.id)}" title="Karte löschen" aria-label="Karte löschen">${ico('x')}</button>`}</div>`;
  }
  const galleryInner = () => `
      <h4><span>Standardkarten</span><small>anpassbar, jederzeit zurücksetzbar</small></h4>
      <div class="ggrid">${STANDARD.map(galleryCard).join('')}
        <div class="gc new" data-act="blank" role="button" tabindex="0">${ico('plus')}${phone() ? 'Neue Karte' : 'Neue leere Karte'}<small>Grundkarte wählen, Ebenen hinzufügen</small></div></div>
      <h4><span>Meine Karten</span><small>${st.own.length} gespeichert · ★ = in der Leiste</small></h4>
      ${st.own.length ? `<div class="ggrid">${st.own.map(galleryCard).join('')}</div>` : '<div class="muted gempty">Noch keine eigenen Karten. Ändere eine Karte und speichere sie als neue Karte.</div>'}
      ${phone() ? `<button type="button" class="setrow" data-act="settings">${ico('gear')}Einstellungen<span class="c">${ico('chev')}</span></button>` : `<div class="ghint"><span>Tasten 1–${Math.min(MAX_PINNED, st.pinned.length)} wechseln die angehefteten Karten</span></div>`}`;
  function renderGallery() {
    if (!ui.gallery || layout === 'portrait') {
      reg('gallery').innerHTML = '';
      return;
    }
    reg('gallery').innerHTML = `<div class="gallery hud-glass">${galleryInner()}</div>`;
  }

  // --- save dialog
  function suggestName(k: Karte): string {
    const b = baseOf(cur);
    const added = k.layers.filter((l) => !b.layers.some((x) => x.id === l.id)).map((l) => catalogOf(l.id)?.label ?? '');
    const parts = [mainFam(k) && (!b.main || b.main !== k.main) ? mainFam(k)!.label : '', ...added].filter(Boolean);
    return parts.slice(0, 2).join(' + ') || `${k.name} (eigene)`;
  }
  function dialogInner(): string {
    if (!form) return '';
    const k = view(cur);
    const f = mainFam(k);
    const inc = [f && `${f.label}${f.variants.length > 1 ? ` (${f.variants.find(([v]) => v === (k.mainVar ?? f.variants[0][0]))?.[1] ?? ''})` : ''}`, ...k.layers.filter((l) => !l.hidden).map((l) => catalogOf(l.id)?.label)].filter(Boolean);
    const full = st.pinned.length >= MAX_PINNED;
    return `
        <div class="pv" style="background:radial-gradient(120% 140% at 20% 0%, ${esc(form.color)}88, transparent 65%), ${BASE_GRADIENT[k.base]}"><span class="badge" style="background:${esc(form.color)}">${ico(form.icon, 2)}</span></div>
        <div class="bd">
          <h3>Als neue Karte speichern</h3>
          <label class="fld"><span>Name</span><input id="hud-nm" type="text" maxlength="40" value="${esc(form.name)}" autocomplete="off"/></label>
          <div class="row2">
            <div class="fld"><span>Symbol</span><div class="icgrid">${ICONS.map((i) => `<button type="button" data-act="ficon" data-v="${i}" class="${form!.icon === i ? 'on' : ''}" aria-label="${i}">${ico(i)}</button>`).join('')}</div></div>
            <div class="fld"><span>Farbe</span><div class="colgrid">${COLORS.map((c) => `<button type="button" data-act="fcol" data-v="${c}" class="${form!.color === c ? 'on' : ''}" style="background:${c}" aria-label="${c}"></button>`).join('')}</div></div>
          </div>
          <div class="incl"><b>Enthält:</b> ${esc(inc.join(', ') || 'keine Ebenen')} · Grundkarte ${BASE_LABEL[k.base]}</div>
          <div>
            <div class="opt" data-act="fplace" role="switch" aria-checked="${form.place}" tabindex="0">${ico('pin')}<div>Ausschnitt mitspeichern<small>Sonst öffnet sie am aktuellen Ort.</small></div><span class="toggle ${form.place ? 'on' : ''}"></span></div>
            <div class="opt" data-act="fpin" role="switch" aria-checked="${form.pin}" tabindex="0">${ico('starf')}<div>In der Leiste anheften<small>${full ? 'Leiste ist voll (5). Erst eine Karte lösen.' : `als Taste ${st.pinned.length + 1}`}</small></div><span class="toggle ${form.pin && !full ? 'on' : ''}"></span></div>
          </div>
        </div>
        <div class="act"><button type="button" class="ebtn ghost" data-act="cancel">Abbrechen</button><button type="button" class="ebtn pri" data-act="dosave">Karte speichern</button></div>`;
  }
  function renderDialog() {
    const r = reg('dialog');
    if (!ui.save || !form || layout === 'portrait') {
      r.innerHTML = '';
      return;
    }
    const opening = !r.querySelector('.dlg');
    const focused = (document.activeElement as HTMLElement | null)?.closest('[data-act]')?.getAttribute('data-act');
    const fv = (document.activeElement as HTMLElement | null)?.dataset?.v;
    r.innerHTML = `<div class="scrim" data-act="cancel"></div><div class="dlg hud-glass" role="dialog" aria-modal="true" aria-label="Als neue Karte speichern">${dialogInner()}</div>`;
    if (opening) {
      const nm = r.querySelector<HTMLInputElement>('#hud-nm');
      nm?.focus();
      nm?.select();
    } else if (focused) r.querySelector<HTMLElement>(`[data-act="${focused}"]${fv ? `[data-v="${CSS.escape(fv)}"]` : ''}`)?.focus();
  }

  // --- content that follows the Karte
  /** what the Karte's content calls for: weather legend, hazard events or traffic counters */
  function contentOf(k: Karte) {
    const vis = k.layers.filter((l) => !l.hidden).map((l) => catalogOf(l.id)).filter((c): c is CatalogEntry => !!c);
    return {
      hazard: vis.filter((c) => c.cat === 'gefahr').length >= 3,
      traffic: k.layers.map((l) => catalogOf(l.id)).filter((c): c is CatalogEntry => !!c && c.cat === 'verkehr'),
    };
  }
  const evSeg = () =>
    `<div class="seg"><button type="button" data-act="evh" data-v="24" class="${ui.evHours === 24 ? 'on' : ''}">24 h</button><button type="button" data-act="evh" data-v="168" class="${ui.evHours === 168 ? 'on' : ''}">7 Tage</button></div>`;
  const evRow = (e: HudEvent) =>
    `<div class="ev"><span class="evg">${glyphSvg(e.kind, e.color, 26)}</span><div><b>${esc(e.title)}</b><span>${esc(e.sub)}</span></div><time>${esc(e.when)}</time></div>`;
  function trafficChips(k: Karte, traf: CatalogEntry[]): string {
    return (
      traf
        .map((c) => {
          const n = host.info(c.id).count;
          const on = !k.layers.find((l) => l.id === c.id)?.hidden;
          return `<button type="button" class="chip ${on ? 'on' : ''}" data-act="eye" data-id="${esc(c.id)}" title="${esc(c.label)} ${on ? 'ausblenden' : 'einblenden'}" aria-pressed="${on}" aria-label="${esc(c.label)}">${ico(c.icon)}<span class="lb">${esc(c.label)}</span>${n != null ? `<span class="n" data-n="${esc(c.id)}">${n.toLocaleString('de-DE')}</span>` : `<span class="n" data-n="${esc(c.id)}"></span>`}</button>`;
        })
        .join('') + '<span class="chip static">live</span>'
    );
  }

  let lastContent = '';
  function renderContent() {
    if (layout === 'portrait') {
      reg('content').innerHTML = lastContent = '';
      return;
    }
    const k = view(cur);
    const { hazard, traffic } = contentOf(k);
    let out = '';
    if (hazard) {
      const evs = host.events(ui.evHours);
      out += `<div class="evcard hud-glass"><div class="h"><b>Ereignisse</b>${evSeg()}</div>
        ${evs.length ? evs.map(evRow).join('') : '<div class="muted evempty">Keine Ereignisse im Zeitraum (oder Daten laden noch).</div>'}</div>`;
    }
    if (!k.main && !k.menu && traffic.length) out += `<div class="trbar hud-glass">${trafficChips(k, traffic)}</div>`;
    // live refreshes come often: only touch the DOM when something changed
    if (out !== lastContent) reg('content').innerHTML = lastContent = out;
  }

  // ----- phone portrait: bottom sheet with three detents ----------------------
  const sheet = createSheet({
    host,
    root,
    ui,
    layout: () => layout,
    get placeNode() {
      return placeNode;
    },
    set placeNode(v) {
      placeNode = v;
    },
    get form() {
      return form;
    },
    set form(v) {
      form = v;
    },
    cur: () => cur,
    view,
    iconList,
    nameEl,
    statusLine,
    contentOf,
    stackBody,
    stackFoot,
    dialogInner,
    galleryInner,
    evSeg,
    trafficChips,
    render,
    reg,
    finePointer,
    addInner,
    mglyph,
  });
  const { renderSheet, detentOf, globeView, closeOverlay, tickerInner, syncSheetH } = sheet;

  // ----- phone landscape: Orbis menu -----------------------------------------
  function renderMenu() {
    const r = reg('menu');
    if (layout !== 'landscape') {
      r.innerHTML = '';
      return;
    }
    r.innerHTML = `<button type="button" class="hud-logo" data-act="menu" aria-label="Menü: Vorhersage, Karte, Weltall" aria-expanded="${ui.menu}"><i></i></button>
      ${ui.menu ? `<div class="hud-menu hud-glass" role="menu"><a role="menuitem" data-act="menuclose" href="#/vorhersage">Vorhersage</a><a role="menuitem" data-act="menuclose" class="on" href="#/karte">Karte</a><a role="menuitem" data-act="menuclose" href="#/weltall">Weltall</a></div>` : ''}`;
  }

  let lastShift = '';
  let lastEdit = false;
  let hadPlace = false;
  function render() {
    layout = calcLayout();
    const gv = globeView();
    if (gv) {
      gv.dataset.layout = layout;
      gv.classList.toggle('hud-edit', ui.edit);
    }
    root.dataset.layout = layout;
    root.classList.toggle('is-edit', ui.edit);
    root.classList.toggle('searching', ui.search);
    document.body.classList.toggle('hud-cover', layout === 'portrait' && detentOf() === 'full');
    if (layout !== 'portrait') placeNode = null;
    if (hadPlace && !placeNode) host.placeClosed();
    hadPlace = !!placeNode;
    renderBasePick();
    renderBar();
    renderModes();
    root.classList.toggle('has-menu', !!reg('modes').firstElementChild);
    renderMenu();
    renderMain();
    renderSheet();
    renderAdd();
    renderGallery();
    renderDialog();
    renderContent();
    // fill live numbers once with the current values (delay of "Blitze Live" is already known)
    refreshLive();
    // the map keeps its centre when the editing stack opens: the stack overlays the map (no shift)
    const s = '0px';
    if (s !== lastShift) {
      lastShift = s;
      (gv ?? root).style.setProperty('--hud-shift', s);
    }
    if (lastEdit !== ui.edit) {
      lastEdit = ui.edit;
      host.layout();
    }
  }

  // 2D/3D: the button flips the camera between top-down and 45°; while tilted a slider sets the angle
  const tiltBtn = root.querySelector<HTMLButtonElement>('.hud-tbtn')!;
  const tiltSl = root.querySelector<HTMLElement>('.hud-tsl')!;
  const tiltIn = tiltSl.querySelector('input')!;
  let tiltOpen = false;
  let tiltDrag = false;
  let tiltClick = 0;
  function showTilt(open: boolean) {
    tiltOpen = open;
    tiltSl.classList.toggle('open', open);
    tiltIn.tabIndex = open ? 0 : -1;
    tiltBtn.textContent = open ? '2D' : '3D';
  }
  // The slider runs 0–100 % of the map's maximum tilt; at 0 it is 2D again.
  const TILT_MAX = 60;
  const toPitch = (v: number) => (v / 100) * TILT_MAX;
  tiltIn.addEventListener('input', () => host.setPitch(toPitch(Number(tiltIn.value)), false));
  tiltIn.addEventListener('change', () => {
    if (Number(tiltIn.value) > 0) return;
    tiltClick = performance.now();
    showTilt(false);
    host.setPitch(0, true);
  });
  tiltIn.addEventListener('pointerdown', () => (tiltDrag = true));
  window.addEventListener('pointerup', () => (tiltDrag = false));
  function syncPitch(p: number) {
    if (!tiltDrag) tiltIn.value = String(Math.round((p / TILT_MAX) * 100));
    if (p > 0.5) showTilt(true);
    else if (!tiltDrag && tiltOpen && performance.now() - tiltClick > 700) showTilt(false);
  }
  function toggleTilt() {
    tiltClick = performance.now();
    showTilt(!tiltOpen);
    if (tiltOpen) tiltIn.value = '75';
    host.setPitch(tiltOpen ? toPitch(75) : 0, true);
  }

  const bp = root.querySelector<HTMLElement>('.hud-bp')!;
  function renderBasePick() {
    const k = view(cur);
    bp.hidden = !ui.basepick;
    root.querySelector('[data-act="basepick"]')?.setAttribute('aria-expanded', String(ui.basepick));
    root.querySelector('[data-act="basepick"]')?.classList.toggle('on', ui.basepick);
    if (!ui.basepick) return;
    bp.innerHTML = BASES.map((b) => `<button type="button" data-act="base" data-id="${b.id}" class="${k.base === b.id ? 'on' : ''}" aria-pressed="${k.base === b.id}"><i class="bth">${baseThumb(b.id)}</i><span>${BASE_LABEL[b.id]}</span></button>`).join('');
  }

  // ----- actions -----------------------------------------------------------
  function go(id: string) {
    if (!allKarten().some((k) => k.id === id)) return;
    // the active Karte toggles the menu below: fold it to the one sub-point line / unfold it
    if (cur === id && view(id).menu) {
      ui.folded = !ui.folded;
      if (ui.folded && (ui.edit || ui.gallery || ui.add)) {
        ui.edit = false;
        ui.gallery = false;
        ui.add = false;
        ui.open = null;
        ui.pick = false;
      }
      return;
    }
    cur = id;
    ui.gallery = false;
    ui.add = false;
    ui.open = null;
    ui.pick = false;
    ui.menu = false;
    ui.rename = false;
    ui.folded = false;
    placeNode = null;
    fresh = new Set();
    persist();
    const k = view(cur);
    host.apply(k);
    if (k.view) host.goTo(k.view);
    render();
    revealActive();
  }

  function captureView(): KView {
    const v = host.view();
    host.placeName(v).then((n) => {
      if (!n) return;
      v.name = n;
      persist();
      render();
    });
    return v;
  }

  function layerOf(id: string) {
    return edit().layers.find((l) => l.id === id);
  }

  const core: HudCore = {
    host,
    root,
    ui,
    st,
    get cur() {
      return cur;
    },
    set cur(v) {
      cur = v;
    },
    get form() {
      return form;
    },
    set form(v) {
      form = v;
    },
    get fresh() {
      return fresh;
    },
    set fresh(v) {
      fresh = v;
    },
    view,
    edit,
    dirty,
    persist,
    afterEdit,
    go,
    setSearch,
    closeOverlay,
    captureView,
    layerOf,
    mainFam,
    nameEl,
    suggestName,
    tmodeOf,
    encodeKarte,
  };
  const ACT = buildActions(core);
  ACT.tilt = toggleTilt;

  root.addEventListener('click', (e) => {
    if (sheet.suppressClick()) {
      e.stopPropagation();
      return;
    }
    if ((e.target as HTMLElement).closest('#hud-rn')) {
      e.stopPropagation();
      return;
    }
    const a = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!a || !root.contains(a)) return;
    const fn = ACT[a.dataset.act!];
    if (!fn) return;
    e.stopPropagation();
    fn(a.dataset.id ?? '', a.dataset.v ?? '', e);
    persist();
    if (a.dataset.act === 'search' || a.dataset.act === 'settings') return;
    if (a.dataset.act === 'edit' || a.dataset.act === 'close') queueMicrotask(() => root.querySelector<HTMLElement>(a.dataset.act === 'edit' ? '.stack .mh' : '.sum')?.focus());
    render();
  });

  // keyboard on role=button / switch rows
  root.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement;
    if ((e.key === 'Enter' || e.key === ' ') && t.matches('[role="button"][data-act], [role="switch"][data-act]')) {
      e.preventDefault();
      t.click();
    } else if (t.id === 'hud-rn' && (e.key === 'Enter' || e.key === 'Escape')) {
      e.preventDefault();
      e.stopPropagation();
      finishRename(e.key === 'Enter');
    } else if (e.key === 'Enter' && t.id === 'hud-nm') {
      ACT.dosave('', '', e);
      render();
    }
  });

  root.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.id === 'hud-aq') {
      ui.q = t.value;
      root.querySelector('.addlst')!.innerHTML = addList();
    } else if (t.id === 'hud-nm' && form) form.name = t.value;
    else if (t.dataset.op) {
      const l = layerOf(t.dataset.op);
      if (!l) return;
      const v = Number(t.value);
      if (v >= 100) delete l.opacity;
      else l.opacity = v;
      const out = t.closest('.op')?.querySelector('[data-opv]');
      if (out) out.textContent = `${v} %`;
      applyLive();
    } else if (t.dataset.vol) {
      const l = layerOf(t.dataset.vol);
      if (!l) return;
      const v = Math.max(0, Math.min(100, Number(t.value) || 0));
      setLightningVol(l, v);
      applyLive();
    }
  });
  /** end the inline rename of an own Karte (Enter / leaving the field saves, Esc cancels) */
  function finishRename(save: boolean) {
    if (!ui.rename) return;
    const inp = root.querySelector<HTMLInputElement>('#hud-rn');
    ui.rename = false;
    const name = inp?.value.trim().slice(0, 40) ?? '';
    const own = st.own.find((k) => k.id === cur);
    if (save && own && name && name !== own.name) {
      own.name = name;
      own.savedAt = Date.now();
      if (st.drafts[cur]) st.drafts[cur].name = name;
      persist();
    }
    render();
    root.querySelector<HTMLElement>('.rn')?.focus();
  }
  root.addEventListener('focusout', (e) => {
    if ((e.target as HTMLElement).id === 'hud-rn') finishRename(true);
  });

  // apply opacity / volume while dragging, finish (dirty marker, persistence) when released
  const applyLive = debounce(() => host.apply(view(cur)), 30);
  root.addEventListener('change', (e) => {
    const d = (e.target as HTMLElement).dataset;
    if (d.op || d.vol) afterEdit();
  });

  // --- reorder by dragging the grip (pointer events: mouse, pen and touch alike)
  let reorder: { id: string; pid: number; target: HTMLElement | null; after: boolean } | null = null;
  const clearDrop = () => root.querySelectorAll('.lyr.drag, .lyr.dropb, .lyr.dropa').forEach((x) => x.classList.remove('drag', 'dropb', 'dropa'));
  root.addEventListener('pointerdown', (e) => {
    const g = (e.target as HTMLElement).closest<HTMLElement>('[data-grip]');
    const row = g?.closest<HTMLElement>('.lyr');
    if (!g || !row || e.button > 0) return;
    e.preventDefault();
    reorder = { id: row.dataset.lid!, pid: e.pointerId, target: null, after: false };
    g.setPointerCapture(e.pointerId);
    row.classList.add('drag');
  });
  root.addEventListener('pointermove', (e) => {
    if (!reorder || e.pointerId !== reorder.pid) return;
    const rows = [...root.querySelectorAll<HTMLElement>('.lyr')].filter((r) => r.dataset.lid !== reorder!.id);
    root.querySelectorAll('.lyr.dropb, .lyr.dropa').forEach((x) => x.classList.remove('dropb', 'dropa'));
    reorder.target = null;
    for (const r of rows) {
      const b = r.getBoundingClientRect();
      if (e.clientY < b.top - 4 || e.clientY > b.bottom + 4) continue;
      reorder.target = r;
      reorder.after = e.clientY >= b.top + b.height / 2;
      r.classList.add(reorder.after ? 'dropa' : 'dropb');
      break;
    }
  });
  const endReorder = (e: PointerEvent) => {
    if (!reorder || e.pointerId !== reorder.pid) return;
    const { id, target, after } = reorder;
    reorder = null;
    clearDrop();
    if (!target || e.type === 'pointercancel') return;
    const d = edit();
    const moving = d.layers.find((l) => l.id === id);
    if (!moving) return;
    d.layers = d.layers.filter((l) => l.id !== id);
    const to = d.layers.findIndex((l) => l.id === target.dataset.lid);
    d.layers.splice(to + (after ? 1 : 0), 0, moving);
    afterEdit();
  };
  root.addEventListener('pointerup', endReorder);
  root.addEventListener('pointercancel', endReorder);
  // keyboard: Alt + arrow up/down on a layer row moves it
  root.addEventListener('keydown', (e) => {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    const row = (e.target as HTMLElement).closest<HTMLElement>('.lyr');
    if (!row) return;
    e.preventDefault();
    const d = edit();
    const i = d.layers.findIndex((l) => l.id === row.dataset.lid);
    const j = i + (e.key === 'ArrowUp' ? -1 : 1);
    if (i < 0 || j < 0 || j >= d.layers.length) return;
    [d.layers[i], d.layers[j]] = [d.layers[j], d.layers[i]];
    afterEdit();
    root.querySelector<HTMLElement>(`.lyr[data-lid="${CSS.escape(row.dataset.lid!)}"] [data-act="eye"]`)?.focus();
  });

  // ----- search ------------------------------------------------------------
  const searchEl = createSearch((p) => {
    setSearch(false);
    host.onPlace(p);
  }, 'Ort suchen und hinfliegen …');
  searchEl.classList.add('hud-search');
  sx.appendChild(searchEl);
  const sInput = searchEl.querySelector('input')!;
  function setSearch(on: boolean) {
    if (on === ui.search) return;
    ui.search = on;
    sx.classList.toggle('open', on);
    root.classList.toggle('searching', on);
    // phones close the search with the "Abbrechen" text button, the magnifier stays
    sxBtn.innerHTML = ico(on && !phone() ? 'x' : 'search');
    sxBtn.setAttribute('aria-label', on ? 'Suche schließen' : 'Suchen');
    globeView()?.classList.toggle('hud-searching', on);
    if (on) {
      ui.gallery = false;
      renderGallery();
      renderBar();
      window.setTimeout(() => sInput.focus(), 30);
    } else {
      sInput.value = '';
      sInput.blur();
    }
  }
  sInput.addEventListener('blur', () => window.setTimeout(() => !sInput.value && !sx.contains(document.activeElement) && setSearch(false), 200));
  sx.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      setSearch(false);
    }
  });

  // ----- global keys & outside clicks --------------------------------------
  const visible = () => root.isConnected && !root.closest('[hidden]');
  document.addEventListener('keydown', (e) => {
    if (!visible() || e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target as HTMLElement;
    const typing = t.matches('input, textarea, select, [contenteditable]') || !!t.closest('dialog[open]');
    if (e.key === 'Escape') {
      if (ui.save) ACT.cancel('', '', e);
      else if (ui.gallery) ui.gallery = false;
      else if (ui.add) ui.add = false;
      else return;
      render();
      return;
    }
    if (typing) return;
    if (e.key === '/') {
      e.preventDefault();
      setSearch(true);
    } else if (/^[1-5]$/.test(e.key)) {
      const k = pins()[Number(e.key) - 1];
      if (k) go(k.id);
    }
  });
  document.addEventListener('click', (e) => {
    if (!visible()) return;
    const t = e.target as HTMLElement;
    let changed = false;
    if (ui.basepick && !t.closest('.hud-bp, [data-act="basepick"]')) (ui.basepick = false), (changed = true);
    if (ui.menu && !t.closest('.hud-menu, [data-act="menu"]')) (ui.menu = false), (changed = true);
    if (root.contains(t) && t.closest('.hud-sheet, .gallery, .addpop, [data-act="gallery"], [data-act="add"], .scrim, .dlg')) {
      if (changed) render();
      return;
    }
    if (ui.gallery && !t.closest('.gallery, [data-act="gallery"]')) (ui.gallery = false), (changed = true);
    if (ui.add && !t.closest('.addpop, [data-act="add"]')) (ui.add = false), (changed = true);
    if (changed) render();
  });

  // ----- sharing -----------------------------------------------------------
  function encodeKarte(k: Karte): string {
    const o: Partial<Karte> = clone(k);
    delete o.id;
    delete o.std;
    delete o.savedAt;
    const json = JSON.stringify(o);
    return btoa(String.fromCharCode(...new TextEncoder().encode(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  let lastShared = '';
  function importShared(code: string | null) {
    if (!code || code === lastShared) return;
    lastShared = code;
    try {
      const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
      const raw = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))) as Partial<Karte>;
      const k = sanitizeKarte({ ...raw, id: newId(), savedAt: Date.now() });
      if (!k) throw new Error('invalid');
      delete k.std;
      if (!k.name || k.name === 'Karte') k.name = 'Geteilte Karte';
      const fam = host.families().find((f) => f.id === k.main);
      if (!fam) {
        k.main = null;
        delete k.mainVar;
      } else if (!fam.variants.some(([v]) => v === k.mainVar)) k.mainVar = fam.variants[0][0];
      st.own.push(k);
      history.replaceState(null, '', `${location.pathname}${location.search}#/karte`);
      go(k.id);
      toast(`Geteilte Karte „${k.name}“ geöffnet. Sie ist unter „Meine Karten“ gespeichert.`);
    } catch {
      toast('Der Link enthält keine gültige Karte.', 'error');
    }
  }

  // ----- live updates ------------------------------------------------------
  function refreshLive() {
    const k = view(cur);
    root.querySelectorAll<HTMLElement>('[data-sub]').forEach((s) => {
      const l = k.layers.find((x) => x.id === s.dataset.sub);
      const c = catalogOf(s.dataset.sub!);
      if (!l || !c) return;
      const info = host.info(l.id);
      s.textContent = [info.sub || c.hint, filterText(l)].filter(Boolean).join(' · ');
    });
    root.querySelectorAll<HTMLElement>('[data-n]').forEach((s) => {
      const n = host.info(s.dataset.n!).count;
      s.textContent = n != null ? n.toLocaleString('de-DE') : '';
    });
    // delay of a live feed in seconds ("Blitze Live" beside its menu row)
    root.querySelectorAll<HTMLElement>('[data-d]').forEach((s) => {
      const d = host.info(s.dataset.d!).delay;
      s.textContent = d != null ? `~${fmt.num(d, 1)} s` : '';
    });
    if (root.querySelector('.evcard')) renderContent();
    if (layout === 'portrait' && !sheet.dragging() && !sheet.el()?.style.height) syncSheetH();
    const tk = layout === 'portrait' ? sheet.el()?.querySelector('.ticker') : null;
    if (tk) {
      const html = tickerInner();
      if (tk.innerHTML !== html) {
        tk.innerHTML = html;
        syncSheetH();
      }
    }
  }

  function relayout() {
    render();
    host.layout();
  }
  mqLand.addEventListener('change', relayout);
  mqPort.addEventListener('change', relayout);
  window.addEventListener('resize', () => {
    host.layout();
    if (!sheet.dragging() && !sheet.el()?.style.height) syncSheetH();
  });
  render();

  return {
    el: root,
    current: () => view(cur),
    refreshLive,
    stackWidth: () => 0, // the editing stack overlays the map: keep the map centred when it opens
    importShared,
    layout: () => layout,
    relayout,
    showPlace(node) {
      placeNode = node;
      ui.edit = false;
      closeOverlay();
      render();
    },
    clearPlace() {
      placeNode = null;
      render();
    },
    syncPitch,
    setBearing(deg) {
      root.style.setProperty('--hud-bearing', `${-deg}deg`);
      const heading = ['N', 'O', 'S', 'W'][Math.round((((deg % 360) + 360) % 360) / 90) % 4];
      const t = root.querySelector<SVGTextElement>('.hud-compass .hd');
      if (t && t.dataset.h !== heading) {
        // fade the old letter out, swap, fade the new one in
        t.dataset.h = heading;
        t.style.opacity = '0';
        window.setTimeout(() => {
          t.textContent = t.dataset.h!;
          t.style.opacity = '1';
        }, 120);
      }
    },
    placeOpen: () => !!placeNode && layout === 'portrait',
    syncSheet: () => {
      if (!sheet.dragging() && !sheet.el()?.style.height) syncSheetH();
    },
  };
}
