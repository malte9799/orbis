import type { Map as MlMap } from 'maplibre-gl';
import type { ShipInfo } from './extras';
import { SHIP_COLORS, SHIP_LABELS, shipCat, type ShipCat } from '../api/transport';
import { compass, escapeHtml, fmt } from '../util';
import { speedTxt, speedUnit, speedVal } from '../units';
import { tx } from './layers';
import { glyphSvg } from './icons';
import { t } from '../i18n';
import { category, graph, routeHero, tile } from './sidepanel';
import { fetchShipPhoto, type ShipPhoto } from '../api/ships';
import './flightpanel.css';

// Right-hand panel with the live data of the selected ship (AIS), same layout as the flight panel.

export interface ShipPanelHooks {
  info(mmsi: number): ShipInfo | null;
  map(): MlMap | null;
}

export class ShipPanel {
  private root = document.createElement('aside');
  private body: HTMLElement;
  private photoEl: HTMLElement;
  private contentEl: HTMLElement;
  private mmsi: number | null = null;
  private following = false;
  private refresh: number | undefined;
  private followTimer: number | undefined;
  private open_ = new Set<string>();
  private photo: ShipPhoto | null = null;
  /** category of the currently shown photo, so one fetch serves every ship of that type */
  private photoCat: ShipCat | null = null;
  /** tile whose graph is shown (speed, track) */
  private metric: string | null = null;
  private dragHooked = false;
  /** called when the panel opens, so the flight panel can step aside */
  onOpen?: () => void;

  constructor(
    parent: HTMLElement,
    private h: ShipPanelHooks,
  ) {
    this.root.className = 'fp';
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="fp-head"><i class="fp-ic">${glyphSvg('vessel', '#4dd0e1', 30)}</i><span class="fp-title"></span><button type="button" class="fp-close" aria-label="${t('hud.close')}">×</button></div>
      <div class="fp-sub"></div>
      <div class="fp-body">
        <div class="fp-photo-container"></div>
        <div class="fp-content"></div>
      </div>
      <div class="fp-actions">
        <button type="button" data-act="follow">${t('map.fly.follow')}</button>
        <button type="button" data-act="zoom">${t('map.zoomIn')}</button>
      </div>`;
    parent.append(this.root);
    this.body = this.root.querySelector('.fp-body')!;
    this.photoEl = this.root.querySelector('.fp-photo-container')!;
    this.contentEl = this.root.querySelector('.fp-content')!;
    this.root.querySelector('.fp-close')!.addEventListener('click', () => this.close());
    this.root.querySelector('.fp-actions')!.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest('button')?.dataset.act;
      if (!act || this.mmsi == null) return;
      if (act === 'zoom') this.zoomIn();
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

  open(mmsi: number) {
    if (mmsi !== this.mmsi) this.metric = null;
    this.mmsi = mmsi;
    this.root.hidden = false;
    this.onOpen?.();
    this.render();
    clearInterval(this.refresh);
    this.refresh = window.setInterval(() => this.render(), 1000);
  }

  close() {
    this.setFollow(false);
    clearInterval(this.refresh);
    this.mmsi = null;
    this.photoCat = null;
    this.photo = null;
    this.photoEl.innerHTML = '';
    this.contentEl.innerHTML = '';
    this.root.hidden = true;
  }

  private zoomIn() {
    const i = this.mmsi != null ? this.h.info(this.mmsi) : null;
    const map = this.h.map();
    if (i && map) map.easeTo({ center: [i.lon, i.lat], zoom: Math.max(map.getZoom(), 13), duration: 700 });
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
    if (on && map) {
      const tick = () => {
        const i = this.mmsi != null ? this.h.info(this.mmsi) : null;
        if (i) map.jumpTo({ center: [i.lon, i.lat] });
      };
      tick();
      this.followTimer = window.setInterval(tick, 200);
    }
    this.root.querySelector('[data-act="follow"]')?.classList.toggle('on', on);
  }

  private render() {
    const i = this.mmsi != null ? this.h.info(this.mmsi) : null;
    const title = this.root.querySelector('.fp-title')!;
    const sub = this.root.querySelector('.fp-sub')!;
    if (!i) {
      title.textContent = `${t('map.ship.mmsiLabel', { mmsi: String(this.mmsi) })}`;
      sub.textContent = '';
      this.photoEl.innerHTML = '';
      this.contentEl.innerHTML = `<div class="fp-note">${t('map.ship.nodata')}</div>`;
      return;
    }
    const s = i.ship;
    const cat = shipCat(s.type);
    const COLOR = SHIP_COLORS[cat];
    const moving = s.sog > 0.5;
    const rot = s.heading >= 0 && s.heading < 360 ? s.heading : s.cog;
    title.textContent = s.name || t('map.ship.mmsiLabel', { mmsi: String(s.mmsi) });
    sub.innerHTML = `${escapeHtml(tx(`map.shipCat.${cat}`, SHIP_LABELS[cat]))} · <b>${s.mmsi}</b>`;
    // head icon tinted with the category colour
    this.root.querySelector('.fp-ic')!.innerHTML = glyphSvg('vessel', COLOR, 30);
    this.loadPhoto(cat);
    const age = Math.max(0, Math.round((Date.now() - s.at) / 1000));
    const ago = age < 90 ? t('map.ago.s', { a: age }) : age < 5400 ? t('map.ago.min', { a: Math.round(age / 60) }) : t('map.ago.h', { a: Math.round(age / 3600) });
    const dest = (s.destination ?? '').trim();
    const hero = dest
      ? routeHero({ from: { code: moving ? t('map.ship.moving') : t('map.ship.moored'), sub: `${fmt.num(s.sog, 1)} kn` }, to: { code: dest, sub: t('map.ship.destNote') }, progress: 0, mark: glyphSvg('vessel', COLOR, 20), color: COLOR, note: moving ? t('map.ship.courseNote', { deg: Math.round(rot), dir: compass(rot) }) : t('map.ship.still') }).replace('class="sp-route"', 'class="sp-route sp-text"')
      : `<div class="sp-note" style="margin-top:10px">${t('map.ship.noDest', { note: moving ? t('map.ship.courseNote', { deg: Math.round(rot), dir: compass(rot) }) : t('map.ship.statusMoored') })}</div>`;
    const tiles = `<div class="sp-tiles">${tile(t('map.tile.speed'), speedTxt(s.sog * 1.852, 1), { metric: 'speed', on: this.metric === 'speed' })}${tile(t('map.tile.course'), `${Math.round(rot)}° ${compass(rot)}`, { metric: 'track', on: this.metric === 'track' })}${tile(t('map.tile.status'), moving ? t('map.ship.statusMoving') : t('map.ship.statusMoored'))}${tile(t('map.tile.last'), ago)}</div>`;
    const GRAPHS: Record<string, [string, string]> = { speed: [t('map.metric.speed'), speedUnit()], track: [t('map.metric.course'), '°'] };
    const m = this.metric;
    const chart = m && GRAPHS[m] ? graph(t('map.graph.title', { m: GRAPHS[m][0] }), (m === 'speed' ? i.history.speed.map((v) => speedVal(v * 1.852)) : i.history[m as 'track']), GRAPHS[m][1], COLOR) : '';
    const shipLbl = tx(`map.shipCat.${cat}`, SHIP_LABELS[cat]);
    const cats =
      category('ship', t('map.cat.ship'), [[t('map.ship.rows.type'), escapeHtml(shipLbl)], [t('map.ship.rows.callsign'), escapeHtml(s.callSign || '–')], [t('map.ship.rows.mmsi'), String(s.mmsi)], [t('map.ship.rows.dest'), escapeHtml(dest || '–')]], this.open_) +
      category('position', t('map.cat.position'), [[t('map.ship.rows.lat'), fmt.num(i.lat, 3)], [t('map.ship.rows.lon'), fmt.num(i.lon, 3)], [t('map.ship.rows.speed'), speedTxt(s.sog * 1.852)]], this.open_);
    const src = `<details data-key="source" ${this.open_.has('source') ? 'open' : ''}><summary>${t('map.cat.source')}</summary><div class="fp-note">${escapeHtml(s.source)} · Fotos: <a href="https://commons.wikimedia.org" target="_blank" rel="noopener noreferrer">Wikimedia Commons</a> · <a href="https://www.marinetraffic.com/de/ais/details/ships/mmsi:${s.mmsi}" target="_blank" rel="noopener noreferrer">${t('map.ship.rows.view')}</a></div></details>`;
    this.contentEl.innerHTML = hero + tiles + chart + cats + src;
  }

  /**
   * Photo of the ship type (Wikimedia Commons, cached per category) above the content –
   * there is no keyless photo API for individual ships such as Planespotters for aircraft.
   * The card is only written when the category or result changes: rewriting it every second
   * would restart the <img> load and the photo would never appear.
   */
  private loadPhoto(cat: ShipCat) {
    if (this.photoCat === cat) return;
    this.photoCat = cat;
    this.photo = null;
    this.photoEl.innerHTML = '';
    fetchShipPhoto(cat).then((p) => {
      if (this.photoCat !== cat) return;
      this.photo = p;
      this.renderPhoto();
    });
  }

  private renderPhoto() {
    if (!this.photo) {
      this.photoEl.innerHTML = '';
      return;
    }
    const creditBits = [this.photo.license, 'Wikimedia Commons'].filter(Boolean).join(' · ');
    this.photoEl.innerHTML = `
      <div class="fp-photo-wrap">
        <a href="${escapeHtml(this.photo.link)}" target="_blank" rel="noopener noreferrer" class="fp-photo-link" title="${t('map.ship.photo')}">
          <img src="${escapeHtml(this.photo.src)}" alt="${escapeHtml(t('map.ship.alt', { cat: tx(`map.shipCat.${this.photoCat as ShipCat}`, SHIP_LABELS[this.photoCat as ShipCat]) }))}" />
        </a>
        <div class="fp-photo-credit">
          <span>${t('map.ship.symbol', { cat: escapeHtml(tx(`map.shipCat.${this.photoCat as ShipCat}`, SHIP_LABELS[this.photoCat as ShipCat])) })}</span>
          <a href="${escapeHtml(this.photo.link)}" target="_blank" rel="noopener noreferrer">${t('map.ship.credit', { who: escapeHtml(this.photo.photographer), license: escapeHtml(creditBits) })}</a>
        </div>
      </div>`;
  }
}
