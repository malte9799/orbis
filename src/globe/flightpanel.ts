import type { Map as MlMap } from 'maplibre-gl';
import type { FlightInfo } from './extras';
import { compass, escapeHtml, fmt } from '../util';
import { glyphSvg } from './icons';
import { category, distKm, duration, profile, routeHero, tile } from './sidepanel';
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

const M_PER_DEG = 111320;
const rad = (d: number) => (d * Math.PI) / 180;

/** A point `metres` away from lon/lat in the direction of a compass bearing. */
function shift(lon: number, lat: number, bearing: number, metres: number): [number, number] {
  return [lon + (metres * Math.sin(rad(bearing))) / (M_PER_DEG * Math.max(0.05, Math.cos(rad(lat)))), lat + (metres * Math.cos(rad(bearing))) / M_PER_DEG];
}

export class FlightPanel {
  private root = document.createElement('aside');
  private body: HTMLElement;
  private hex: string | null = null;
  private follow: Follow = 'off';
  private refresh: number | undefined;
  private followTimer: number | undefined;
  private open_ = new Set<string>();
  private dragHooked = false;

  constructor(
    parent: HTMLElement,
    private h: FlightPanelHooks,
  ) {
    this.root.className = 'fp';
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="fp-head"><i class="fp-ic">${glyphSvg('plane', 'currentColor', 30)}</i><span class="fp-title"></span><button type="button" class="fp-close" aria-label="Schließen">×</button></div>
      <div class="fp-sub"></div>
      <div class="fp-body"></div>
      <div class="fp-actions three">
        <button type="button" data-act="route">Strecke</button>
        <button type="button" data-act="follow">Folgen</button>
        <button type="button" data-act="cockpit">Cockpit</button>
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
        if (key) d.open ? this.open_.add(key) : this.open_.delete(key);
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
        const alt = i.ground ? 0 : i.altM;
        if (this.follow === 'cockpit') {
          // the camera sits at the aircraft (on its altitude) and looks along its course: with the pitch
          // the camera is `dist` away from the map centre, `dist · cos(pitch)` high and `dist · sin(pitch)`
          // behind it – so the height fixes the zoom and the centre lies ahead of the aircraft
          const pitch = Math.min(map.getMaxPitch(), 75);
          const dist = (Math.max(alt, 20) + 8) / Math.cos(rad(pitch));
          const h = map.getCanvas().clientHeight;
          const zoom = Math.log2((40075016 * Math.cos(rad(i.lat))) / (512 * (dist / (1.5 * h))));
          map.jumpTo({ center: shift(i.lon, i.lat, i.track, dist * Math.sin(rad(pitch))), bearing: i.track, pitch, zoom: Math.min(map.getMaxZoom(), Math.max(0, zoom)) });
        } else {
          // the aircraft is in the air: the map centre is where the view ray through it meets the ground
          map.jumpTo({ center: shift(i.lon, i.lat, map.getBearing(), alt * Math.tan(rad(map.getPitch()))) });
        }
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
    sub.innerHTML = [i.operator && escapeHtml(i.operator), i.type && escapeHtml(i.type), i.reg && `<b>${escapeHtml(i.reg)}</b>`].filter(Boolean).join(' · ');
    const num = (n: number | null, unit: string, d = 0) => (n == null ? '–' : `${fmt.num(n, d)} ${unit}`);
    const COLOR = '#f2c94c';
    const r = i.route;
    let hero: string;
    if (r) {
      const total = distKm(r.origin.lon, r.origin.lat, r.destination.lon, r.destination.lat);
      const done = distKm(r.origin.lon, r.origin.lat, i.lon, i.lat);
      const left = distKm(i.lon, i.lat, r.destination.lon, r.destination.lat);
      const progress = total > 0 ? Math.min(1, done / Math.max(1, done + left)) : 0;
      const eta = i.speedKmh && i.speedKmh > 100 && !i.ground ? ` · noch ca. ${duration((left / i.speedKmh) * 60)}` : '';
      hero = routeHero({
        from: { code: r.origin.iata || r.origin.icao, sub: r.origin.city || r.origin.name },
        to: { code: r.destination.iata || r.destination.icao, sub: r.destination.city || r.destination.name },
        progress,
        mark: glyphSvg('plane', COLOR, 20),
        color: COLOR,
        note: `${Math.round(progress * 100)} %${eta}`,
      });
    } else {
      hero = `<div class="sp-note" style="margin-top:10px">${i.route === undefined ? 'Route wird geladen …' : 'Route unbekannt'}</div>`;
    }
    const tiles = `<div class="sp-tiles">${tile('Höhe', i.ground ? 'am Boden' : `${fmt.num(i.altM)} m`)}${tile('Tempo', num(i.speedKmh, 'km/h'))}${tile('Kurs', `${Math.round(i.track)}° ${compass(i.track)}`)}${tile('Steigrate', num(i.vsMs, 'm/s', 1))}</div>`;
    const cats =
      category('aircraft', 'Flugzeug', [['Betreiber', escapeHtml(i.operator || '–')], ['Typ', escapeHtml(i.type || '–')], ['ICAO-Typ', escapeHtml(i.icao || '–')], ['Kennzeichen', escapeHtml(i.reg || '–')], ['Mode-S (Hex)', escapeHtml(i.hex.toUpperCase())]], this.open_) +
      category('position', 'Position und Signal', [['Breitengrad', fmt.num(i.lat, 3)], ['Längengrad', fmt.num(i.lon, 3)], ['Squawk', escapeHtml(i.squawk || '–')], ['Notfall', i.emergency ? `<span class="warn">${escapeHtml(i.emergency)}</span>` : 'keiner']], this.open_);
    const source = i.source ? `${escapeHtml(i.source)} · ` : '';
    const src = `<details data-key="source" ${this.open_.has('source') ? 'open' : ''}><summary>Datenquelle</summary><div class="fp-note">${source}${i.route ? 'Route: <a href="https://www.adsbdb.com" target="_blank" rel="noopener noreferrer">adsbdb</a> (Schätzung nach Callsign, gestrichelt auf der Karte) · ' : ''}<a href="https://globe.adsb.lol/?icao=${encodeURIComponent(i.hex)}" target="_blank" rel="noopener noreferrer">Auf adsb.lol ansehen ↗</a></div></details>`;
    this.body.innerHTML = hero + profile('Höhenprofil', i.profile ?? [], COLOR, 'Das Profil entsteht, sobald das Flugzeug eine Weile beobachtet wurde.') + tiles + cats + src;
  }
}
