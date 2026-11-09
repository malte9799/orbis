import { defineExtra } from '../types';
import { cardHtml } from '../../popup';
import { empty } from '../shared/geo';
import { ucdpFeatures } from '../shared/intel';
import { loadUcdpEvents, UCDP_ATTRIBUTION } from '../../../api/events';

const COLOR = '#e53935';
const NO_DATA = 'keine Daten – der Snapshot fehlt und es ist kein UCDP-Zugangstoken (Schlüssel „ucdp“) hinterlegt';

export default defineExtra({
  id: 'ucdp',
  order: 815,
  section: 'konflikt',
  cat: 'politik',
  label: 'Konfliktereignisse (UCDP)',
  hint: 'Gewaltereignisse mit Todesopfern aus dem Uppsala Conflict Data Program (UCDP GED), Kreisgröße nach Zahl der Toten. Funktioniert nur mit Snapshot oder UCDP-Token.',
  glyph: 'warn',
  icon: 'warn',
  color: COLOR,
  sources: { ucdp: `Konfliktereignisse: ${UCDP_ATTRIBUTION}` },
  addLayers({ add, hidden, setData }) {
    setData('ucdp', empty());
    add(
      {
        id: 'ucdp',
        type: 'circle',
        source: 'ucdp',
        layout: { ...hidden, 'circle-sort-key': ['get', 'deaths'] },
        paint: {
          'circle-color': COLOR,
          'circle-opacity': 0.6,
          'circle-radius': ['interpolate', ['linear'], ['sqrt', ['get', 'deaths']], 0, 2.5, 3, 5, 10, 10, 30, 18],
          'circle-stroke-color': '#3b0d0c',
          'circle-stroke-width': 0.8,
        },
      },
      'marker',
    );
  },
  enable(ctx) {
    ctx.loadOnce('ucdp', 6 * 3600000, async () => {
      try {
        const fc = ucdpFeatures(await loadUcdpEvents());
        ctx.setData('ucdp', fc);
        return { count: fc.features.length, note: fc.features.length ? undefined : NO_DATA };
      } catch {
        ctx.setData('ucdp', empty());
        return { count: 0, note: NO_DATA };
      }
    });
  },
  click({ p, pt }) {
    const deaths = Number(p.deaths) || 0;
    const sides = [p.side_a, p.side_b].filter((s) => typeof s === 'string' && s).join(' gegen ');
    return { type: 'html', html: cardHtml({ glyph: 'warn', color: COLOR, title: sides || 'Konfliktereignis', subtitle: `${deaths} Tote (alle Seiten und Zivilisten)`, source: UCDP_ATTRIBUTION, url: 'https://ucdp.uu.se/' }), lng: pt[0], lat: pt[1] };
  },
  layers: ['ucdp'],
  clickLayers: ['ucdp'],
});
