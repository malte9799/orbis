import { defineExtra } from '../types';

export default defineExtra({
  id: 'fmiradar',
  order: 280,
  section: 'ocean',
  cat: 'wetter',
  label: 'Radar Finnland',
  hint: 'Regenradar Finnland, 1 km, 5 min – Finnish Meteorological Institute (CC BY 4.0)',
  glyph: 'storm',
  icon: 'radar',
  color: '#1e88e5',
  region: 'FI',
  layers: ['fmiradar'],
});
