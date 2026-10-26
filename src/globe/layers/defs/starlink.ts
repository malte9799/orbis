import { defineExtra } from '../types';

export default defineExtra({
  id: 'starlink',
  order: 410,
  section: 'air',
  cat: 'verkehr',
  label: 'Starlink',
  hint: 'tausende Satelliten – CelesTrak',
  glyph: 'satellite',
  icon: 'orbit',
  color: '#7e8aa8',
  layers: ['sats-dot', 'sat-track'],
  clickLayers: ['sats-dot'],
});
