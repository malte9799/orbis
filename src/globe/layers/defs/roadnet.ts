import { defineExtra } from '../types';
import { FONT_BOLD } from '../../vector';

export default defineExtra({
  id: 'roadnet',
  order: 460,
  section: 'networks',
  cat: 'netze',
  label: 'Straßennetz',
  hint: 'Autobahnen bis Kreisstraßen mit Nummern – OpenStreetMap',
  glyph: 'city',
  icon: 'road',
  color: '#f57c00',
  addLayers(ctx) {
    const { add, hidden } = ctx;
    const road = (id: string, cls: string[], minzoom: number, color: string, w: [number, number, number, number]) =>
      add(
        {
          id,
          type: 'line',
          source: 'ofm',
          'source-layer': 'transportation',
          minzoom,
          filter: ['all', ['in', ['get', 'class'], ['literal', cls]], ['!=', ['get', 'ramp'], 1]],
          layout: { ...hidden, 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': color,
            'line-width': ['interpolate', ['exponential', 1.5], ['zoom'], w[0], w[1], w[2], w[3]],
            'line-opacity': ['case', ['==', ['get', 'brunnel'], 'tunnel'], 0.45, 0.9],
          },
        },
        'lbl-border-country',
      );
    road('road-secondary', ['secondary'], 8, '#ffe082', [8, 0.6, 14, 4]);
    road('road-primary', ['primary'], 6, '#ffb74d', [6, 0.6, 14, 5]);
    road('road-trunk', ['trunk'], 4, '#ff8a65', [4, 0.6, 14, 6]);
    road('road-motorway', ['motorway'], 3, '#e53935', [3, 0.7, 14, 7]);
    add(
      {
        id: 'road-ref',
        type: 'symbol',
        source: 'ofm',
        'source-layer': 'transportation_name',
        minzoom: 6,
        filter: ['all', ['has', 'ref'], ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary']]]],
        layout: {
          ...hidden,
          'symbol-placement': 'line',
          'symbol-spacing': 400,
          'text-field': ['get', 'ref'],
          'text-font': FONT_BOLD,
          'text-size': 10,
          'text-rotation-alignment': 'viewport',
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': ['match', ['get', 'class'], 'motorway', '#1565c0', 'trunk', '#c62828', '#ef6c00'],
          'text-halo-width': 3,
        },
      },
      'marker',
    );
  },
  layers: ['road-secondary', 'road-primary', 'road-trunk', 'road-motorway', 'road-ref'],
});
