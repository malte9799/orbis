import { defineExtra } from '../types';
import { gibsWms } from '../shared/tiles';

export default defineExtra({
  id: 'snowcover',
  order: 170,
  section: 'earth',
  cat: 'erde',
  label: 'Schneedecke (Satellit)',
  hint: 'Schneebedeckung – NASA MODIS',
  glyph: 'ice',
  icon: 'snow',
  color: '#e1f5fe',
  rasters: [
      {
        id: 'snowcover',
        tiles: [gibsWms('MODIS_Terra_NDSI_Snow_Cover')],
        attribution: 'Schneedecke: NASA MODIS',
        maxzoom: 8,
        opacity: 0.85,
      },
  ],
  layers: ['snowcover'],
});
