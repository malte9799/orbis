import { searchPlaces } from '../api/openmeteo';
import { debounce, escapeHtml } from '../util';
import { clockTxt } from '../units';
import type { Place } from '../store';
import { distance, duration } from './format';
import { maneuverSvg, profileSvg } from './icons';
import { PROFILES, type LngLat, type Maneuver, type Profile, type Route, type RoutingProvider } from './types';

// The DOM of the route planner and of the guidance. Pure view: all decisions are made in ./index.ts.

export interface Stop {
  /** [lon, lat]; null = "my position" (resolved when the route is planned) or not set yet */
  pos: LngLat | null;
  label: string;
  /** "Mein Standort" */
  here?: boolean;
}

export interface PanelHooks {
  /** the plan changed and a route should be calculated again */
  plan(): void;
  /** the user wants to pick this stop on the map (index into stops) */
  pick(i: number): void;
  close(): void;
  start(): void;
  chooseRoute(i: number): void;
  setProfile(p: Profile): void;
  setProvider(id: string): void;
  /** stop was changed by the user */
  stopChanged(): void;
  stopNavigation(): void;
  recentre(): void;
  toggleVoice(): boolean;
  /** share of the route the panel may cover etc. – none */
}

const ICON_SWAP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 5v14M8 5 4.5 8.5M8 5l3.5 3.5M16 19V5M16 19l-3.5-3.5M16 19l3.5-3.5"/></svg>';
const ICON_PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
const ICON_PIN_END = '<svg viewBox="0 0 24 34" aria-hidden="true"><path d="M12 1C6 1 1.5 5.6 1.5 11.5 1.5 19.5 12 33 12 33s10.5-13.5 10.5-21.5C22.5 5.6 18 1 12 1z" fill="#ea4335"/><circle cx="12" cy="11.5" r="4" fill="#fff"/></svg>';
const ICON_X = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>';

export class RoutePanel {
  readonly el: HTMLElement;
  stops: Stop[] = [
    { pos: null, label: 'Mein Standort', here: true },
    { pos: null, label: '' },
  ];
  private plan: HTMLElement;
  private guide: HTMLElement;
  private result: HTMLElement;
  private stopList: HTMLElement;
  private routes: Route[] = [];
  private active = 0;
  private providers: RoutingProvider[] = [];

  constructor(private hooks: PanelHooks) {
    this.el = document.createElement('div');
    this.el.className = 'rt';
    this.el.hidden = true;
    this.el.innerHTML = `
      <section class="rt-plan" aria-label="Routenplanung">
        <div class="rt-grab" aria-hidden="true"></div>
        <header class="rt-head">
          <div class="rt-prof" role="radiogroup" aria-label="Fortbewegung">${PROFILES.map((p) => `<button type="button" role="radio" data-p="${p.id}" aria-checked="false" title="${p.label}" aria-label="${p.label}">${profileSvg(p.id)}</button>`).join('')}</div>
          <button type="button" class="rt-x" data-a="close" aria-label="Schließen">${ICON_X}</button>
        </header>
        <div class="rt-body">
          <div class="rt-stops"></div>
          <button type="button" class="rt-swap" data-a="swap" title="Start und Ziel tauschen" aria-label="Start und Ziel tauschen">${ICON_SWAP}</button>
        </div>
        <button type="button" class="rt-link" data-a="addvia">+ Zwischenstopp hinzufügen</button>
        <div class="rt-result" aria-live="polite"></div>
        <details class="rt-opt">
          <summary>Routing-Dienst</summary>
          <select data-a="provider" aria-label="Routing-Dienst"></select>
          <div class="rt-note"></div>
        </details>
      </section>
      <section class="rt-guide" hidden aria-label="Navigation"></section>`;
    this.plan = this.el.querySelector('.rt-plan')!;
    this.guide = this.el.querySelector('.rt-guide')!;
    this.result = this.el.querySelector('.rt-result')!;
    this.stopList = this.el.querySelector('.rt-stops')!;
    this.renderStops();

    this.el.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-a],[data-p],[data-r],[data-pick],[data-rm]');
      if (!t) return;
      const a = t.dataset.a;
      if (t.dataset.p) {
        this.setProfile(t.dataset.p as Profile);
        hooks.setProfile(t.dataset.p as Profile);
      } else if (t.dataset.r != null) hooks.chooseRoute(Number(t.dataset.r));
      else if (t.dataset.pick != null) hooks.pick(Number(t.dataset.pick));
      else if (t.dataset.rm != null) {
        this.stops.splice(Number(t.dataset.rm), 1);
        this.renderStops();
        hooks.stopChanged();
      } else if (a === 'close') hooks.close();
      else if (a === 'swap') {
        this.stops.reverse();
        this.renderStops();
        hooks.stopChanged();
      } else if (a === 'addvia' && this.stops.length < 5) {
        this.stops.splice(this.stops.length - 1, 0, { pos: null, label: '' });
        this.renderStops();
      } else if (a === 'start') hooks.start();
      else if (a === 'stopnav') hooks.stopNavigation();
      else if (a === 'recentre') hooks.recentre();
      else if (a === 'voice') t.classList.toggle('on', hooks.toggleVoice());
      else if (a === 'steps') this.result.querySelector('.rt-steps')?.toggleAttribute('hidden');
    });
    this.el.querySelector<HTMLSelectElement>('[data-a=provider]')!.addEventListener('change', (e) => hooks.setProvider((e.target as HTMLSelectElement).value));
  }

  // ----- stops --------------------------------------------------------------
  renderStops() {
    const n = this.stops.length;
    this.stopList.innerHTML = this.stops
      .map((s, i) => {
        const role = i === 0 ? 'Start' : i === n - 1 ? 'Ziel' : 'Stopp';
        return `<div class="rt-stop" data-i="${i}">
          <span class="rt-dot ${i === 0 ? 'start' : i === n - 1 ? 'end' : 'via'}" aria-hidden="true">${i === n - 1 ? ICON_PIN_END : ''}</span>
          <div class="rt-field">
            <input type="text" value="${escapeHtml(s.label)}" placeholder="${role} suchen …" aria-label="${role}" autocomplete="off" spellcheck="false" data-i="${i}"/>
            <ul class="rt-sug" hidden></ul>
          </div>
          <button type="button" class="rt-ib" data-pick="${i}" title="Auf der Karte wählen" aria-label="${role} auf der Karte wählen">${ICON_PIN}</button>
          ${i > 0 && i < n - 1 ? `<button type="button" class="rt-ib" data-rm="${i}" title="Entfernen" aria-label="Stopp entfernen">${ICON_X}</button>` : ''}
        </div>`;
      })
      .join('');
    for (const input of this.stopList.querySelectorAll<HTMLInputElement>('input')) this.bindField(input);
  }

  private bindField(input: HTMLInputElement) {
    const i = Number(input.dataset.i);
    const ul = input.nextElementSibling as HTMLUListElement;
    let results: Place[] = [];
    let seq = 0;
    const hide = () => (ul.hidden = true);
    const run = debounce(async (q: string) => {
      const my = ++seq;
      try {
        const r = await searchPlaces(q);
        if (my !== seq) return;
        results = r;
        ul.innerHTML = r.length
          ? r.map((p, k) => `<li data-k="${k}"><span>${escapeHtml(p.name)}</span><small>${escapeHtml([p.region, p.country].filter(Boolean).join(', '))}</small></li>`).join('')
          : '<li class="empty">Keine Treffer</li>';
        ul.hidden = false;
      } catch {
        ul.innerHTML = '<li class="empty">Suche nicht verfügbar</li>';
        ul.hidden = false;
      }
    }, 250);
    input.addEventListener('focus', () => {
      // "Mein Standort" is a value, not text to edit: select it to type over it
      if (this.stops[i]?.here) input.select();
    });
    input.addEventListener('input', () => {
      const s = this.stops[i];
      s.pos = null;
      s.here = false;
      s.label = input.value;
      const q = input.value.trim();
      if (q.length < 2) {
        seq++;
        hide();
      } else run(q);
    });
    ul.addEventListener('pointerdown', (e) => {
      const li = (e.target as HTMLElement).closest<HTMLElement>('li[data-k]');
      if (!li) return;
      e.preventDefault();
      const p = results[Number(li.dataset.k)];
      this.setStop(i, [p.lon, p.lat], [p.name, p.region].filter(Boolean).join(', '));
      hide();
      this.hooks.stopChanged();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && results[0] && !ul.hidden) {
        e.preventDefault();
        this.setStop(i, [results[0].lon, results[0].lat], [results[0].name, results[0].region].filter(Boolean).join(', '));
        hide();
        this.hooks.stopChanged();
      } else if (e.key === 'Escape') hide();
    });
    input.addEventListener('blur', () => setTimeout(hide, 150));
  }

  setStop(i: number, pos: LngLat, label: string) {
    const s = this.stops[i];
    if (!s) return;
    s.pos = pos;
    s.label = label;
    s.here = false;
    const input = this.stopList.querySelector<HTMLInputElement>(`input[data-i="${i}"]`);
    if (input) input.value = label;
  }

  // ----- plan -----------------------------------------------------------------
  setProfile(p: Profile) {
    for (const b of this.el.querySelectorAll<HTMLElement>('[data-p]')) b.setAttribute('aria-checked', String(b.dataset.p === p));
  }

  setProviders(list: RoutingProvider[], all: RoutingProvider[], selected: string, profile: Profile) {
    this.providers = list;
    const sel = this.el.querySelector<HTMLSelectElement>('[data-a=provider]')!;
    sel.innerHTML = all
      .map((p) => {
        const ok = list.includes(p);
        return `<option value="${p.id}" ${p.id === selected ? 'selected' : ''} ${ok ? '' : 'disabled'}>${escapeHtml(p.label)}${ok ? '' : p.key ? ' – Schlüssel nötig' : !p.profiles.includes(profile) ? ' – nicht für diese Fortbewegung' : ''}</option>`;
      })
      .join('');
    this.el.querySelector('.rt-note')!.textContent = all.find((p) => p.id === selected)?.note ?? '';
  }

  busy(text: string) {
    this.result.innerHTML = `<div class="rt-msg"><span class="rt-spin" aria-hidden="true"></span>${escapeHtml(text)}</div>`;
  }

  error(text: string) {
    this.result.innerHTML = `<div class="rt-msg err">${escapeHtml(text)}</div>`;
  }

  hint(text: string) {
    this.result.innerHTML = text ? `<div class="rt-msg">${escapeHtml(text)}</div>` : '';
  }

  showRoutes(routes: Route[], active: number, provider: RoutingProvider, fallbackNote?: string) {
    this.routes = routes;
    this.active = active;
    const r = routes[active];
    const eta = (x: Route) => escapeHtml(clockTxt(new Date(Date.now() + x.duration * 1000)));
    this.result.innerHTML = `
      ${fallbackNote ? `<div class="rt-msg">${escapeHtml(fallbackNote)}</div>` : ''}
      <div class="rt-alts" role="radiogroup" aria-label="Routen">${routes
        .map(
          (a, i) => `<button type="button" class="rt-alt ${i === active ? 'on' : ''}" role="radio" aria-checked="${i === active}" data-r="${i}">
            <span class="rt-time">${duration(a.duration)}</span>
            <span class="rt-meta">${distance(a.distance)} · Ankunft ${eta(a)}</span>
            <span class="rt-via">${i === 0 ? 'Schnellste Route' : 'Alternative'}${a.summary ? ` · über ${escapeHtml(a.summary)}` : ''}</span></button>`,
        )
        .join('')}</div>
      <div class="rt-row"><button type="button" class="rt-go" data-a="start"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11 21 3l-8 18-2-8z" fill="currentColor"/></svg>Start</button><button type="button" class="rt-pill" data-a="steps">Schritte</button></div>
      <div class="rt-src">${escapeHtml(provider.label)}</div>
      <ol class="rt-steps" hidden>${r.steps.map((s) => `<li><span class="rt-arr">${maneuverSvg(s.maneuver, 26)}</span><span class="rt-txt">${escapeHtml(s.text)}</span><small>${s.distance ? distance(s.distance) : ''}</small></li>`).join('')}</ol>`;
  }

  clearResult() {
    this.routes = [];
    this.result.innerHTML = '';
  }

  get chosen() {
    return this.routes[this.active];
  }

  // ----- guidance ----------------------------------------------------------------
  /** switch between the planner and the guidance view */
  setMode(mode: 'plan' | 'guide') {
    this.plan.hidden = mode !== 'plan';
    this.guide.hidden = mode !== 'guide';
    this.el.classList.toggle('guiding', mode === 'guide');
    if (mode === 'guide') {
      this.guide.innerHTML = `
        <div class="rt-top">
          <div class="rt-banner" aria-live="polite">
            <span class="rt-big" data-g="arrow"></span>
            <div class="rt-bt"><b data-g="dist"></b><span data-g="text"></span></div>
          </div>
          <div class="rt-then" data-g="then"></div>
        </div>
        <div class="rt-fabs">
          <div class="rt-speed" aria-label="Tempo"><b data-g="speed">–</b></div>
          <button type="button" class="rt-recentre" data-a="recentre" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11 21 3l-8 18-2-8z" fill="currentColor"/></svg>Zentrieren</button>
          <button type="button" class="rt-circ rt-mute" data-a="voice" title="Sprachansagen" aria-label="Sprachansagen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg></button>
        </div>
        <div class="rt-sheet">
          <button type="button" class="rt-circ rt-end" data-a="stopnav" title="Navigation beenden" aria-label="Navigation beenden">${ICON_X}</button>
          <div class="rt-eta"><b data-g="time">–</b><span><span data-g="rest">–</span> · <span data-g="eta">–</span></span></div>
        </div>`;
    }
  }

  guideArrow(m: Maneuver) {
    const e = this.guide.querySelector<HTMLElement>('[data-g=arrow]');
    if (e && e.dataset.m !== m) {
      e.dataset.m = m;
      e.innerHTML = maneuverSvg(m, 56);
    }
  }

  guideSet(key: string, text: string) {
    const e = this.guide.querySelector<HTMLElement>(`[data-g=${key}]`);
    if (e && e.textContent !== text) e.textContent = text;
  }

  guideRecentre(show: boolean) {
    const b = this.guide.querySelector<HTMLElement>('.rt-recentre');
    if (b) b.hidden = !show;
  }

  guideStatus(text: string) {
    this.guide.classList.toggle('lost', !!text);
    if (text) this.guideSet('then', text);
  }

  get providersList() {
    return this.providers;
  }
}
