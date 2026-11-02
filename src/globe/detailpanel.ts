import type { Map as MlMap, GeoJSONSource } from 'maplibre-gl';
import type { GlyphId } from './icons';
import { glyphSvg } from './icons';
import { escapeHtml } from '../util';
import './flightpanel.css';

// Right-hand detail panel for the documentation layers of the Zeugen-Karte (Versammlungen
// D/AT/CH und US-Proteste): statt der kleinen Popup-Karte alle erfassten Angaben in Wert-Kacheln
// und aufklappbaren Kategorien (Bausteine wie beim Flug-/Schiffs-Panel, CSS aus flightpanel.css).
// Bei Versammlungen mit gemeldeter Strecke zeichnet das Panel die Route auf der Karte hervor.

export interface DetailContent {
  glyph: GlyphId;
  color: string;
  title: string;
  subtitle?: string;
  /** Markup aus tile()/category() (Bausteine sidepanel.ts) */
  body: string;
  /** Zeile am Fuß (Quelle/Lizenz) */
  source?: string;
  /** Link/Button-Ziel (Eintrag oder Dataset) */
  link?: { url: string; label: string };
  /** gemeldete Strecke ([[lon,lat] …]), die auf der Karte hervorgehoben wird */
  route?: number[][];
}

export interface DetailPanelHooks {
  map(): MlMap | null;
}

export class DetailPanel {
  private root = document.createElement('aside');
  private body: HTMLElement;
  private cur: DetailContent | null = null;
  /** called when the panel opens, so the other panels can step aside */
  onOpen?: () => void;

  constructor(
    parent: HTMLElement,
    private h: DetailPanelHooks,
  ) {
    this.root.className = 'fp';
    this.root.hidden = true;
    this.root.innerHTML = `
      <div class="fp-head"><i class="fp-ic"></i><span class="fp-title"></span><button type="button" class="fp-close" aria-label="Schließen">×</button></div>
      <div class="fp-sub"></div>
      <div class="fp-body"></div>
      <div class="fp-actions"></div>`;
    parent.append(this.root);
    this.body = this.root.querySelector('.fp-body')!;
    this.root.querySelector('.fp-close')!.addEventListener('click', () => this.close());
    this.root.querySelector('.fp-actions')!.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!b) return;
      if (b.dataset.link) window.open(b.dataset.link, '_blank', 'noopener');
      else if (b.dataset.act === 'fitroute') this.fitRoute();
    });
  }

  open(d: DetailContent) {
    if (this.cur) this.close(true);
    this.cur = d;
    this.onOpen?.();
    this.root.hidden = false;
    this.root.querySelector<HTMLElement>('.fp-head')!.style.setProperty('--c', d.color);
    this.root.querySelector<HTMLElement>('.fp-ic')!.innerHTML = glyphSvg(d.glyph, d.color, 30);
    this.root.querySelector<HTMLElement>('.fp-title')!.textContent = d.title;
    this.root.querySelector<HTMLElement>('.fp-sub')!.textContent = d.subtitle ?? '';
    this.body.innerHTML = d.body + (d.source ? `<div class="fp-foot">${escapeHtml(d.source)}</div>` : '');
    const actions = this.root.querySelector<HTMLElement>('.fp-actions')!;
    const fit = d.route?.length ? `<button type="button" data-act="fitroute">Strecke zeigen</button>` : '';
    const link = d.link
      ? `<button type="button" class="${fit ? '' : 'full'}" data-link="${escapeHtml(d.link.url)}">${escapeHtml(d.link.label)}</button>`
      : '';
    actions.innerHTML = fit + link;
    this.showRoute(true);
  }

  close(keepHidden = false) {
    this.cur = null;
    this.body.innerHTML = '';
    this.root.hidden = true;
    // die Strecke vom letzten open() wieder von der Karte nehmen
    this.showRoute(false);
    void keepHidden;
  }

  get open_(): boolean {
    return !this.root.hidden;
  }

  /** route line (source/layer lazily created once, bright line below the labels) */
  private ensureRoute(map: MlMap) {
    if (map.getSource('detail-route')) return;
    map.addSource('detail-route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer(
      {
        id: 'detail-route-bg',
        type: 'line',
        source: 'detail-route',
        filter: ['==', '$type', 'LineString'],
        minzoom: 2,
        paint: { 'line-color': '#ffffff', 'line-width': 7, 'line-opacity': 0.45, 'line-blur': 2 },
      },
      'marker',
    );
    map.addLayer(
      {
        id: 'detail-route',
        type: 'line',
        source: 'detail-route',
        filter: ['==', '$type', 'LineString'],
        minzoom: 2,
        paint: {
          'line-color': ['coalesce', ['get', 'color'], '#e8833a'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 3, 2, 12, 5],
          'line-opacity': 0.9,
        },
      },
      'marker',
    );
  }

  /** draws the route when opening, empties it at close (map stays tidy) */
  private showRoute(on: boolean) {
    const map = this.h.map();
    if (!map || !map.isStyleLoaded()) return;
    const coords = on ? this.cur?.route : undefined;
    if (!coords && !this.hadRoute) return;
    this.ensureRoute(map);
    this.hadRoute = !!coords;
    (map.getSource('detail-route') as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: coords?.length
        ? [{ type: 'Feature' as const, geometry: { type: 'LineString' as const, coordinates: coords }, properties: { color: this.cur?.color } }]
        : [],
    });
  }

  /** remember whether a route was drawn, so a close can clear it even without a new route */
  private hadRoute = false;

  /** fit the map to the highlighted route */
  private fitRoute() {
    const map = this.h.map();
    const route = this.cur?.route;
    if (!map || !route?.length) return;
    let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
    for (const [x, y] of route) {
      if (x < w) w = x;
      if (y < s) s = y;
      if (x > e) e = x;
      if (y > n) n = y;
    }
    map.fitBounds(
      [
        [w, s],
        [e, n],
      ],
      { padding: 80, maxZoom: 13, duration: 600 },
    );
  }
}
