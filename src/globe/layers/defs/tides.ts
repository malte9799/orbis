import { defineExtra } from '../types';

export default defineExtra({
  id: 'tides',
  order: 230,
  section: 'ocean',
  cat: 'meer',
  label: 'Gezeitenpegel USA',
  hint: 'Wasserstand und nächste Hoch-/Niedrigwasser per Klick – NOAA CO-OPS',
  glyph: 'gauge',
  icon: 'wave',
  color: '#42a5f5',
  region: 'USA',
  layers: ['tides'],
  clickLayers: ['tides'],
});
