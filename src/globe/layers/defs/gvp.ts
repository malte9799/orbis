import { defineExtra } from '../types';
import { loadGvpVolcanoes } from '../../../api/earth';

export default defineExtra({
  id: 'gvp',
  order: 70,
  section: 'earth',
  cat: 'erde',
  label: 'Alle Vulkane',
  hint: '~1.300 Vulkane mit letztem Ausbruch – Smithsonian GVP',
  glyph: 'volcano',
  icon: 'layers',
  color: '#ff7043',
  sources: { gvp: 'Vulkane: <a href="https://volcano.si.edu/">Smithsonian GVP</a>' },
  addLayers({ add, hidden }) {
    add(
      {
        id: 'gvp',
        type: 'circle',
        source: 'gvp',
        layout: { ...hidden, 'circle-sort-key': ['match', ['get', 'state'], 'recent', 3, 'historic', 2, 1] },
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, ['match', ['get', 'state'], 'recent', 4.5, 'historic', 3, 2], 8, ['match', ['get', 'state'], 'recent', 9, 'historic', 7, 5]],
          'circle-stroke-color': ['match', ['get', 'state'], 'recent', '#ffffff', 'rgba(0,0,0,0.5)'],
          'circle-stroke-width': 1,
        },
      },
      'gauges',
    );
  },
  enable(ctx) {
    ctx.loadOnce('gvp', Infinity, async () => {
      const fc = await loadGvpVolcanoes();
      ctx.setData('gvp', fc);
      const recent = fc.features.filter((f) => f.properties?.state === 'recent').length;
      return { count: fc.features.length, note: `${recent} mit Ausbruch seit letztem Jahr (rot)` };
    });
  },
  click({ p, pt, html }) {
    return { type: 'html', html: html('volcano', String(p.color)), lng: pt[0], lat: pt[1] };
  },
  layers: ['gvp'],
  clickLayers: ['gvp'],
});
