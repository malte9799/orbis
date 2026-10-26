import { defineExtra } from '../types';
import { cardHtml } from '../../popup';
import { loadDatacenters } from '../../../api/infra';
import { FONT_BOLD } from '../../vector';

const COLOR = '#4dd0e1';

export default defineExtra({
  id: 'datacenters',
  order: 575,
  section: 'infra',
  cat: 'netze',
  label: 'Rechenzentren',
  hint: 'Rechenzentren und Colocation-Standorte – PeeringDB (groß: viele angeschlossene Netze), OpenStreetMap',
  glyph: 'cable',
  icon: 'grid',
  color: COLOR,
  sources: { datacenters: 'Rechenzentren: <a href="https://www.peeringdb.com/">PeeringDB</a>, © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap-Mitwirkende</a> (ODbL)' },
  addLayers({ add, hidden }) {
    add(
      {
        id: 'datacenters',
        type: 'circle',
        source: 'datacenters',
        // PeeringDB facilities above the plain OSM points, the big ones on top
        layout: { ...hidden, 'circle-sort-key': ['get', 'nets'] },
        paint: {
          'circle-color': ['match', ['get', 'src'], 'pdb', COLOR, '#80cbc4'],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, ['interpolate', ['linear'], ['get', 'nets'], 0, 1.5, 50, 3, 500, 7], 12, ['interpolate', ['linear'], ['get', 'nets'], 0, 5, 50, 7, 500, 12]],
          'circle-opacity': ['match', ['get', 'src'], 'pdb', 0.85, 0.6],
          'circle-stroke-color': '#0b1a1f',
          'circle-stroke-width': ['match', ['get', 'src'], 'pdb', 1, 0.5],
        },
      },
      'gauges',
    );
    add(
      {
        id: 'datacenters-label',
        type: 'symbol',
        source: 'datacenters',
        minzoom: 11,
        layout: { ...hidden, 'text-field': ['get', 'title'], 'text-font': FONT_BOLD, 'text-size': 10, 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-optional': true, 'symbol-sort-key': ['-', 0, ['get', 'nets']] },
        paint: { 'text-color': '#b2ebf2', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1.2 },
      },
      'gauges',
    );
  },
  enable(ctx) {
    ctx.loadOnce('datacenters', Infinity, async () => {
      const fc = await loadDatacenters();
      ctx.setData('datacenters', fc);
      return { count: fc.features.length, note: fc.note };
    });
  },
  click({ p, pt }) {
    return { type: 'html', html: cardHtml({ glyph: 'cable', color: COLOR, title: p.title, subtitle: p.subtitle, source: p.source, url: p.url }), lng: pt[0], lat: pt[1] };
  },
  layers: ['datacenters', 'datacenters-label'],
  clickLayers: ['datacenters'],
});
