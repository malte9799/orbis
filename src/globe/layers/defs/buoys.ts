import { defineExtra } from '../types';

export default defineExtra({
  id: 'buoys',
  order: 220,
  section: 'ocean',
  cat: 'meer',
  label: 'Messbojen',
  hint: 'Wellen, Wind, Luftdruck, Wassertemperatur live – NOAA NDBC (~900 Stationen)',
  glyph: 'gauge',
  icon: 'ocean',
  color: '#4fc3f7',
  layers: ['buoys', 'buoys-label'],
  clickLayers: ['buoys'],
});
