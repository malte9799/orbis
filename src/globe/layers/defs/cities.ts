import { defineExtra } from '../types';

export default defineExtra({
  id: 'cities',
  order: 10,
  section: 'europe',
  cat: 'wetter',
  label: 'Städtewetter',
  hint: 'aktuelles Wetter in ~200 Städten',
  glyph: 'city',
  icon: 'city',
  color: '#5b9dff',
  layers: ['cities'],
  clickLayers: ['cities'],
});
