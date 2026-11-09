import { defineExtra } from '../types';
import { cardHtml } from '../../popup';
import { empty } from '../shared/geo';
import { gdeltFeatures } from '../shared/intel';
import { loadGdeltEvents, GDELT_ATTRIBUTION } from '../../../api/events';

const COLOR = '#ff7043';

export default defineExtra({
  id: 'gdelt',
  order: 810,
  section: 'konflikt',
  cat: 'politik',
  label: 'Presse-Ereignisse (GDELT)',
  hint: 'Orte von Konflikt-, Protest- und Militärmeldungen der letzten 24 Stunden aus der weltweiten Presse (GDELT). Automatisch verortet, nicht verifiziert – Klick verlinkt den Artikel.',
  glyph: 'placard',
  icon: 'warn',
  color: COLOR,
  sources: { gdelt: `Presse-Ereignisse: ${GDELT_ATTRIBUTION}` },
  addLayers({ add, hidden, setData }) {
    setData('gdelt', empty());
    add(
      {
        id: 'gdelt',
        type: 'circle',
        source: 'gdelt',
        layout: hidden,
        paint: {
          'circle-color': COLOR,
          'circle-opacity': 0.7,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 2.5, 8, 5, 12, 8],
          'circle-stroke-color': '#3e1a0f',
          'circle-stroke-width': 0.8,
        },
      },
      'marker',
    );
  },
  enable(ctx) {
    ctx.loadOnce('gdelt', 30 * 60000, async () => {
      const fc = gdeltFeatures(await loadGdeltEvents());
      ctx.setData('gdelt', fc);
      return { count: fc.features.length, note: fc.features.length ? 'letzte 24 h, automatisch verortet' : 'derzeit keine Meldungen' };
    });
  },
  click({ p, pt }) {
    const name = String(p.name ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return { type: 'html', html: cardHtml({ glyph: 'placard', color: COLOR, title: name || 'Presse-Ereignis', subtitle: 'Pressemeldung der letzten 24 h – automatisch verortet, nicht verifiziert', source: GDELT_ATTRIBUTION, url: p.url }), lng: pt[0], lat: pt[1] };
  },
  layers: ['gdelt'],
  clickLayers: ['gdelt'],
});
