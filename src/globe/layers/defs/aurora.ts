import { defineExtra } from '../types';

export default defineExtra({
  id: 'aurora',
  order: 60,
  section: 'earth',
  cat: 'wetter',
  label: 'Polarlicht',
  hint: 'Vorhersage für die nächste Stunde – NOAA SWPC',
  glyph: 'aurora',
  icon: 'aurora',
  color: '#3ddc84',
  layers: ['aurora'],
});
