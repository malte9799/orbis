import { defineExtra } from '../types';

export default defineExtra({
  id: 'plates',
  order: 140,
  section: 'earth',
  cat: 'erde',
  label: 'Tektonische Platten',
  hint: 'Plattengrenzen (PB2002, Bird 2003)',
  glyph: 'quake',
  icon: 'quake',
  color: '#ef5350',
  layers: ['plates'],
  clickLayers: ['plates'],
});
