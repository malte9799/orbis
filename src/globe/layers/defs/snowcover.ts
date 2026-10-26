import { defineExtra } from '../types';

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
  layers: ['snowcover'],
});
