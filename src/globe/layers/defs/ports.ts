import { defineExtra } from '../types';

export default defineExtra({
  id: 'ports',
  order: 430,
  section: 'infra',
  cat: 'erde',
  label: 'Häfen',
  hint: '~16.000 Seehäfen mit Größe, Tiefen und Umschlag – NGA World Port Index, UN/LOCODE',
  glyph: 'vessel',
  icon: 'layers',
  color: '#ffb74d',
  layers: ['ports', 'ports-label'],
  clickLayers: ['ports'],
});
