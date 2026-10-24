import type { EventKind } from '../api/events';
import { glyphSvg } from '../globe/icons';
import { BASES, type BaseId } from '../globe/style';
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
  ISOBAR_OPTION_MAINS,
  MAIN_BASES,
  TRAFFIC_LAYER_IDS,
  TRAFFIC_MENU,
  trafficCatOf,
  WIND_OPTION_MAINS,
  WX_MENU,
  type CatalogEntry,
  type WxMenuItem,
  type WxFamily,
} from './catalog';
import { ico } from './icons';
import { blankKarte, clone, DEFAULT_PINNED, fullSignature, loadKarten, MAX_PINNED, newId, sanitizeKarte, saveKarten, signature, STANDARD, type Karte, type KLayer, type KView } from './karten';

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
  placeOpen(): boolean;
  /** phone portrait: content inside the sheet changed size (legend / timeline shown or hidden) */
  syncSheet(): void;
}

// ---------------------------------------------------------------------------

const FILTERS: Record<string, { multi?: boolean; options: [string, string][]; none: string }> = {
  quakes: { options: [['', 'Alle'], ['4', 'ab M 4'], ['5', 'ab M 5'], ['6', 'ab M 6']], none: '' },
  aircraft: {
    multi: true,
    options: [['plane', 'Flugzeuge'], ['heli', 'Hubschrauber'], ['glider', 'Segelflug'], ['drone', 'Drohnen'], ['balloon', 'Ballone']],
    none: '',
  },
  // Unteroptionen von "Blitze Live": Ton bei jedem Einschlag, schrumpfender Kreis, Detektoren und Linien
  lightning: {
    multi: true,
    options: [['sound', 'Ton'], ['wave', 'Einschlagskreis'], ['detectors', 'Detektoren'], ['lines', 'Detektor-Linien']],
    none: '',
  },
};
const filterText = (l: KLayer): string => {
  const f = FILTERS[l.id];
  if (!f || !l.filter) return '';
  return f.options.filter(([v]) => (f.multi ? l.filter!.split(',').includes(v) : v === l.filter) && v).map(([, t]) => t).join(', ');
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

export function createHud(host: HudHost): Hud {
  const st = loadKarten();
  let cur = st.last;
  const ui = { edit: false, add: false, gallery: false, save: false, pick: false, open: null as string | null, q: '', moreBases: false, evHours: 24, search: false, menu: false, rename: false };
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

  /** the glyph-square icons of a Karte: weather main first, then its layers */
  function iconList(k: Karte, max: number): { html: string; more: number } {
    const parts: string[] = [];
    const f = mainFam(k);
    if (f) parts.push(`<span class="main" style="background:${f.color}" title="${esc(f.label)}">${ico(f.icon, 2)}</span>`);
    k.layers.slice(0, max).forEach((l) => {
      const c = catalogOf(l.id);
      if (c) parts.push(`<span class="${l.hidden ? 'off' : ''}" style="background:${c.color}" title="${esc(c.label)}">${ico(c.icon, 2)}</span>`);
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
          return `<button type="button" role="tab" aria-selected="${k.id === cur}" data-act="go" data-id="${esc(k.id)}" class="${k.id === cur ? 'on' : ''}" style="--mc:${esc(k.color)}" title="${esc(k.name)}">
            <span class="mi">${ico(k.icon, 2)}</span><span class="nm">${esc(k.name)}</span><kbd>${i + 1}</kbd>${dirty(k.id) ? '<i class="dd" title="Ungespeicherte Änderungen"></i>' : ''}</button>`;
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
   * and options); the traffic Karte switches car, train, plane and ship.
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
      // option chips of "Blitze Live" as a further indented list inside the Gewitter rows
      const bolt = k.layers.find((x) => x.id === 'lightning');
      const boltOn = !!bolt && !bolt.hidden;
      const boltChips = (
        [
          ['sound', 'Ton'],
          ['wave', 'Kreis'],
          ['detectors', 'Detektoren'],
          ['lines', 'Linien'],
        ] as [string, string][]
      )
        .map(([v, label]) => {
          const o = (bolt?.filter ?? '').split(',').includes(v);
          return `<button type="button" class="tgl ${o ? 'on' : ''}" data-act="filter" data-id="lightning" data-v="${v}" aria-pressed="${o}">${label}</button>`;
        })
        .join('');
      const subs = (it: WxMenuItem): string => {
        const rows = it.subs.filter((x) => x.label).map((x) => `<button type="button" data-act="wxsub" data-id="${esc(it.id)}" data-v="${it.subs.indexOf(x)}" class="${isOn(x) ? 'on' : ''}" aria-pressed="${isOn(x)}">${esc(x.label)}</button>`);
        if (f && WIND_OPTION_MAINS.includes(f.id)) rows.push(`<button type="button" class="tgl ${k.wind !== false ? 'on' : ''}" data-act="wopt" data-v="wind" aria-pressed="${k.wind !== false}">Windpartikel</button>`);
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
    const cur = tmodeOf(k);
    const have = (id: string) => k.layers.some((l) => l.id === id && !l.hidden);
    const toggle = (label: string, layers: string[]) => {
      const on = layers.every(have);
      const n = on ? host.info(layers[0]).count : null;
      return `<button type="button" class="tgl ${on ? 'on' : ''}" data-act="ttog" data-id="${esc(layers.join(','))}" aria-pressed="${on}"><span>${esc(label)}</span><em class="n" data-n="${esc(layers[0])}">${n != null ? n.toLocaleString('de-DE') : ''}</em></button>`;
    };
    return `<div class="wxm hud-glass" role="group" aria-label="Verkehrsmittel"><div class="mrow cats">${TRAFFIC_MENU.map((c) => {
      const on = c.id === cur;
      return `<button type="button" data-act="tcat" data-id="${esc(c.id)}" class="${on ? 'on' : ''}" aria-pressed="${on}" style="--lc:#ffb547"><i>${ico(c.icon, 2)}</i><span>${esc(c.label)}</span></button>${on ? `<div class="subs">${c.rows.map((r) => toggle(r.label, r.layers)).join('')}</div>` : ''}`;
    }).join('')}</div></div>`;
  }
  /** the chosen traffic category (Karten saved before the menu: the one their layers belong to) */
  function tmodeOf(k: Karte): string {
    return k.tmode ?? trafficCatOf(k.layers.find((l) => TRAFFIC_LAYER_IDS.has(l.id))?.id ?? '')?.id ?? '';
  }
  function renderModes() {
    const r = reg('modes');
    // beside the editing stack the weather controls of the stack take over
    if (!view(cur).menu || (ui.edit && layout !== 'portrait')) {
      r.innerHTML = '';
      return;
    }
    const left = r.querySelector('.wxm')?.scrollTop ?? 0;
    r.innerHTML = modesInner(view(cur));
    const m = r.querySelector('.wxm');
    if (m) m.scrollTop = left;
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

  const dirtyBar = (k: Karte) =>
    `<div class="dbar"><span><i></i>Geändert</span><button type="button" class="ebtn ghost" data-act="revert">Zurücksetzen</button>${isStd(k) ? '' : '<button type="button" class="ebtn" data-act="overwrite">Speichern</button>'}<button type="button" class="ebtn pri" data-act="saveas">Als neue Karte</button></div>`;

  const placeText = (v: KView) => `${v.name ?? fmt.coords(v.center[1], v.center[0])} · Zoom ${Math.round(v.zoom)}`;

  function summary(k: Karte) {
    const { html, more } = iconList(k, 7);
    return `<div class="sum hud-glass" data-act="edit" role="button" tabindex="0" aria-expanded="false" aria-label="${esc(k.name)}: Ebenen aufklappen">
      <div class="row1">${mglyph(k, 30)}<div class="tx"><b>${esc(k.name)}</b><small>${esc(statusLine(k))}</small></div><span class="vsep"></span>
        <div class="lic">${html}${more ? `<span class="more">+${more}</span>` : ''}</div><span class="chevi" aria-hidden="true">${ico('chevd', 2.2)}</span></div>
      ${k.view ? `<div class="placechip">${ico('pin')}${esc(placeText(k.view))}</div>` : ''}
      ${dirty(k.id) ? dirtyBar(k) : ''}
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
    if (WIND_OPTION_MAINS.includes(f.id)) opts.push(`<button type="button" class="chip ${k.wind !== false ? 'on' : ''}" data-act="wopt" data-v="wind">Windpartikel</button>`);
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
        <div class="opt" data-act="tog" data-v="night" role="switch" aria-checked="${k.night}" tabindex="0">${ico('sun')}<div>Tag/Nacht</div><span class="toggle ${k.night ? 'on' : ''}"></span></div>
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
      const title = ui.save ? 'Als neue Karte speichern' : ui.gallery ? 'Alle Karten' : 'Ebene hinzufügen';
      return `<div class="sh-title"><b>${title}</b><button type="button" class="sh-done" data-act="${ui.save ? 'cancel' : 'sheetdone'}">${ui.save ? 'Abbrechen' : 'Fertig'}</button></div>`;
    }
    const { html, more } = iconList(k, 4);
    return `<div class="kh" data-act="sheettoggle" role="button" tabindex="0" aria-expanded="${d === 'half'}" aria-label="${esc(k.name)}: Ebenen ${d === 'half' ? 'zuklappen' : 'aufklappen'}">${mglyph(k, 32)}
      <div class="tx">${d === 'half' ? nameEl(k) : `<b>${esc(k.name)}</b>`}<small>${esc(statusLine(k))}</small></div>
      <div class="lic">${html}${more ? `<span class="more">+${more}</span>` : ''}</div>
      <span class="cv ${d === 'peek' ? 'up' : ''}" aria-hidden="true">${ico('chevd', 2.2)}</span></div>`;
  }

  /** the newest event, one line (phone sheet, hazard Karten) */
  function tickerInner(): string {
    const e = host.events(ui.evHours)[0];
    return e
      ? `<span class="evg">${glyphSvg(e.kind, e.color, 28)}</span><div><b>${esc(e.title)}</b><small>${esc(e.sub)}</small></div><time>${esc(e.when)}</time>`
      : '<span class="muted">Keine Ereignisse im Zeitraum (oder Daten laden noch).</span>';
  }

  function renderSheet() {
    const r = reg('sheet');
    const gv = globeView();
    if (layout !== 'portrait') {
      r.innerHTML = '';
      sheetEl = null;
      detachDock();
      gv?.style.removeProperty('--sheet-h');
      lastSheetH = -1;
      if (gv) delete gv.dataset.detent;
      return;
    }
    const k = view(cur);
    const d = placeNode ? 'peek' : detentOf();
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
    if (placeNode) {
      header = '';
      body = '<div class="sh-place"></div>';
    } else if (d === 'full') body = ui.save ? `<div class="dlg" role="group" aria-label="Als neue Karte speichern">${dialogInner()}</div>` : ui.gallery ? galleryInner() : addInner();
    else if (d === 'half') {
      body = stackBody(k);
      foot = `<div class="foot">${stackFoot(k)}</div>`;
    } else if (k.main) body = '<div class="sh-dock"></div>';
    else if (hazard) {
      body = `<div class="ticker" aria-live="polite">${tickerInner()}</div>${evSeg()}`;
    } else if (traffic.length && !k.menu) body = `<div class="chipsr">${trafficChips(k, traffic)}</div>`;

    el.innerHTML = `<div class="sh-drag"><div class="grab"></div>${header}</div><div class="sh-body">${body}</div>${foot}`;
    el.dataset.detent = d;
    el.classList.toggle('is-place', !!placeNode);
    el.classList.toggle('is-dialog', ui.save && d === 'full');
    const dockSlot = el.querySelector('.sh-dock');
    if (dockSlot) dockSlot.appendChild(host.dock());
    else detachDock();
    if (placeNode) el.querySelector('.sh-place')!.appendChild(placeNode);
    const sb = el.querySelector('.sh-body');
    if (sb) sb.scrollTop = scroll;
    if (gv) gv.dataset.detent = placeNode ? 'peek' : d;
    if (d === 'full' && ui.add && finePointer()) el.querySelector<HTMLInputElement>('#hud-aq')?.focus();

    // animate from the previous height (also settles a drag that left an inline height)
    const dragged = el.style.height !== '';
    el.style.height = '';
    el.style.transition = 'none';
    const nh = el.offsetHeight;
    if (d === 'peek' && !placeNode) peekH = nh;
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
    if (!sheetEl || layout !== 'portrait') return;
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
      form = null;
    }
  }

  // drag the handle / header between the detents
  root.addEventListener('pointerdown', (e) => {
    const zone = (e.target as HTMLElement).closest('.sh-drag');
    if (!zone || !sheetEl || layout !== 'portrait' || (e.target as HTMLElement).closest('.sh-done, input')) return;
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
    if (placeNode) {
      if (dy > 40) placeNode = null;
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

  // ----- phone landscape: Orbis menu -----------------------------------------
  function renderMenu() {
    const r = reg('menu');
    if (layout !== 'landscape') {
      r.innerHTML = '';
      return;
    }
    r.innerHTML = `<button type="button" class="hud-logo" data-act="menu" aria-label="Menü: Vorhersage, Karte, Weltall" aria-expanded="${ui.menu}"><i></i></button>
      ${ui.menu ? `<div class="hud-menu hud-glass" role="menu"><a role="menuitem" data-act="menuclose" href="#/">Vorhersage</a><a role="menuitem" data-act="menuclose" class="on" href="#/karte">Karte</a><a role="menuitem" data-act="menuclose" href="#/weltall">Weltall</a></div>` : ''}`;
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
    const sw = layout === 'portrait' ? 0 : ui.edit && (layout === 'landscape' || window.innerWidth > 900) ? (layout === 'landscape' ? 316 : 362) : 0;
    const s = `${sw / 2}px`;
    if (s !== lastShift) {
      lastShift = s;
      (gv ?? root).style.setProperty('--hud-shift', s);
    }
    if (lastEdit !== ui.edit) {
      lastEdit = ui.edit;
      host.layout();
    }
  }

  // ----- actions -----------------------------------------------------------
  function go(id: string) {
    if (!allKarten().some((k) => k.id === id)) return;
    cur = id;
    ui.gallery = false;
    ui.add = false;
    ui.open = null;
    ui.pick = false;
    ui.menu = false;
    ui.rename = false;
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

  const ACT: Record<string, (id: string, v: string, ev: Event) => void> = {
    go: (id) => go(id),
    gallery: () => {
      ui.gallery = !ui.gallery;
      setSearch(false);
    },
    edit: () => {
      ui.edit = true;
      ui.gallery = false;
    },
    close: () => {
      ui.rename = false;
      ui.edit = false;
      ui.add = false;
      ui.open = null;
      ui.pick = false;
    },
    eye: (id) => {
      const l = layerOf(id);
      if (!l) return;
      l.hidden = !l.hidden;
      if (!l.hidden) delete l.hidden;
      afterEdit();
    },
    open: (id) => {
      ui.open = ui.open === id ? null : id;
    },
    remove: (id) => {
      const d = edit();
      d.layers = d.layers.filter((l) => l.id !== id);
      ui.open = null;
      afterEdit();
    },
    filter: (id, v) => {
      const l = layerOf(id);
      const f = FILTERS[id];
      if (!l || !f) return;
      if (f.multi) {
        const set = new Set((l.filter ?? '').split(',').filter(Boolean));
        if (set.has(v)) set.delete(v);
        else set.add(v);
        l.filter = f.options.map(([o]) => o).filter((o) => set.has(o)).join(',') || undefined;
      } else l.filter = v || undefined;
      if (!l.filter) delete l.filter;
      afterEdit();
    },
    add: () => {
      ui.add = !ui.add;
      ui.q = '';
    },
    addlayer: (id) => {
      const d = edit();
      if (d.layers.some((l) => l.id === id)) return;
      d.layers.unshift({ id });
      fresh.add(id);
      ui.open = null;
      afterEdit();
      toast(`${catalogOf(id)?.label ?? id} hinzugefügt`);
    },
    pick: () => {
      ui.pick = !ui.pick;
    },
    main: (id) => {
      const d = edit();
      const f = host.families().find((x) => x.id === id);
      d.main = f ? f.id : null;
      if (f) d.mainVar = f.variants[0][0];
      else delete d.mainVar;
      delete d.wind;
      delete d.isobars;
      ui.pick = false;
      afterEdit();
    },
    wxcat: (id) => {
      const it = WX_MENU.find((x) => x.id === id);
      const k0 = view(cur);
      const f = mainFam(k0);
      const curVar = f ? (k0.mainVar ?? f.variants[0][0]) : '';
      const stormFam = !!it?.subs.some((x) => f && x.main === f.id && x.mainVar === curVar);
      const boltOn = k0.layers.some((x) => x.id === 'lightning' && !x.hidden);
      // the active entry again switches it off (also "Blitze Live" inside Gewitter)
      if (!it || stormFam || (id === 'storm' && boltOn)) {
        ACT.main('', '', new Event('click'));
        if (id === 'storm' && boltOn) edit().layers = edit().layers.filter((x) => x.id !== 'lightning');
        afterEdit();
      } else ACT.wxsub(id, '0', new Event('click'));
    },
    wxsub: (id, v) => {
      const it = WX_MENU.find((x) => x.id === id);
      const sub = it?.subs[Number(v)];
      if (!sub || !it) return;
      const d = edit();
      if (sub.main === 'lightning') {
        // "Blitze Live": the extra layer takes over, no weather main layer on the Karte
        d.main = null;
        delete d.mainVar;
        delete d.wind;
        delete d.isobars;
        const l = d.layers.find((x) => x.id === 'lightning');
        if (!l) {
          d.layers.unshift({ id: 'lightning' });
          fresh.add('lightning');
        } else delete l.hidden;
      } else {
        if (d.main !== sub.main) {
          delete d.wind;
          delete d.isobars;
        }
        d.main = sub.main;
        d.mainVar = sub.mainVar;
        // radio: another Gewitter row replaces "Blitze Live"
        d.layers = d.layers.filter((x) => x.id !== 'lightning');
      }
      afterEdit();
    },
    tcat: (id) => {
      const d = edit();
      const on = tmodeOf(d) === id;
      d.layers = d.layers.filter((l) => !TRAFFIC_LAYER_IDS.has(l.id));
      d.tmode = on ? '' : id;
      if (!on) d.layers.unshift(...(TRAFFIC_MENU.find((c) => c.id === id)?.defaults ?? []).map((l) => ({ id: l })));
      afterEdit();
    },
    ttog: (id) => {
      const d = edit();
      const ids = id.split(',');
      // all of a row's layers on → switch them off, otherwise switch the missing ones on
      if (ids.every((x) => d.layers.some((l) => l.id === x))) d.layers = d.layers.filter((l) => !ids.includes(l.id));
      else for (const x of ids) if (!d.layers.some((l) => l.id === x)) d.layers.unshift({ id: x });
      afterEdit();
    },
    var: (_, v) => {
      edit().mainVar = v;
      afterEdit();
    },
    wopt: (_, v) => {
      const d = edit();
      if (v === 'wind') d.wind = d.wind === false ? true : false;
      else d.isobars = !d.isobars;
      if (!d.isobars) delete d.isobars;
      afterEdit();
    },
    base: (id) => {
      edit().base = id as BaseId;
      afterEdit();
    },
    morebases: () => {
      ui.moreBases = true;
    },
    tog: (_, v) => {
      const d = edit();
      if (v === 'labels') d.labels = !d.labels;
      else d.night = !d.night;
      afterEdit();
    },
    viewtog: () => {
      const d = edit();
      if (d.view) delete d.view;
      else d.view = captureView();
      afterEdit();
    },
    revert: () => {
      delete st.drafts[cur];
      ui.open = null;
      fresh = new Set();
      persist();
      host.apply(view(cur));
      const k = view(cur);
      if (k.view) host.goTo(k.view);
    },
    overwrite: () => {
      const d = st.drafts[cur];
      const i = st.own.findIndex((k) => k.id === cur);
      if (!d || i < 0) return;
      st.own[i] = { ...clone(d), savedAt: Date.now() };
      delete st.drafts[cur];
      fresh = new Set();
      persist();
      toast(`„${d.name}“ gespeichert`);
    },
    saveas: () => {
      const k = view(cur);
      form = { name: dirty(cur) ? suggestName(k) : `${k.name} (Kopie)`, icon: k.icon, color: k.color, place: !!k.view, pin: true };
      ui.save = true;
      ui.add = false;
    },
    cancel: () => {
      ui.save = false;
      form = null;
    },
    ficon: (_, v) => {
      if (form) form.icon = v;
    },
    fcol: (_, v) => {
      if (form) form.color = v;
    },
    fplace: () => {
      if (form) form.place = !form.place;
    },
    fpin: () => {
      if (form) form.pin = !form.pin;
    },
    dosave: () => {
      if (!form) return;
      const nameEl = root.querySelector<HTMLInputElement>('#hud-nm');
      if (nameEl) form.name = nameEl.value;
      const d = clone(view(cur));
      const id = newId();
      Object.assign(d, { id, name: form.name.trim() || 'Neue Karte', icon: form.icon, color: form.color, savedAt: Date.now() });
      delete d.std;
      if (form.place) d.view = d.view ?? captureView();
      else delete d.view;
      const wantPin = form.pin && st.pinned.length < MAX_PINNED;
      st.own.push(d);
      if (wantPin) st.pinned.push(id);
      delete st.drafts[cur];
      cur = id;
      ui.save = false;
      ui.open = null;
      fresh = new Set();
      form = null;
      persist();
      host.apply(view(cur));
      toast(`„${d.name}“ gespeichert${wantPin ? ' und angeheftet' : ''}`);
    },
    pin: (id) => {
      if (st.pinned.includes(id)) {
        if (st.pinned.length <= 1) return;
        st.pinned = st.pinned.filter((x) => x !== id);
      } else if (st.pinned.length >= MAX_PINNED) {
        toast('Höchstens 5 Karten in der Leiste. Erst eine lösen.');
        return;
      } else st.pinned.push(id);
      persist();
    },
    del: (id) => {
      const k = st.own.find((x) => x.id === id);
      if (!k || !window.confirm(`Karte „${k.name}“ löschen?`)) return;
      st.own = st.own.filter((x) => x.id !== id);
      st.pinned = st.pinned.filter((x) => x !== id);
      if (!st.pinned.length) st.pinned = [...DEFAULT_PINNED];
      delete st.drafts[id];
      if (cur === id) {
        persist();
        go('wetter');
        return;
      }
      persist();
    },
    blank: () => {
      const k = blankKarte();
      st.own.push(k);
      ui.edit = true;
      ui.add = true;
      ui.q = '';
      go(k.id);
      ui.edit = true;
      ui.add = true;
    },
    evh: (_, v) => {
      ui.evHours = Number(v);
    },
    share: () => {
      const code = encodeKarte(view(cur));
      const url = `${location.origin}${location.pathname}#/karte?k=${code}`;
      navigator.clipboard?.writeText(url).then(
        () => toast('Link zur Karte kopiert'),
        () => toast('Link konnte nicht kopiert werden.', 'error'),
      );
    },
    search: () => setSearch(!ui.search),
    sheettoggle: () => {
      if (ui.edit) {
        ui.edit = false;
        ui.add = false;
        ui.open = null;
        ui.pick = false;
      } else ui.edit = true;
    },
    sheetdone: () => closeOverlay(),
    rename: () => {
      ui.rename = true;
      queueMicrotask(() => {
        const i = root.querySelector<HTMLInputElement>('#hud-rn');
        i?.focus();
        i?.select();
      });
    },
    menu: () => {
      ui.menu = !ui.menu;
    },
    menuclose: () => {
      ui.menu = false;
    },
    settings: () => host.openSettings(),
  };

  root.addEventListener('click', (e) => {
    if (suppressClick) {
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

  // apply opacity while dragging, finish (dirty marker, persistence) when released
  const applyLive = debounce(() => host.apply(view(cur)), 30);
  root.addEventListener('change', (e) => {
    if ((e.target as HTMLElement).dataset.op) afterEdit();
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
    if (root.querySelector('.evcard')) renderContent();
    if (layout === 'portrait' && !drag?.moved && !sheetEl?.style.height) syncSheetH();
    const tk = layout === 'portrait' ? sheetEl?.querySelector('.ticker') : null;
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
    if (!drag?.moved && !sheetEl?.style.height) syncSheetH();
  });
  render();

  return {
    el: root,
    current: () => view(cur),
    refreshLive,
    stackWidth: () => (layout === 'portrait' || !ui.edit ? 0 : (root.querySelector<HTMLElement>('.stack')?.offsetWidth ?? 348) + 14),
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
    placeOpen: () => !!placeNode && layout === 'portrait',
    syncSheet: () => {
      if (!drag?.moved && !sheetEl?.style.height) syncSheetH();
    },
  };
}
