import { defineExtra } from '../types';

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
  layers: ['ndvi'],
});
