import { defineExtra } from '../types';
import { cardHtml } from '../../popup';
import { loadIxps } from '../../../api/infra';

export default defineExtra({
  id: 'ixp',
  order: 570,
  section: 'infra',
  cat: 'netze',
  label: 'Internetknoten',
  hint: 'Internet Exchange Points – PeeringDB',
  glyph: 'cable',
  icon: 'cable',
  color: '#e040fb',
  sources: { ixp: 'Internetknoten: <a href="https://www.peeringdb.com/">PeeringDB</a>' },
  addLayers({ add, hidden }) {
    add(
      {
        id: 'ixp',
        type: 'circle',
        source: 'ixp',
        layout: { ...hidden, 'circle-sort-key': ['get', 'nets'] },
        paint: {
          'circle-color': '#e040fb',
          'circle-radius': ['interpolate', ['linear'], ['get', 'nets'], 0, 3, 100, 6, 1000, 12],
          'circle-opacity': 0.8,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1,
        },
      },
      'gauges',
    );
  },
  enable(ctx) {
    ctx.loadOnce('ixp', Infinity, async () => {
      const fc = await loadIxps();
      ctx.setData('ixp', fc);
      return { count: fc.features.length };
    });
  },
  click({ p, pt }) {
    return { type: 'html', html: cardHtml({ glyph: 'cable', color: '#e040fb', title: p.title, subtitle: p.subtitle, source: 'PeeringDB', url: p.url }), lng: pt[0], lat: pt[1] };
  },
  layers: ['ixp'],
  clickLayers: ['ixp'],
});
