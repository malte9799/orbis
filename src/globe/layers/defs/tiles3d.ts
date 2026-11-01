import { defineExtra } from '../types';
import { Tiles3DLayer } from '../../tiles3d';

// The tile sources are selected from the source bar (globe/tiles3d.ts); paid source keys live in
// the settings panel (settings/keys). The debug3d page is the catalog and diagnostic view.
export default defineExtra({
  id: 'tiles3d',
  order: 395,
  section: 'infra',
  cat: 'erde',
  label: '3D-Kacheln',
  hint: '3D-Gebäude, Stadtmodelle und Oberflächen aus weltweiten und regionalen OGC-3D-Tiles-Quellen',
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
