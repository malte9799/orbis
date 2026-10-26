import { defineExtra } from '../types';
import { loadShippingLanes } from '../../../api/infra';

export default defineExtra({
  id: 'shipping',
  order: 550,
  section: 'infra',
  cat: 'netze',
  label: 'Schiffsrouten & Fähren',
  hint: 'Hauptschifffahrtswege, Fährlinien (OSM)',
  glyph: 'ship',
  icon: 'ship',
  color: '#26c6da',
  sources: { 'ship-lanes': 'Schiffsrouten: <a href="https://doi.org/10.5281/zenodo.6361763">P. Benden, CC BY 4.0</a>' },
  addLayers({ add, hidden }) {
    // lines: above weather, below labels
    add(
      {
        id: 'ship-lanes',
        type: 'line',
        source: 'ship-lanes',
        layout: { ...hidden, 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': 'rgba(110, 210, 255, 0.75)',
          'line-width': ['match', ['get', 'type'], 'major', 2.2, 'middle', 1.4, 0.8],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 1, 0.6, 6, 0.9],
        },
      },
      'lbl-border-country',
    );
    add(
      {
        id: 'ferries',
        type: 'line',
        source: 'ofm',
        'source-layer': 'transportation',
        minzoom: 4,
        filter: ['==', ['get', 'class'], 'ferry'],
        layout: hidden,
        paint: { 'line-color': 'rgba(150, 240, 255, 0.85)', 'line-width': 1.2, 'line-dasharray': [3, 2] },
      },
      'lbl-border-country',
    );
  },
  enable(ctx) {
    ctx.loadOnce('shipping', Infinity, async () => {
      const fc = await loadShippingLanes();
      ctx.setData('ship-lanes', fc);
      return { count: fc.features.length };
    });
  },
  layers: ['ship-lanes', 'ferries'],
});
