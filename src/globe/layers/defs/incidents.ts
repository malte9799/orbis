import { defineExtra, type ExtraCtx } from '../types';
import { FONT_BOLD } from '../../vector';
import { cardHtml } from '../../popup';
import { INCIDENTS, incidentById } from '../../../incidents';
import { profileOf } from '../../../incidents/kind';
import { escapeHtml, fmt } from '../../../util';

// Rekonstruktionen von Ereignissen (Flugunfälle …): ein Marker pro Ereignis (src/incidents/defs), Klick öffnet das
// Panel mit Wiedergabe. Spur, Ereignismarken und Flugzeug zeichnet die 3D-Ebene des Panels (src/incidents/layer3d.ts).

const COLOR = '#ef5350';
const SRC = 'Rekonstruktion: Flightradar24, US-Küstenwache u. a., Quellen im Panel';

/** Name groß, darunter die Kennung kleiner (mehrzeiliges Label) */
const LABEL = ['format', ['get', 'name'], {}, '\n', {}, ['get', 'short'], { 'font-scale': 0.75 }] as never;
const NO_LABEL = ['format', ''] as never;
/** Marker groß, solange keine Rekonstruktion läuft; währenddessen klein (die Spur zeigt das Ereignis selbst) */
const ICON_BIG = ['interpolate', ['linear'], ['zoom'], 1, 1.5, 8, 2.1] as never;
const ICON_SMALL = ['interpolate', ['linear'], ['zoom'], 1, 0.7, 8, 1] as never;

/** schaltet den Marker zwischen groß (ohne Simulation) und klein (Rekonstruktion offen) */
function setSimulating(ctx: ExtraCtx, on: boolean) {
  if (!ctx.map.getLayer('incidents')) return;
  ctx.map.setLayoutProperty('incidents', 'icon-size', on ? ICON_SMALL : ICON_BIG);
  ctx.map.setLayoutProperty('incidents', 'text-offset', on ? [0, 1.4] : [0, 1.5]);
}

export const incidentsApi = { setSimulating };

export default defineExtra({
  id: 'incidents',
  order: 110,
  section: 'air',
  cat: 'gefahr',
  label: 'Ereignisse nachgestellt',
  hint: 'Flugbahn bzw. Tauchspur, Funk, Nachrichten und Videos eines Unglücks zum Abspielen',
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
          'icon-image': ['concat', 'glyph-', ['get', 'glyph']],
          'icon-size': ICON_BIG,
          'icon-allow-overlap': true,
          'text-field': ['step', ['zoom'], NO_LABEL, 3, LABEL],
          'text-font': FONT_BOLD,
          'text-size': 12.5,
          // „Learjet-Absturz“ bleibt in einer Zeile (Standard bricht bei 10 em um)
          'text-max-width': 20,
          'text-offset': [0, 1.5],
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
        properties: { id: d.id, title: d.title, name: d.shortTitle ?? d.title, subtitle: d.subtitle, when: d.when, short: d.craft.reg, glyph: profileOf(d).glyph },
      })),
    });
    ctx.set('incidents', { count: INCIDENTS.length, note: 'Klick auf einen Marker öffnet die Rekonstruktion' });
  },
  // Ebene ausgeblendet: Rekonstruktion und ein darin laufendes Video enden
  disable(ctx) {
    ctx.closeIncident?.();
  },
  click({ ctx, p, pt }) {
    const d = incidentById(String(p.id));
    if (!d) return null;
    const btn = ctx.openIncident ? `<button class="btn small wide pop-incident" type="button" style="margin:8px 0 2px">Rekonstruktion abspielen</button>` : '';
    return {
      type: 'html',
      html: cardHtml({
        glyph: profileOf(d).glyph,
        color: COLOR,
        title: d.title,
        subtitle: `${d.subtitle} · ${fmt.dateTime(d.when)}`,
        description: d.summary,
        extra: `<div class="pop-sub">${escapeHtml(d.place)}</div>${btn}`,
        source: d.craft.hex ? 'Flightradar24, Berichte' : 'Berichte, Quellen im Panel',
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
