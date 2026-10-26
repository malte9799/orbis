import { defineExtra } from '../types';

export default defineExtra({
  id: 'nexrad',
  order: 260,
  section: 'ocean',
  cat: 'wetter',
  label: 'Radar USA (NEXRAD)',
  hint: 'Regenradar Mosaik der USA, ~5 min – NOAA via Iowa Environmental Mesonet',
  glyph: 'storm',
  icon: 'radar',
  color: '#ef5350',
  region: 'USA',
  layers: ['nexrad'],
});
