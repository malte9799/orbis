import type { Map as MlMap } from 'maplibre-gl';
import type { FlightInfo } from './extras';
import { compass, escapeHtml, fmt } from '../util';
import './flightpanel.css';

// Right-hand panel with the live data of the selected aircraft (everything ADS-B delivers) and
// three actions: show the whole trail, follow the aircraft, cockpit view.

export interface FlightPanelHooks {
  info(hex: string): FlightInfo | null;
  /** highlight the trail of this aircraft (null: none) */
  select(hex: string | null): void;
  fit(hex: string): void;
  map(): MlMap | null;
}

type Follow = 'off' | 'follow' | 'cockpit';

const SECTIONS: { key: string; title: string }[] = [
  { key: 'flight', title: 'Flugdaten' },
  { key: 'position', title: 'Position' },
  { key: 'aircraft', title: 'Flugzeug' },
];

export class FlightPanel {
  private root = document.createElement('aside');
  private body: HTMLElement;
  private hex: string | null = null;
  private follow: Follow = 'off';
  private refresh: number | undefined;
  private followTimer: number | undefined;
  private closed = new Set<string>();
  private dragHooked = false;

  constructor(
    parent: HTMLElement,
    private h: FlightPanelHooks,
  ) {
    this.root.className = 'fp';
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="fp-head"><span class="fp-title"></span><button type="button" class="fp-close" aria-label="Schließen">×</button></div>
      <div class="fp-sub"></div>
      <div class="fp-body"></div>
      <div class="fp-actions">
        <button type="button" data-act="route">Strecke</button>
        <button type="button" data-act="follow">Folgen</button>
        <button type="button" data-act="cockpit" class="full">Cockpit-Ansicht</button>
      </div>`;
    parent.append(this.root);
    this.body = this.root.querySelector('.fp-body')!;
    this.root.querySelector('.fp-close')!.addEventListener('click', () => this.close());
    this.root.querySelector('.fp-actions')!.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest('button')?.dataset.act;
      if (!act || !this.hex) return;
      if (act === 'route') this.h.fit(this.hex);
      else this.setFollow(this.follow === act ? 'off' : (act as Follow));
    });
    // remember which sections the user collapsed across the live updates
    this.body.addEventListener(
      'toggle',
      (e) => {
        const d = e.target as HTMLDetailsElement;
        const key = d.dataset.key;
        if (key) d.open ? this.closed.delete(key) : this.closed.add(key);
      },
      true,
    );
  }

  open(hex: string) {
    this.hex = hex;
    this.root.hidden = false;
    this.h.select(hex);
    this.render();
    clearInterval(this.refresh);
    this.refresh = window.setInterval(() => this.render(), 1000);
  }

  close() {
    this.setFollow('off');
    clearInterval(this.refresh);
    if (this.hex) this.h.select(null);
    this.hex = null;
    this.root.hidden = true;
  }

  private setFollow(mode: Follow) {
    this.follow = mode;
    clearInterval(this.followTimer);
    const map = this.h.map();
    if (map && !this.dragHooked) {
      this.dragHooked = true;
      // moving the map by hand ends following
      map.on('dragstart', () => this.follow !== 'off' && this.setFollow('off'));
    }
    if (mode !== 'off' && map && this.hex) {
      const tick = () => {
        const i = this.hex ? this.h.info(this.hex) : null;
        if (!i) return;
        if (this.follow === 'cockpit') map.jumpTo({ center: [i.lon, i.lat], bearing: i.track, pitch: 75, zoom: Math.max(map.getZoom(), 15) });
        else map.jumpTo({ center: [i.lon, i.lat] });
      };
      tick();
      this.followTimer = window.setInterval(tick, 200);
    }
    for (const b of this.root.querySelectorAll<HTMLButtonElement>('.fp-actions button')) b.classList.toggle('on', b.dataset.act === this.follow);
  }

  private render() {
    const i = this.hex ? this.h.info(this.hex) : null;
    const title = this.root.querySelector('.fp-title')!;
    const sub = this.root.querySelector('.fp-sub')!;
    if (!i) {
      title.textContent = this.hex?.toUpperCase() ?? '';
      sub.textContent = '';
      this.body.innerHTML = '<div class="fp-note">Gerade keine Daten zu diesem Flugzeug – es ist außerhalb des Ausschnitts oder nicht mehr in Reichweite.</div>';
      return;
    }
    title.textContent = i.callsign || i.hex.toUpperCase();
    sub.innerHTML = [i.type && escapeHtml(i.type), i.reg && `<b>${escapeHtml(i.reg)}</b>`].filter(Boolean).join(' · ');
    const num = (n: number | null, unit: string, d = 0) => (n == null ? '–' : `${fmt.num(n, d)} ${unit}`);
    const cell = (label: string, value: string, cls = '') => `<div class="fp-cell ${cls}"><span>${label}</span><b>${value}</b></div>`;
    const sections: Record<string, string> = {
      flight: cell('Betreiber', escapeHtml(i.operator || '–'), 'wide') + cell('Typ', escapeHtml(i.type || '–'), 'wide') + cell('ICAO-Typ', escapeHtml(i.icao || '–')) + cell('Notfall', escapeHtml(i.emergency || 'keiner'), i.emergency ? 'warn' : ''),
      position:
        cell('Höhe', i.ground ? 'am Boden' : `${fmt.num(i.altM)} m`) +
        cell('Geschwindigkeit', num(i.speedKmh, 'km/h')) +
        cell('Breitengrad', fmt.num(i.lat, 3)) +
        cell('Längengrad', fmt.num(i.lon, 3)) +
        cell('Steigrate', num(i.vsMs, 'm/s', 1)) +
        cell('Kurs', `${Math.round(i.track)}° ${compass(i.track)}`) +
        cell('Squawk', escapeHtml(i.squawk || '–')),
      aircraft: cell('Kennzeichen', escapeHtml(i.reg || '–')) + cell('Mode-S (Hex)', escapeHtml(i.hex.toUpperCase())),
    };
    const source = i.source ? `${escapeHtml(i.source)} · ` : '';
    this.body.innerHTML =
      SECTIONS.map((s) => `<details data-key="${s.key}" ${this.closed.has(s.key) ? '' : 'open'}><summary>${s.title}</summary><div class="fp-grid">${sections[s.key]}</div></details>`).join('') +
      `<details data-key="source" ${this.closed.has('source') ? '' : 'open'}><summary>Datenquelle</summary><div class="fp-note">${source}<a href="https://globe.adsb.lol/?icao=${encodeURIComponent(i.hex)}" target="_blank" rel="noopener noreferrer">Auf adsb.lol ansehen ↗</a></div></details>`;
  }
}
