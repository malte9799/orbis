import { defineExtra } from '../types';

export default defineExtra({
  id: 'lst',
  order: 160,
  section: 'earth',
  cat: 'erde',
  label: 'Bodentemperatur',
  hint: 'Landoberflächentemperatur am Tag – NASA MODIS',
  glyph: 'heat',
  icon: 'thermo',
  color: '#ff7043',
  layers: ['lst'],
});
