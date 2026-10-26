import { defineExtra } from '../types';

export default defineExtra({
  id: 'sats',
  order: 400,
  section: 'air',
  cat: 'verkehr',
  label: 'Satelliten',
  hint: 'ISS, Wetter-, GPS-, Galileo-Satelliten',
  glyph: 'satellite',
  icon: 'orbit',
  color: '#b388ff',
  layers: ['sats-icon', 'sats-label', 'sat-track'],
  clickLayers: ['sats-icon'],
});
