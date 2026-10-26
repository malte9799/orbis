import { defineExtra } from '../types';

export default defineExtra({
  id: 'landcover',
  order: 190,
  section: 'earth',
  cat: 'erde',
  label: 'Landbedeckung',
  hint: 'Wald, Acker, Siedlung, Wasser (10 m) – ESA WorldCover',
  glyph: 'city',
  icon: 'map',
  color: '#4caf50',
  layers: ['landcover'],
});
