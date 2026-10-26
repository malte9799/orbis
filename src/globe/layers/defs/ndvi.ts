import { defineExtra } from '../types';
import { gibsWms } from '../shared/tiles';

export default defineExtra({
  id: 'ndvi',
  order: 150,
  section: 'earth',
  cat: 'erde',
  label: 'Vegetation',
  hint: 'Pflanzenwachstum (NDVI, 8 Tage) – NASA MODIS',
  glyph: 'wind',
  icon: 'leaf',
  color: '#66bb6a',
  rasters: [
      {
        id: 'ndvi',
        tiles: [gibsWms('MODIS_Terra_NDVI_8Day')],
        attribution: 'Vegetation: NASA MODIS NDVI',
        maxzoom: 9,
        opacity: 0.75,
      },
  ],
  layers: ['ndvi'],
});
