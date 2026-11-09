import { defineExtra } from '../types';
import { cardHtml } from '../../popup';
import { empty } from '../shared/geo';
import { portwatchFeatures } from '../shared/intel';
import { loadPortWatch, PORTWATCH_ATTRIBUTION } from '../../../api/portwatch';
import { FONT_BOLD } from '../../vector';

const COLOR = '#26c6da';
const CHOKE = '#ff7043';

export default defineExtra({
  id: 'portwatch',
  order: 435,
  section: 'infra',
  cat: 'verkehr',
  label: 'Häfen & Chokepoints (PortWatch)',
  hint: 'Hafenaktivität und strategische Meerengen (Chokepoints, orange) nach IMF PortWatch; Größe nach Schiffsaufkommen.',
  glyph: 'ship',
  icon: 'ship',
  color: COLOR,
  sources: { portwatch: `Häfen & Chokepoints: ${PORTWATCH_ATTRIBUTION}` },
  addLayers({ add, hidden, setData }) {
    setData('portwatch', empty());
    add(
      {
        id: 'portwatch',
        type: 'circle',
        source: 'portwatch',
        layout: { ...hidden, 'circle-sort-key': ['+', ['get', 'n'], ['match', ['get', 'kind'], 'choke', 1e9, 0]] },
        paint: {
          'circle-color': ['match', ['get', 'kind'], 'choke', CHOKE, COLOR],
          'circle-opacity': ['match', ['get', 'kind'], 'choke', 0.9, 0.7],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, ['interpolate', ['linear'], ['get', 'n'], 0, 2, 5000, 4, 100000, 8], 10, ['interpolate', ['linear'], ['get', 'n'], 0, 4, 5000, 7, 100000, 14]],
          'circle-stroke-color': ['match', ['get', 'kind'], 'choke', '#fff3e0', '#06242a'],
          'circle-stroke-width': ['match', ['get', 'kind'], 'choke', 1.4, 0.6],
        },
      },
      'marker',
    );
    add(
      {
        id: 'portwatch-label',
        type: 'symbol',
        source: 'portwatch',
        minzoom: 3,
        filter: ['==', ['get', 'kind'], 'choke'],
        layout: { ...hidden, 'text-field': ['get', 'name'], 'text-font': FONT_BOLD, 'text-size': 11, 'text-offset': [0, 1.2], 'text-anchor': 'top', 'text-optional': true },
        paint: { 'text-color': '#ffccbc', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1.2 },
      },
      'marker',
    );
  },
  enable(ctx) {
    ctx.loadOnce('portwatch', 6 * 3600000, async () => {
      const fc = portwatchFeatures(await loadPortWatch());
      ctx.setData('portwatch', fc);
      return { count: fc.features.length };
    });
  },
  click({ p, pt }) {
    const choke = p.kind === 'choke';
    const n = Number(p.n) || 0;
    const sub = [choke ? 'Chokepoint (Meerenge)' : 'Hafen', p.country, p.cls ? `Klasse ${p.cls}` : '', n ? `${n.toLocaleString('de-DE')} Schiffe insgesamt` : 'keine Schiffszahl'].filter(Boolean).join(' · ');
    return { type: 'html', html: cardHtml({ glyph: 'ship', color: choke ? CHOKE : COLOR, title: p.name, subtitle: sub, source: PORTWATCH_ATTRIBUTION, url: 'https://portwatch.imf.org/' }), lng: pt[0], lat: pt[1] };
  },
  layers: ['portwatch', 'portwatch-label'],
  clickLayers: ['portwatch'],
});
