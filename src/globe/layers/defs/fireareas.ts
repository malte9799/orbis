import { defineExtra } from '../types';

export default defineExtra({
  id: 'fireareas',
  order: 80,
  section: 'earth',
  cat: 'erde',
  label: 'Brandflächen USA',
  hint: 'aktuelle Waldbrand-Umrisse – NIFC',
  glyph: 'fire',
  icon: 'layers',
  color: '#ff5722',
  layers: ['fireareas-fill', 'fireareas-line'],
  clickLayers: ['fireareas-fill'],
});
