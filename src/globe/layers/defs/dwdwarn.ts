import { defineExtra } from '../types';

export default defineExtra({
  id: 'dwdwarn',
  order: 20,
  section: 'europe',
  cat: 'gefahr',
  label: 'Unwetterwarnungen DE',
  hint: 'Deutscher Wetterdienst, amtlich',
  glyph: 'warn',
  icon: 'warn',
  color: '#e53935',
  region: 'DE',
  layers: ['dwd-warn-fill', 'dwd-warn-line'],
  clickLayers: ['dwd-warn-fill'],
});
