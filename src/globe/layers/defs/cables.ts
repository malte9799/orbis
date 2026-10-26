import { defineExtra } from '../types';

export default defineExtra({
  id: 'cables',
  order: 560,
  section: 'infra',
  cat: 'netze',
  label: 'Seekabel',
  hint: 'Unterseekabel (unvollständig) – OpenStreetMap',
  glyph: 'cable',
  icon: 'cable',
  color: '#9c6bff',
  layers: ['cables'],
  clickLayers: ['cables'],
});
