import type { Map as MlMap } from 'maplibre-gl';
import { satPopupInfo, satPosition, type Sat } from '../api/tracking';
import { distTxt, speedTxt } from '../units';
import { escapeHtml, fmt } from '../util';
import { glyphSvg } from './icons';
import { satColor } from './satellites3d';
import { category, tile } from './sidepanel';
import './flightpanel.css';

// Right-hand panel with the live data of the selected satellite, same layout as the flight panel.

export interface SatPanelHooks {
  sat(id: string): Sat | null;
  /** its orbit and ground track are shown (null: none) */
  select(id: string | null): void;
  map(): MlMap | null;
  /** the camera follows this one and turns around it */
  follow(id: string): void;
  unfollow(): void;
}

export class SatPanel {
  private root = document.createElement('aside');
  private contentEl: HTMLElement;
  private id: string | null = null;
  private following = false;
  private refresh: number | undefined;
  private open_ = new Set<string>();

  constructor(
    parent: HTMLElement,
    private h: SatPanelHooks,
  ) {
    this.root.className = 'fp';
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="fp-head"><i class="fp-ic">${glyphSvg('satellite', '#b388ff', 30)}</i><span class="fp-title"></span><button type="button" class="fp-close" aria-label="Schließen">×</button></div>
      <div class="fp-sub"></div>
      <div class="fp-body"><div class="fp-content"></div></div>
      <div class="fp-actions">
        <button type="button" data-act="follow">Folgen</button>
        <button type="button" data-act="zoom">Hinfliegen</button>
      </div>`;
    parent.append(this.root);
    this.contentEl = this.root.querySelector('.fp-content')!;
    this.root.querySelector('.fp-close')!.addEventListener('click', () => this.close());
    this.root.querySelector('.fp-actions')!.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest('button')?.dataset.act;
      if (!act || !this.id) return;
      if (act === 'zoom') this.flyTo();
      else this.setFollow(!this.following);
    });
    this.contentEl.addEventListener(
      'toggle',
      (e) => {
        const d = e.target as HTMLDetailsElement;
        const key = d.dataset.key;
        if (key) d.open ? this.open_.add(key) : this.open_.delete(key);
      },
      true,
    );
  }

  open(id: string) {
    if (id !== this.id) this.setFollow(false);
    this.id = id;
    this.h.select(id);
    this.root.hidden = false;
    this.render();
    clearInterval(this.refresh);
    this.refresh = window.setInterval(() => this.render(), 1000);
  }

  close() {
    this.setFollow(false);
    clearInterval(this.refresh);
    if (this.id) this.h.select(null);
    this.id = null;
    this.contentEl.innerHTML = '';
    this.root.hidden = true;
  }

  private flyTo() {
    const s = this.id ? this.h.sat(this.id) : null;
    const p = s && satPosition(s, new Date());
    const map = this.h.map();
    if (p && map) map.easeTo({ center: [p.lon, p.lat], duration: 700 });
  }

  /** The camera takes over this one (also from whatever it followed so far). */
  followThis() {
    this.setFollow(true);
  }

  /** The camera follows this one (null: something else or nothing): the button goes along. */
  focusChanged(following: string | null) {
    if (!this.following || following === this.id) return;
    this.following = false;
    this.root.querySelector('[data-act="follow"]')?.classList.toggle('on', false);
  }

  private setFollow(on: boolean) {
    const was = this.following;
    this.following = on;
    if (on && this.id) this.h.follow(this.id);
    else if (was) this.h.unfollow();
    this.root.querySelector('[data-act="follow"]')?.classList.toggle('on', on);
  }

  private render() {
    const s = this.id ? this.h.sat(this.id) : null;
    const title = this.root.querySelector('.fp-title')!;
    const sub = this.root.querySelector('.fp-sub')!;
    if (!s) {
      title.textContent = 'Satellit';
      sub.textContent = '';
      this.contentEl.innerHTML = '<div class="fp-note">Gerade keine Daten zu diesem Satelliten.</div>';
      return;
    }
    const info = satPopupInfo(s);
    const p = satPosition(s, new Date());
    title.textContent = info.title;
    sub.textContent = info.subtitle;
    this.root.querySelector('.fp-ic')!.innerHTML = glyphSvg('satellite', satColor(s.group), 30);
    const periodMin = (2 * Math.PI) / s.satrec.no;
    const tiles = `<div class="sp-tiles">${tile('Höhe', p ? distTxt(p.heightKm, 0) : '–')}${tile('Tempo', p ? speedTxt(p.speedKmS * 3600) : '–')}${tile('Umlaufzeit', `${fmt.num(periodMin, 0)} min`)}${tile('Umläufe pro Tag', fmt.num(1440 / periodMin, 1))}</div>`;
    const cats = category('position', 'Position', [['Breitengrad', p ? fmt.num(p.lat, 3) : '–'], ['Längengrad', p ? fmt.num(p.lon, 3) : '–']], this.open_);
    const src = `<details data-key="source" ${this.open_.has('source') ? 'open' : ''}><summary>Datenquelle</summary><div class="fp-note">Bahndaten: CelesTrak, Position im Browser berechnet (SGP4) · <a href="${escapeHtml(info.url)}" target="_blank" rel="noopener noreferrer">Im Katalog ansehen ↗</a></div></details>`;
    this.contentEl.innerHTML = tiles + cats + src;
  }
}
