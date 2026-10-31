import type { Map as MlMap } from 'maplibre-gl';
import type { SondeInfo } from './extras';
import { compass, escapeHtml, fmt } from '../util';
import { climbTxt, climbUnit, climbVal, coordsTxt, heightBoth, heightTxt, heightUnit, heightVal, speedTxt, speedUnit, speedVal } from '../units';
import { glyphSvg } from './icons';
import { t } from '../i18n';
import { category, graph, routeHero, tile } from './sidepanel';
import './flightpanel.css';

// Right-hand panel with the live data of the selected radiosonde (SondeHub), same layout as the
// flight and ship panel: telemetry tiles with graphs, receiver details and follow / zoom actions.

export interface SondePanelHooks {
  info(serial: string): SondeInfo | null;
  /** highlight the ascent trail of this sonde (null: none) */
  select(serial: string | null): void;
  fit(serial: string): void;
  map(): MlMap | null;
}

const COLOR = '#ff8fab';

export class SondePanel {
  private root = document.createElement('aside');
  private body: HTMLElement;
  private serial: string | null = null;
  private following = false;
  private refresh: number | undefined;
  private followTimer: number | undefined;
  private open_ = new Set<string>();
  /** tile whose graph is shown (alt, speed, track, vs) */
  private metric: string | null = null;
  private dragHooked = false;
  /** called when the panel opens, so the flight panel can step aside */
  onOpen?: () => void;

  constructor(
    parent: HTMLElement,
    private h: SondePanelHooks,
  ) {
    this.root.className = 'fp';
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="fp-head" style="--c:${COLOR}"><i class="fp-ic">${glyphSvg('sonde', COLOR, 30)}</i><span class="fp-title"></span><button type="button" class="fp-close" aria-label="${t('hud.close')}">×</button></div>
      <div class="fp-sub"></div>
      <div class="fp-body"></div>
      <div class="fp-actions three">
        <button type="button" data-act="route">${t('map.sonde.ascent')}</button>
        <button type="button" data-act="follow">${t('map.fly.follow')}</button>
        <button type="button" data-act="zoom">${t('map.zoomIn')}</button>
      </div>`;
    parent.append(this.root);
    this.body = this.root.querySelector('.fp-body')!;
    this.root.querySelector('.fp-close')!.addEventListener('click', () => this.close());
    this.root.querySelector('.fp-actions')!.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest('button')?.dataset.act;
      if (!act || !this.serial) return;
      if (act === 'route') this.h.fit(this.serial);
      else if (act === 'zoom') this.zoomIn();
      else this.setFollow(!this.following);
    });
    this.body.addEventListener('click', (e) => {
      const m = (e.target as HTMLElement).closest<HTMLElement>('[data-metric]')?.dataset.metric;
      if (!m) return;
      this.metric = this.metric === m ? null : m;
      this.render();
    });
    this.body.addEventListener(
      'toggle',
      (e) => {
        const d = e.target as HTMLDetailsElement;
        const key = d.dataset.key;
        if (key) d.open ? this.open_.add(key) : this.open_.delete(key);
      },
      true,
    );
  }

  open(serial: string) {
    if (serial !== this.serial) this.metric = null;
    this.serial = serial;
    this.root.hidden = false;
    this.onOpen?.();
    this.h.select(serial);
    this.render();
    clearInterval(this.refresh);
    this.refresh = window.setInterval(() => this.render(), 1000);
  }

  close() {
    this.setFollow(false);
    clearInterval(this.refresh);
    if (this.serial) this.h.select(null);
    this.serial = null;
    this.root.hidden = true;
  }

  private zoomIn() {
    const i = this.serial ? this.h.info(this.serial) : null;
    const map = this.h.map();
    if (i && map) map.easeTo({ center: [i.lon, i.lat], zoom: Math.max(map.getZoom(), 12), duration: 700 });
  }

  private setFollow(on: boolean) {
    this.following = on;
    clearInterval(this.followTimer);
    const map = this.h.map();
    if (map && !this.dragHooked) {
      this.dragHooked = true;
      // moving the map by hand ends following
      map.on('dragstart', () => this.following && this.setFollow(false));
    }
    if (on && map && this.serial) {
      const tick = () => {
        const i = this.serial ? this.h.info(this.serial) : null;
        if (i) map.jumpTo({ center: [i.lon, i.lat] });
      };
      tick();
      this.followTimer = window.setInterval(tick, 200);
    }
    this.root.querySelector('[data-act="follow"]')?.classList.toggle('on', on);
  }

  private render() {
    const i = this.serial ? this.h.info(this.serial) : null;
    const title = this.root.querySelector('.fp-title')!;
    const sub = this.root.querySelector('.fp-sub')!;
    if (!i) {
      title.textContent = t('map.sonde.title', { serial: String(this.serial) });
      sub.textContent = '';
      this.body.innerHTML = `<div class="fp-note">${t('map.sonde.nodata')}</div>`;
      return;
    }
    const model = [i.manufacturer, i.type, i.subtype].filter(Boolean).map(escapeHtml).join(' ') || t('map.sonde.fallback');
    title.textContent = t('map.sonde.title', { serial: i.serial });
    sub.innerHTML = `${model} · <b>${i.frequency != null ? `${fmt.num(i.frequency, 3)} MHz` : t('map.sonde.fallback')}</b>`;

    const altM = Math.round(i.altM);
    const vs = i.vsMs ?? 0;
    const rising = vs > 0.5;
    const falling = vs < -0.5;
    const landed = altM < 30 && Math.abs(vs) < 1;
    const status = landed ? t('map.sonde.status.landed') : rising ? t('map.sonde.status.rise') : falling ? t('map.sonde.status.fall') : t('map.sonde.status.float');
    const dt = i.datetime ? new Date(i.datetime).getTime() : 0;
    const age = dt ? Math.max(0, Math.round((Date.now() - dt) / 1000)) : 0;
    const ago = age ? (age < 90 ? t('map.sonde.ago', { a: age }) : age < 5400 ? t('map.ago.min', { a: Math.round(age / 60) }) : t('map.ago.h', { a: Math.round(age / 3600) })) : '';
    const hero = routeHero({
      from: { code: status, sub: landed ? t('map.sonde.groundSub') : t('map.sonde.heightSub', { h: heightTxt(altM) }) },
      to: { code: `${fmt.num(Math.abs(vs), 1)} m/s`, sub: rising ? t('map.sonde.chart.vs') : falling ? t('map.sonde.chart.sink') : t('map.sonde.chart.still') },
      progress: Math.min(1, altM / 38000),
      mark: glyphSvg('sonde', COLOR, 20),
      color: COLOR,
      note: [ago && t('map.sonde.last', { a: ago }), i.track != null && t('map.sonde.courseNote', { deg: Math.round(i.track), dir: compass(i.track) }), i.speedKmh != null && t('map.sonde.driftNote', { s: speedTxt(i.speedKmh) })].filter(Boolean).join(' · '),
    });

    const m = this.metric;
    const tiles = `<div class="sp-tiles">${tile(t('map.tile.alt'), heightTxt(i.altM), { metric: 'alt', on: m === 'alt' })}${tile(t('map.tile.vs'), climbTxt(vs), { metric: 'vs', on: m === 'vs' })}${tile(t('map.tile.drift'), i.speedKmh != null ? speedTxt(i.speedKmh) : '–', { metric: 'speed', on: m === 'speed' })}${tile(t('map.tile.course'), i.track != null ? `${Math.round(i.track)}° ${compass(i.track)}` : '–', { metric: 'track', on: m === 'track' })}</div>`;
    const GRAPHS: Record<string, [string, string]> = { alt: [t('map.metric.alt'), heightUnit()], speed: [t('map.metric.drift'), speedUnit()], track: [t('map.metric.course'), '°'], vs: [t('map.metric.vs'), climbUnit()] };
    const chart = m && GRAPHS[m] ? graph(t('map.graph.title', { m: GRAPHS[m][0] }), (m === 'speed' ? (i.history?.speed ?? []).map(speedVal) : m === 'alt' ? (i.history?.alt ?? []).map(heightVal) : m === 'vs' ? (i.history?.vs ?? []).map(climbVal) : (i.history?.track ?? [])), GRAPHS[m][1], COLOR) : '';

    // everything SondeHub offers about this sonde
    const sondeRows: [string, string][] = [
      [t('map.sonde.rows.type'), model],
      [t('map.sonde.rows.serial'), escapeHtml(i.serial)],
      [t('map.sonde.rows.freq'), i.frequency != null ? `${fmt.num(i.frequency, 3)} MHz` : '–'],
      [t('map.sonde.rows.frame'), i.frame != null ? String(i.frame) : '–'],
    ];
    const posRows: [string, string][] = [
      [t('map.sonde.rows.position'), coordsTxt(i.lat, i.lon)],
      [t('map.sonde.rows.alt'), heightBoth(altM)],
      [t('map.sonde.rows.vertical'), climbTxt(i.vsMs ?? 0)],
      [t('map.sonde.rows.horizontal'), i.speedKmh != null ? speedTxt(i.speedKmh, 1) : '–'],
      [t('map.sonde.rows.time'), escapeHtml(i.datetime ? fmt.dateTime(i.datetime) : '–')],
    ];
    const rxRows: [string, string][] = [
      [t('map.sonde.rows.receiver'), escapeHtml(i.uploader || '–')],
      [t('map.sonde.rows.antenna'), escapeHtml(i.antenna || '–')],
      [t('map.sonde.rows.software'), escapeHtml(i.software || '–')],
      [t('map.sonde.rows.received'), escapeHtml(i.timeReceived ? fmt.dateTime(i.timeReceived) : '–')],
    ];
    const cats =
      category('sonde', t('map.cat.sonde'), sondeRows, this.open_) +
      category('position', t('map.cat.sondePos'), posRows, this.open_) +
      category('receiver', t('map.cat.receiver'), rxRows, this.open_);

    const src = `<details data-key="source" ${this.open_.has('source') ? 'open' : ''}><summary>${t('map.cat.source')}</summary><div class="fp-note">SondeHub (Amateur-Netzwerk) · <a href="${escapeHtml(i.url || `https://sondehub.org/#!q=${encodeURIComponent(i.serial)}`)}" target="_blank" rel="noopener noreferrer">${t('map.sonde.view')}</a></div></details>`;

    this.body.innerHTML = hero + tiles + chart + cats + src;
  }
}
