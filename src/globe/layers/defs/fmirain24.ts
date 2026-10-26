import { defineExtra } from '../types';

export default defineExtra({
  id: 'fmirain24',
  order: 330,
  section: 'ocean',
  cat: 'wetter',
  label: 'Regensumme 24 h Finnland',
  hint: 'Radar-Niederschlagssumme der letzten 24 Stunden – Finnish Meteorological Institute',
  glyph: 'flood',
  icon: 'drop',
  color: '#0277bd',
  region: 'FI',
  layers: ['fmirain24'],
});
