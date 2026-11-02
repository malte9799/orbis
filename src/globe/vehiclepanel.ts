import type { Map as MlMap } from 'maplibre-gl';
import { modeStyle } from '../api/transit';
import { loadTrainDetails } from '../api/transport';
import { clockTxt, speedTxt } from '../units';
import { compass, escapeHtml, fmt } from '../util';
import { glyphSvg } from './icons';
import { category, routeHero, tile } from './sidepanel';
import './flightpanel.css';

// Right-hand panel with the live data of the selected train or bus, same layout as the flight panel.

export interface VehicleInfo {
  props: Record<string, unknown>;
  lon: number;
  lat: number;
  /** direction of travel (°) */
  track: number;
  /** wall clock of the latest report */
  at: number;
}

export interface VehiclePanelHooks {
  info(key: string): VehicleInfo | null;
  map(): MlMap | null;
  /** the camera follows this one and turns around it */
  follow(key: string): void;
  unfollow(): void;
}

/** what the Finnish railways add about a train; the feed itself only has its number */
type TrainDetails = Awaited<ReturnType<typeof loadTrainDetails>>;

const delayText = (d: number) => (d === -999 ? '' : d > 0 ? `+${d} min` : d < 0 ? `${d} min` : 'pünktlich');

const SOURCES: Record<string, [string, string?]> = {
  transitous: ['Transitous, Position aus Echtzeitfahrplan berechnet', 'https://transitous.org/'],
  amtrak: ['Amtraker (Amtrak-GPS)', 'https://amtraker.com/'],
  fi: ['Fintraffic Digitraffic'],
};

export class VehiclePanel {
  private root = document.createElement('aside');
  private contentEl: HTMLElement;
  private key: string | null = null;
  private following = false;
  private refresh: number | undefined;
  private open_ = new Set<string>();
  private details: TrainDetails = null;
  /** the train the details were asked for */
  private detailsNum: number | null = null;

  constructor(
    parent: HTMLElement,
    private h: VehiclePanelHooks,
  ) {
    this.root.className = 'fp';
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="fp-head"><i class="fp-ic">${glyphSvg('train', '#bdbdbd', 30)}</i><span class="fp-title"></span><button type="button" class="fp-close" aria-label="Schließen">×</button></div>
      <div class="fp-sub"></div>
      <div class="fp-body"><div class="fp-content"></div></div>
      <div class="fp-actions">
        <button type="button" data-act="follow">Folgen</button>
        <button type="button" data-act="zoom">Heranzoomen</button>
      </div>`;
    parent.append(this.root);
    this.contentEl = this.root.querySelector('.fp-content')!;
    this.root.querySelector('.fp-close')!.addEventListener('click', () => this.close());
    this.root.querySelector('.fp-actions')!.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest('button')?.dataset.act;
      if (!act || !this.key) return;
      if (act === 'zoom') this.zoomIn();
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

  open(key: string) {
    if (key !== this.key) this.setFollow(false);
    this.key = key;
    this.root.hidden = false;
    this.render();
    clearInterval(this.refresh);
    this.refresh = window.setInterval(() => this.render(), 1000);
  }

  close() {
    this.setFollow(false);
    clearInterval(this.refresh);
    this.key = null;
    this.details = null;
    this.detailsNum = null;
    this.contentEl.innerHTML = '';
    this.root.hidden = true;
  }

  private zoomIn() {
    const i = this.key ? this.h.info(this.key) : null;
    const map = this.h.map();
    if (i && map) map.easeTo({ center: [i.lon, i.lat], zoom: Math.max(map.getZoom(), 14), duration: 700 });
  }

  /** The camera takes over this one (also from whatever it followed so far). */
  followThis() {
    this.setFollow(true);
  }

  /** The camera follows this one (null: something else or nothing): the button goes along. */
  focusChanged(following: string | null) {
    if (!this.following || following === this.key) return;
    this.following = false;
    this.root.querySelector('[data-act="follow"]')?.classList.toggle('on', false);
  }

  private setFollow(on: boolean) {
    const was = this.following;
    this.following = on;
    if (on && this.key) this.h.follow(this.key);
    else if (was) this.h.unfollow();
    this.root.querySelector('[data-act="follow"]')?.classList.toggle('on', on);
  }

  /** A Finnish train only has a number in the feed: the rest is asked for once. */
  private loadDetails(p: Record<string, unknown>) {
    const num = Number(p.num);
    if (p.src !== 'fi' || !num || this.detailsNum === num) return;
    this.detailsNum = num;
    this.details = null;
    void loadTrainDetails(num, String(p.date))
      .then((d) => {
        if (this.detailsNum !== num) return;
        this.details = d;
        this.render();
      })
      .catch(() => undefined);
  }

  private render() {
    const i = this.key ? this.h.info(this.key) : null;
    const title = this.root.querySelector('.fp-title')!;
    const sub = this.root.querySelector('.fp-sub')!;
    if (!i) {
      title.textContent = 'Fahrzeug';
      sub.textContent = '';
      this.contentEl.innerHTML = '<div class="fp-note">Gerade keine Daten zu diesem Fahrzeug – es ist außerhalb des Ausschnitts oder nicht mehr unterwegs.</div>';
      return;
    }
    const p = i.props;
    this.loadDetails(p);
    const d = this.details;
    const style = modeStyle(String(p.mode));
    const color = String(p.color ?? style.color);
    const label = d?.category ?? style.label;
    const from = String(d?.from ?? p.from ?? '');
    const to = String(d?.to ?? p.to ?? '');
    const speed = p.speed != null ? Number(p.speed) : null;
    title.textContent = d?.title ?? String(p.name ?? (p.num ? `Zug ${p.num}` : label));
    sub.innerHTML = escapeHtml(label);
    this.root.querySelector('.fp-ic')!.innerHTML = glyphSvg('train', color, 30);
    const delay = d?.delay ?? (p.delay != null ? Number(p.delay) : -999);
    const delayed = delayText(delay);
    const age = Math.max(0, Math.round((Date.now() - i.at) / 1000));
    const hero =
      from && to
        ? routeHero({ from: { code: from, sub: '' }, to: { code: to, sub: p.arr ? `Ankunft ${clockTxt(Number(p.arr))}` : '' }, progress: 0, mark: glyphSvg('train', color, 20), color, note: `Richtung ${Math.round(i.track)}° ${compass(i.track)}` }).replace('class="sp-route"', 'class="sp-route sp-text"')
        : `<div class="sp-note" style="margin-top:10px">Keine Strecke gemeldet · Richtung ${Math.round(i.track)}° ${compass(i.track)}</div>`;
    const tiles = `<div class="sp-tiles">${tile('Tempo', speed != null ? speedTxt(speed) : '–')}${tile('Verspätung', delayed || '–')}${tile('Richtung', `${Math.round(i.track)}° ${compass(i.track)}`)}${tile('Letzte Meldung', age < 90 ? `vor ${age} s` : `vor ${Math.round(age / 60)} min`)}</div>`;
    const rows: [string, string][] = [
      ['Art', escapeHtml(label)],
      ['Strecke', from && to ? `${escapeHtml(from)} → ${escapeHtml(to)}` : '–'],
    ];
    if (d?.lastStation) rows.push(['Zuletzt', escapeHtml(d.lastStation)]);
    if (p.timely) rows.push(['Status', escapeHtml(String(p.timely))]);
    const cats = category('vehicle', 'Fahrzeug', rows, this.open_) + category('position', 'Position', [['Breitengrad', fmt.num(i.lat, 3)], ['Längengrad', fmt.num(i.lon, 3)]], this.open_);
    const [source, url] = SOURCES[String(p.src)] ?? [`${String(p.feed ?? 'GPS')} (GPS)`];
    const link = url ? ` · <a href="${url}" target="_blank" rel="noopener noreferrer">Quelle ansehen ↗</a>` : '';
    const src = `<details data-key="source" ${this.open_.has('source') ? 'open' : ''}><summary>Datenquelle</summary><div class="fp-note">${escapeHtml(source)}${link}</div></details>`;
    this.contentEl.innerHTML = hero + tiles + cats + src;
  }
}
