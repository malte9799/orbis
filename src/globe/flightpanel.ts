import type { Map as MlMap } from 'maplibre-gl';
import type { FlightInfo } from './extras';
import { compass, escapeHtml, fmt } from '../util';
import { climbTxt, climbUnit, climbVal, distTxt, heightBoth, heightTxt, heightUnit, heightVal, speedTxt, speedUnit, speedVal } from '../units';
import { glyphSvg } from './icons';
import { t } from '../i18n';
import { category, clock, distKm, duration, graph, routeHero, tile } from './sidepanel';
import { fetchAircraftPhoto, lookupAircraftSpec, seatmapUrl, type AircraftPhoto } from '../api/aircraft';
import './flightpanel.css';

// Right-hand panel with the live data of the selected aircraft (everything ADS-B delivers),
// planespotters.net photo, enthusiast technical specifications, seat map link and three actions:
// show the whole trail, follow the aircraft, cockpit view.

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
  private photoEl: HTMLElement;
  private contentEl: HTMLElement;
  private hex: string | null = null;
  private follow: Follow = 'off';
  private refresh: number | undefined;
  private followTimer: number | undefined;
  private open_ = new Set<string>(['aircraft', 'specs']);
  /** tile whose graph is shown (alt, speed, track, vs) */
  private metric: string | null = null;
  private dragHooked = false;
  private photo: AircraftPhoto | null = null;
  private photoKey: string | null = null;

  constructor(
    parent: HTMLElement,
    private h: FlightPanelHooks,
  ) {
    this.root.className = 'fp';
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="fp-head"><i class="fp-ic">${glyphSvg('plane', 'currentColor', 30)}</i><span class="fp-title"></span><button type="button" class="fp-close" aria-label="${t('hud.close')}">×</button></div>
      <div class="fp-sub"></div>
      <div class="fp-body">
        <div class="fp-photo-container"></div>
        <div class="fp-content"></div>
      </div>
      <div class="fp-actions three">
        <button type="button" data-act="route">${t('map.fly.route') ?? 'Strecke'}</button>
        <button type="button" data-act="follow">${t('map.fly.follow') ?? 'Folgen'}</button>
        <button type="button" data-act="cockpit">${t('map.fly.cockpit') ?? 'Cockpit'}</button>
      </div>`;
    parent.append(this.root);
    this.body = this.root.querySelector('.fp-body')!;
    this.photoEl = this.root.querySelector('.fp-photo-container')!;
    this.contentEl = this.root.querySelector('.fp-content')!;
    this.root.querySelector('.fp-close')!.addEventListener('click', () => this.close());
    this.root.querySelector('.fp-actions')!.addEventListener('click', (e) => {
      const act = (e.target as HTMLElement).closest('button')?.dataset.act;
      if (!act || !this.hex) return;
      if (act === 'route') this.h.fit(this.hex);
      else this.setFollow(this.follow === act ? 'off' : (act as Follow));
    });
    // remember which sections the user collapsed across the live updates
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

  open(hex: string) {
    if (hex !== this.hex) {
      this.metric = null;
      this.photo = null;
      this.photoKey = null;
      this.photoEl.innerHTML = '';
    }
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
    this.photo = null;
    this.photoKey = null;
    this.photoEl.innerHTML = '';
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

  private renderPhoto(i: FlightInfo) {
    if (!this.photo) {
      this.photoEl.innerHTML = '';
      return;
    }
    const altText = [i.operator, i.type, i.reg].filter(Boolean).join(' ') || i.callsign || i.hex;
    this.photoEl.innerHTML = `
      <div class="fp-photo-wrap">
        <a href="${escapeHtml(this.photo.link)}" target="_blank" rel="noopener noreferrer" class="fp-photo-link" title="${t('map.fly.photo')}">
          <img src="${escapeHtml(this.photo.large)}" alt="${escapeHtml(altText)}" loading="lazy" />
        </a>
        <div class="fp-photo-credit">
          <a href="${escapeHtml(this.photo.link)}" target="_blank" rel="noopener noreferrer">
            ${t('map.fly.credit', { who: escapeHtml(this.photo.photographer) })}
          </a>
        </div>
      </div>`;
  }

  private render() {
    const i = this.hex ? this.h.info(this.hex) : null;
    const title = this.root.querySelector('.fp-title')!;
    const sub = this.root.querySelector('.fp-sub')!;
    if (!i) {
      title.textContent = this.hex?.toUpperCase() ?? '';
      sub.textContent = '';
      this.photoEl.innerHTML = '';
      this.contentEl.innerHTML = `<div class="fp-note">${t('map.fly.nodata')}</div>`;
      return;
    }

    // Lazy load photo from Planespotters (via proxy)
    const currentPhotoKey = `${i.hex}|${i.reg || ''}`;
    if (this.photoKey !== currentPhotoKey) {
      this.photoKey = currentPhotoKey;
      const targetHex = i.hex;
      fetchAircraftPhoto(i.hex, i.reg).then((p) => {
        if (this.hex !== targetHex) return;
        this.photo = p;
        this.renderPhoto(i);
      });
    }

    const spec = lookupAircraftSpec(i.icao);
    const displayType = spec?.name || i.type;

    title.textContent = i.callsign || i.hex.toUpperCase();
    sub.innerHTML = [i.operator && escapeHtml(i.operator), displayType && escapeHtml(displayType), i.reg && `<b>${escapeHtml(i.reg)}</b>`].filter(Boolean).join(' · ');

    const COLOR = '#f2c94c';
    const r = i.route;
    let hero: string;
    if (r) {
      const total = distKm(r.origin.lon, r.origin.lat, r.destination.lon, r.destination.lat);
      const done = distKm(r.origin.lon, r.origin.lat, i.lon, i.lat);
      const left = distKm(i.lon, i.lat, r.destination.lon, r.destination.lat);
      const progress = total > 0 ? Math.min(1, done / Math.max(1, done + left)) : 0;
      // ADS-B has no schedule: arrival and departure are estimated from the distance and the current ground speed
      const cruising = !!i.speedKmh && i.speedKmh > 300 && !i.ground;
      const now = Date.now();
      const arrive = cruising ? clock(now + (left / i.speedKmh!) * 3600_000) : undefined;
      const depart = cruising ? clock(now - (done / i.speedKmh!) * 3600_000) : undefined;
      const eta = cruising ? ` · ${t('map.fly.eta', { d: duration((left / i.speedKmh!) * 60) })}` : '';
      hero = routeHero({
        from: { code: r.origin.iata || r.origin.icao, sub: r.origin.city || r.origin.name, time: depart },
        to: { code: r.destination.iata || r.destination.icao, sub: r.destination.city || r.destination.name, time: arrive },
        progress,
        mark: glyphSvg('plane', COLOR, 20),
        color: COLOR,
        note: `${Math.round(progress * 100)} %${eta}`,
      });
    } else {
      hero = `<div class="sp-note" style="margin-top:10px">${i.route === undefined ? t('map.fly.routeLoading') : t('map.fly.routeUnknown')}</div>`;
    }

    const m = this.metric;
    const tiles = `<div class="sp-tiles">${tile(t('map.tile.alt'), i.ground ? t('map.fly.ground') : heightTxt(i.altM), { metric: 'alt', on: m === 'alt' })}${tile(t('map.tile.speed'), i.speedKmh == null ? '–' : speedTxt(i.speedKmh), { metric: 'speed', on: m === 'speed' })}${tile(t('map.tile.course'), `${Math.round(i.track)}° ${compass(i.track)}`, { metric: 'track', on: m === 'track' })}${tile(t('map.tile.vs'), i.vsMs == null ? '–' : climbTxt(i.vsMs), { metric: 'vs', on: m === 'vs' })}</div>`;
    const GRAPHS: Record<string, [string, string]> = { alt: [t('map.metric.alt'), heightUnit()], speed: [t('map.metric.speed'), speedUnit()], track: [t('map.metric.course'), '°'], vs: [t('map.metric.vs'), climbUnit()] };
    const chart = m && GRAPHS[m] ? graph(t('map.graph.title', { m: GRAPHS[m][0] }), (m === 'speed' ? (i.history?.speed ?? []).map(speedVal) : m === 'alt' ? (i.history?.alt ?? []).map(heightVal) : m === 'vs' ? (i.history?.vs ?? []).map(climbVal) : (i.history?.track ?? [])), GRAPHS[m][1], COLOR) : '';

    // Flugzeug-Identifikation
    const planeRows: [string, string][] = [
      [t('map.fly.rows.operator'), escapeHtml(i.operator || '–')],
      [t('map.fly.rows.model'), escapeHtml(spec?.name || i.type || '–')],
      [t('map.fly.rows.icao'), escapeHtml(i.icao || '–')],
      [t('map.fly.rows.reg'), escapeHtml(i.reg || '–')],
      [t('map.fly.rows.modeS'), escapeHtml(i.hex.toUpperCase())],
    ];
    if (spec?.mfr) planeRows.splice(1, 0, [t('map.fly.rows.mfr'), escapeHtml(spec.mfr)]);
    if (i.mil) planeRows.unshift([t('map.fly.rows.mil'), `<b>${t('map.fly.rows.military')}</b>`]);

    // Technische Daten & Spezifikationen (für Flugzeug-Enthusiasten)
    let techCat = '';
    if (spec) {
      const techRows: [string, string][] = [
        [t('map.fly.rows.engines'), escapeHtml(spec.engines)],
        [t('map.fly.rows.passengers'), escapeHtml(spec.seats)],
        [t('map.fly.rows.range'), distTxt(spec.rangeKm, 0)],
        [t('map.fly.rows.span'), `${heightTxt(spec.spanM, 1)} / ${heightTxt(spec.lengthM, 1)}`],
        [t('map.fly.rows.cruise'), `${t('map.fly.rows.approx')}${speedTxt(spec.speedKmh)}`],
        [t('map.fly.rows.ceiling'), heightBoth(spec.ceilingFt * 0.3048)],
        [t('map.fly.rows.wtc'), escapeHtml(spec.wtc)],
      ];
      techCat = category('specs', t('map.cat.specs'), techRows, this.open_);
    }

    // Sitzplan & Kabine
    const seatUrl = seatmapUrl(i.icao, i.operator);
    const seatRows: [string, string][] = [
      [t('map.fly.rows.seatsCap'), escapeHtml(spec?.seats || t('map.fly.rows.seatsVar'))],
      [t('map.fly.rows.seatsLink'), `<a href="${escapeHtml(seatUrl)}" target="_blank" rel="noopener noreferrer" class="fp-link">💺 Auf AeroLOPA suchen ↗</a>`],
    ];
    const seatCat = category('seating', t('map.cat.seats'), seatRows, this.open_);

    // Position & Telemetrie
    const posRows: [string, string][] = [
      [t('map.fly.rows.lat'), fmt.num(i.lat, 3)],
      [t('map.fly.rows.lon'), fmt.num(i.lon, 3)],
      [t('map.fly.rows.alt'), i.ground ? t('map.fly.ground') : heightBoth(i.altM)],
      [t('map.fly.rows.squawk'), escapeHtml(i.squawk || '–')],
      [t('map.fly.rows.nav'), i.nic == null && i.nacp == null ? '–' : `${i.nic ?? '–'} / ${i.nacp ?? '–'}${(i.nacp != null && i.nacp < 8) || (i.nic != null && i.nic < 7 && !(i.nic === 0 && i.nacp != null && i.nacp >= 10)) ? ` <span class="warn">${t('map.fly.rows.inaccurate')}</span>` : ''}`],
      [t('map.fly.rows.emergency'), i.emergency ? `<span class="warn">${escapeHtml(i.emergency)}</span>` : t('map.fly.rows.emergencyNone')],
    ];
    const posCat = category('position', t('map.cat.position'), posRows, this.open_);

    const cats = category('aircraft', t('map.cat.plane'), planeRows, this.open_) + techCat + seatCat + posCat;

    const source = i.source ? `${escapeHtml(i.source)} · ` : '';
    const src = `<details data-key="source" ${this.open_.has('source') ? 'open' : ''}><summary>Datenquelle</summary><div class="fp-note">${source}${i.route ? 'Route: <a href="https://www.adsbdb.com" target="_blank" rel="noopener noreferrer">adsbdb</a> · ' : ''}Fotos: <a href="https://www.planespotters.net" target="_blank" rel="noopener noreferrer">Planespotters.net</a> · <a href="https://globe.adsb.lol/?icao=${encodeURIComponent(i.hex)}" target="_blank" rel="noopener noreferrer">Auf adsb.lol ansehen ↗</a></div></details>`;

    this.contentEl.innerHTML = hero + tiles + chart + cats + src;
  }
}
