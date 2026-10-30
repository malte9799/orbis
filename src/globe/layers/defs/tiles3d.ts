import { defineExtra } from '../types';
import { Tiles3DLayer } from '../../tiles3d';

// The tile sources are tried out with the debug bar the layer puts along the bottom edge of the map
// (globe/tiles3d.ts); the keys of the paid ones live in the settings panel (settings/keys).
export default defineExtra({
  id: 'tiles3d',
  order: 395,
  section: 'infra',
  cat: 'erde',
  label: '3D-Kacheln',
  hint: '3D-Gebäude und Gelände (OGC 3D Tiles): basemap.de, Re:Earth, Cesium, Google – Quellen über die Debug-Leiste am unteren Rand',
  glyph: 'city',
  icon: 'building',
  color: '#4285f4',
  layers: [],
  enable(ctx) {
    if (ctx.map.getLayer('tiles3d')) return;
    ctx.map.addLayer(new Tiles3DLayer({ note: (note) => ctx.set('tiles3d', { note }) }));
  },
  disable(ctx) {
    if (ctx.map.getLayer('tiles3d')) ctx.map.removeLayer('tiles3d');
  },
});
