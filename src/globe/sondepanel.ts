import type { Map as MlMap } from 'maplibre-gl';
import type { SondeInfo } from './extras';
import { compass, escapeHtml, fmt } from '../util';
import { climbTxt, climbUnit, climbVal, coordsTxt, heightBoth, heightTxt, heightUnit, heightVal, speedTxt, speedUnit, speedVal } from '../units';
import { glyphSvg } from './icons';
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
      <div class="fp-head" style="--c:${COLOR}"><i class="fp-ic">${glyphSvg('sonde', COLOR, 30)}</i><span class="fp-title"></span><button type="button" class="fp-close" aria-label="Schließen">×</button></div>
      <div class="fp-sub"></div>
      <div class="fp-body"></div>
      <div class="fp-actions three">
        <button type="button" data-act="route">Aufstieg</button>
        <button type="button" data-act="follow">Folgen</button>
        <button type="button" data-act="zoom">Heranzoomen</button>
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
      title.textContent = `Sonde ${this.serial}`;
      sub.textContent = '';
      this.body.innerHTML = '<div class="fp-note">Gerade keine Daten zu dieser Sonde – sie ist außerhalb des Ausschnitts, gelandet oder schweigt.</div>';
      return;
    }
    const model = [i.manufacturer, i.type, i.subtype].filter(Boolean).map(escapeHtml).join(' ') || 'Radiosonde';
    title.textContent = `Sonde ${i.serial}`;
    sub.innerHTML = `${model} · <b>${i.frequency != null ? `${fmt.num(i.frequency, 3)} MHz` : 'Radiosonde'}</b>`;

    const altM = Math.round(i.altM);
    const vs = i.vsMs ?? 0;
    const rising = vs > 0.5;
    const falling = vs < -0.5;
    const landed = altM < 30 && Math.abs(vs) < 1;
    const status = landed ? 'Gelandet' : rising ? 'Steigt' : falling ? 'Fällt' : 'Schwebt (Float)';
    const dt = i.datetime ? new Date(i.datetime).getTime() : 0;
    const age = dt ? Math.max(0, Math.round((Date.now() - dt) / 1000)) : 0;
    const ago = age ? (age < 90 ? `vor ${age} s` : age < 5400 ? `vor ${Math.round(age / 60)} min` : `vor ${Math.round(age / 3600)} h`) : '';
    const hero = routeHero({
      from: { code: status, sub: landed ? 'letzte Position am Boden' : `${heightTxt(altM)} über NN` },
      to: { code: `${fmt.num(Math.abs(vs), 1)} m/s`, sub: rising ? 'Steigrate' : falling ? 'Sinkrate (Fallschirm)' : 'vertikal fast still' },
      progress: Math.min(1, altM / 38000),
      mark: glyphSvg('sonde', COLOR, 20),
      color: COLOR,
      note: [ago && `Letzte Meldung ${ago}`, i.track != null && `Kurs ${Math.round(i.track)}° ${compass(i.track)}`, i.speedKmh != null && `Drift ${speedTxt(i.speedKmh)}`].filter(Boolean).join(' · '),
    });

    const m = this.metric;
    const tiles = `<div class="sp-tiles">${tile('Höhe', heightTxt(i.altM), { metric: 'alt', on: m === 'alt' })}${tile('Steigrate', climbTxt(vs), { metric: 'vs', on: m === 'vs' })}${tile('Drift', i.speedKmh != null ? speedTxt(i.speedKmh) : '–', { metric: 'speed', on: m === 'speed' })}${tile('Kurs', i.track != null ? `${Math.round(i.track)}° ${compass(i.track)}` : '–', { metric: 'track', on: m === 'track' })}</div>`;
    const GRAPHS: Record<string, [string, string]> = { alt: ['Höhe', heightUnit()], speed: ['Drift', speedUnit()], track: ['Kurs', '°'], vs: ['Steigrate', climbUnit()] };
    const chart = m && GRAPHS[m] ? graph(`${GRAPHS[m][0]} über die letzten Meldungen`, (m === 'speed' ? (i.history?.speed ?? []).map(speedVal) : m === 'alt' ? (i.history?.alt ?? []).map(heightVal) : m === 'vs' ? (i.history?.vs ?? []).map(climbVal) : (i.history?.track ?? [])), GRAPHS[m][1], COLOR) : '';

    // everything SondeHub offers about this sonde
    const sondeRows: [string, string][] = [
      ['Typ', model],
      ['Seriennummer', escapeHtml(i.serial)],
      ['Frequenz', i.frequency != null ? `${fmt.num(i.frequency, 3)} MHz` : '–'],
      ['Messrahmen (Frame)', i.frame != null ? String(i.frame) : '–'],
    ];
    const posRows: [string, string][] = [
      ['Position', coordsTxt(i.lat, i.lon)],
      ['Höhe', heightBoth(altM)],
      ['Vertikal (Telemetrie)', climbTxt(i.vsMs ?? 0)],
      ['Horizontal', i.speedKmh != null ? speedTxt(i.speedKmh, 1) : '–'],
      ['Position/Uhrzeit', escapeHtml(i.datetime ? fmt.dateTime(i.datetime) : '–')],
    ];
    const rxRows: [string, string][] = [
      ['Empfänger', escapeHtml(i.uploader || '–')],
      ['Antenne', escapeHtml(i.antenna || '–')],
      ['Auswertesoftware', escapeHtml(i.software || '–')],
      ['Letzter Empfang', escapeHtml(i.timeReceived ? fmt.dateTime(i.timeReceived) : '–')],
    ];
    const cats =
      category('sonde', 'Radiosonde', sondeRows, this.open_) +
      category('position', 'Position und Telemetrie', posRows, this.open_) +
      category('receiver', 'Bodenempfänger', rxRows, this.open_);

    const src = `<details data-key="source" ${this.open_.has('source') ? 'open' : ''}><summary>Datenquelle</summary><div class="fp-note">SondeHub (Amateur-Netzwerk) · <a href="${escapeHtml(i.url || `https://sondehub.org/#!q=${encodeURIComponent(i.serial)}`)}" target="_blank" rel="noopener noreferrer">Auf SondeHub ansehen ↗</a></div></details>`;

    this.body.innerHTML = hero + tiles + chart + cats + src;
  }
}
