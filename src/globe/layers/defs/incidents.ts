import { defineExtra } from '../types';
import { FONT_BOLD } from '../../vector';
import { cardHtml } from '../../popup';
import { INCIDENTS, incidentById } from '../../../incidents';
import { escapeHtml, fmt } from '../../../util';

// Rekonstruktionen von Ereignissen (Flugunfälle …): ein Marker pro Ereignis (src/incidents/defs), Klick öffnet das
// Panel mit Wiedergabe. Spur, Ereignismarken und Flugzeug zeichnet die 3D-Ebene des Panels (src/incidents/layer3d.ts).

const COLOR = '#ef5350';
const SRC = 'Rekonstruktion: Flightradar24-Daten, Quellen im Panel';

export default defineExtra({
  id: 'incidents',
  order: 110,
  section: 'air',
  cat: 'gefahr',
  label: 'Ereignisse nachgestellt',
  hint: 'Flugbahn, Funk und Videos eines Unglücks zum Abspielen – Flightradar24 u. a.',
  glyph: 'plane',
  icon: 'warn',
  color: COLOR,
  sources: {
    incidents: SRC,
  },
  addLayers({ add, hidden }) {
    add(
      {
        id: 'incidents',
        type: 'symbol',
        source: 'incidents',
        layout: {
          ...hidden,
          'icon-image': 'glyph-plane',
          'icon-size': ['interpolate', ['linear'], ['zoom'], 1, 0.7, 8, 1],
          'icon-allow-overlap': true,
          'text-field': ['step', ['zoom'], '', 4, ['get', 'short']],
          'text-font': FONT_BOLD,
          'text-size': 10.5,
          'text-offset': [0, 1.4],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: { 'text-color': '#ffcdd2', 'text-halo-color': 'rgba(0,0,0,0.85)', 'text-halo-width': 1.3 },
      },
      'marker',
    );
  },
  enable(ctx) {
    ctx.setData('incidents', {
      type: 'FeatureCollection',
      features: INCIDENTS.map((d) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [d.lon, d.lat] },
        properties: { id: d.id, title: d.title, subtitle: d.subtitle, when: d.when, short: d.aircraft.reg },
      })),
    });
    ctx.set('incidents', { count: INCIDENTS.length, note: 'Klick auf einen Marker öffnet die Rekonstruktion' });
  },
  click({ ctx, p, pt }) {
    const d = incidentById(String(p.id));
    if (!d) return null;
    const btn = ctx.openIncident ? `<button class="btn small wide pop-incident" type="button" style="margin:8px 0 2px">Rekonstruktion abspielen</button>` : '';
    return {
      type: 'html',
      html: cardHtml({
        glyph: 'plane',
        color: COLOR,
        title: d.title,
        subtitle: `${d.subtitle} · ${fmt.dateTime(d.when)}`,
        description: d.summary,
        extra: `<div class="pop-sub">${escapeHtml(d.place)}</div>${btn}`,
        source: 'Flightradar24, Berichte',
        url: d.sources[0]?.url,
      }),
      lng: pt[0],
      lat: pt[1],
      after: (node: HTMLElement) => node.querySelector('.pop-incident')?.addEventListener('click', () => ctx.openIncident?.(d.id)),
    };
  },
  layers: ['incidents'],
  clickLayers: ['incidents'],
});
