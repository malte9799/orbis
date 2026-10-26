import { defineExtra } from '../types';

export default defineExtra({
  id: 'jmanowcast',
  order: 340,
  section: 'ocean',
  cat: 'wetter',
  label: 'Radar-Nowcast Japan',
  hint: 'Niederschlagsprognose für die nächste Stunde – Japan Meteorological Agency',
  glyph: 'storm',
  icon: 'radar',
  color: '#ad1457',
  region: 'JP',
  layers: ['jmanowcast'],
});
