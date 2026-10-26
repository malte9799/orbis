import { defineExtra } from '../types';

export default defineExtra({
  id: 'aq',
  order: 50,
  section: 'europe',
  cat: 'wetter',
  label: 'Luftqualität & Pollen',
  hint: 'europäische Städte – Copernicus CAMS',
  glyph: 'air',
  icon: 'air',
  color: '#50c878',
  region: 'EU',
  layers: ['aq-circle', 'aq-text'],
  clickLayers: ['aq-circle'],
});
