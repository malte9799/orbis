import type { Map as MlMap } from 'maplibre-gl';
import type { ShipInfo } from './extras';
import { SHIP_COLORS, SHIP_LABELS, shipCat } from '../api/transport';
import { compass, escapeHtml, fmt } from '../util';
import { glyphSvg } from './icons';
import { category, routeHero, tile } from './sidepanel';
import './flightpanel.css';

// Right-hand panel with the live data of the selected ship (AIS), same layout as the flight panel.

export interface ShipPanelHooks {
  info(mmsi: number): ShipInfo | null;
  map(): MlMap | null;
}

export class ShipPanel {
  private root = document.createElement('aside');
  private body: HTMLElement;
  private mmsi: number | null = null;
  private following = false;
  private refresh: number | undefined;
  private followTimer: number | undefined;
  private open_ = new Set<string>();
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
      <div class="fp-head"><i class="fp-ic">${glyphSvg('vessel', '#4dd0e1', 30)}</i><span class="fp-title"></span><button type="button" class="fp-close" aria-label="Schließen">×</button></div>
      <div class="fp-sub"></div>
      <div class="fp-body"></div>
      <div class="fp-actions">
        <button type="button" data-act="follow">Folgen</button>
        <button type="button" data-act="zoom">Heranzoomen</button>
      </div>`;
    parent.append(this.root);
    this.body = this.root.querySelector('.fp-body')!;
    this.root.querySelector('.fp-close')!.addEventListener('click', () => this.close());
    this.root.querySelector('.fp-actions')!.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest('button')?.dataset.act;
      if (!act || this.mmsi == null) return;
      if (act === 'zoom') this.zoomIn();
      else this.setFollow(!this.following);
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
      title.textContent = `MMSI ${this.mmsi}`;
      sub.textContent = '';
      this.body.innerHTML = '<div class="fp-note">Gerade keine Daten zu diesem Schiff – es ist außerhalb des Ausschnitts oder nicht mehr in Reichweite.</div>';
      return;
    }
    const s = i.ship;
    const cat = shipCat(s.type);
    const COLOR = SHIP_COLORS[cat];
    const moving = s.sog > 0.5;
    const rot = s.heading >= 0 && s.heading < 360 ? s.heading : s.cog;
    title.textContent = s.name || `MMSI ${s.mmsi}`;
    sub.innerHTML = `${escapeHtml(SHIP_LABELS[cat])} · <b>${s.mmsi}</b>`;
    const age = Math.max(0, Math.round((Date.now() - s.at) / 1000));
    const ago = age < 90 ? `vor ${age} s` : age < 5400 ? `vor ${Math.round(age / 60)} min` : `vor ${Math.round(age / 3600)} h`;
    const dest = (s.destination ?? '').trim();
    const hero = dest
      ? routeHero({ from: { code: moving ? 'Unterwegs' : 'Liegt', sub: `${fmt.num(s.sog, 1)} kn` }, to: { code: dest, sub: 'Ziel laut AIS' }, progress: 0, mark: glyphSvg('vessel', COLOR, 20), color: COLOR, note: moving ? `Kurs ${Math.round(rot)}° ${compass(rot)}` : 'macht gerade keine Fahrt' }).replace('class="sp-route"', 'class="sp-route sp-text"')
      : `<div class="sp-note" style="margin-top:10px">Kein Ziel gemeldet · ${moving ? `Kurs ${Math.round(rot)}° ${compass(rot)}` : 'liegt'}</div>`;
    const tiles = `<div class="sp-tiles">${tile('Tempo', `${fmt.num(s.sog, 1)} kn`)}${tile('Kurs', `${Math.round(rot)}° ${compass(rot)}`)}${tile('Status', moving ? 'in Fahrt' : 'liegt')}${tile('Letzte Meldung', ago)}</div>`;
    const cats =
      category('ship', 'Schiff', [['Typ', escapeHtml(SHIP_LABELS[cat])], ['Rufzeichen', escapeHtml(s.callSign || '–')], ['MMSI', String(s.mmsi)], ['Ziel', escapeHtml(dest || '–')]], this.open_) +
      category('position', 'Position', [['Breitengrad', fmt.num(i.lat, 3)], ['Längengrad', fmt.num(i.lon, 3)], ['Geschwindigkeit', `${fmt.num(s.sog * 1.852, 0)} km/h`]], this.open_);
    const src = `<details data-key="source" ${this.open_.has('source') ? 'open' : ''}><summary>Datenquelle</summary><div class="fp-note">${escapeHtml(s.source)} · <a href="https://www.marinetraffic.com/de/ais/details/ships/mmsi:${s.mmsi}" target="_blank" rel="noopener noreferrer">Auf MarineTraffic ansehen ↗</a></div></details>`;
    this.body.innerHTML = hero + tiles + cats + src;
  }
}
