import { defineExtra } from '../types';

export default defineExtra({
  id: 'jmaradar',
  order: 300,
  section: 'ocean',
  cat: 'wetter',
  label: 'Radar Japan',
  hint: 'Niederschlagsradar Japan, 5 min – Japan Meteorological Agency',
  glyph: 'storm',
  icon: 'radar',
  color: '#c62828',
  region: 'JP',
  layers: ['jmaradar'],
});
