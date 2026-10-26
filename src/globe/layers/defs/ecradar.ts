import { defineExtra } from '../types';

export default defineExtra({
  id: 'ecradar',
  order: 270,
  section: 'ocean',
  cat: 'wetter',
  label: 'Radar Kanada',
  hint: 'Regenradar Kanada, 1 km, ~6 min – Environment Canada',
  glyph: 'storm',
  icon: 'radar',
  color: '#e53935',
  region: 'CA',
  layers: ['ecradar'],
});
