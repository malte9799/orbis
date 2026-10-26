import { defineExtra } from '../types';

export default defineExtra({
  id: 'alpr',
  order: 690,
  section: 'cams',
  cat: 'medien',
  label: 'Kennzeichen-Kameras',
  hint: 'ALPR/Flock-Kameras aus OpenStreetMap – DeFlock-Community',
  glyph: 'alpr',
  icon: 'cam',
  color: '#ef4444',
  layers: ['alpr-heat', 'alpr-dots', 'alpr-cone', 'alpr-cone-line', 'alpr'],
  clickLayers: ['alpr', 'alpr-dots-alpr-us', 'alpr-dots-alpr-ca'],
});
