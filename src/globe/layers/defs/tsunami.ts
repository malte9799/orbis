import { defineExtra } from '../types';

export default defineExtra({
  id: 'tsunami',
  order: 90,
  section: 'earth',
  cat: 'gefahr',
  label: 'Tsunami-Meldungen',
  hint: 'NOAA-Tsunamiwarnzentren, letzte 7 Tage',
  glyph: 'tsunami',
  icon: 'tsunami',
  color: '#1e88e5',
  layers: ['tsunami-ring', 'tsunami'],
  clickLayers: ['tsunami'],
});
