import { defineExtra } from '../types';
import { applyAis, createShips3d, enableShips, getState } from '../shared/ships';
import { FONT_REGULAR } from '../../vector';

export default defineExtra({
  id: 'ships',
  order: 420,
  section: 'infra',
  cat: 'verkehr',
  label: 'Schiffe live (AIS)',
  hint: 'Ostsee frei (Fintraffic), weltweit über den Daten-Proxy oder mit eigenem aisstream-Schlüssel',
  glyph: 'vessel',
  icon: 'ship',
  color: '#4dd0e1',
  sources: { ships: 'AIS: <a href="https://www.digitraffic.fi/">Fintraffic</a> (CC BY 4.0), <a href="https://aisstream.io/">aisstream.io</a>' },
  addLayers(ctx) {
    const { add, hidden } = ctx;
    add(
      {
        id: 'ships',
        type: 'symbol',
        source: 'ships',
        layout: {
          ...hidden,
          'icon-image': 'sil-vessel',
          'icon-size': ['interpolate', ['linear'], ['zoom'], 3, 0.45, 8, 0.8, 12, 1.15],
          'icon-rotate': ['get', 'rot'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'text-field': ['step', ['zoom'], '', 10, ['get', 'name']],
          'text-font': FONT_REGULAR,
          'text-size': 10,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: {
          'icon-color': ['get', 'color'],
          'icon-opacity': ['case', ['get', 'moving'], 1, 0.6],
          'icon-halo-color': 'rgba(0,0,0,0.7)',
          'icon-halo-width': 1,
          'text-color': '#e0f7fa',
          'text-halo-color': 'rgba(0,0,0,0.8)',
          'text-halo-width': 1.2,
        },
      },
      'marker',
    );
    createShips3d(ctx);
  },
  click({ p, pt }) {
    return { type: 'ship', mmsi: Number(p.mmsi), lng: pt[0], lat: pt[1] };
  },
  apply: applyAis,
  enable: enableShips,
  onMoveEnd(ctx) {
    getState(ctx).ais?.start(ctx.viewBounds(4));
  },
  layers: ['ships'],
  clickLayers: ['ships'],
});
