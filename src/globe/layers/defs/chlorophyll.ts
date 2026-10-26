import { defineExtra } from '../types';

export default defineExtra({
  id: 'chlorophyll',
  order: 250,
  section: 'ocean',
  cat: 'meer',
  label: 'Chlorophyll (Algen)',
  hint: 'Algenblüte im Meer, Satellit – NASA VIIRS',
  glyph: 'wind',
  icon: 'leaf',
  color: '#2e7d32',
  layers: ['chlorophyll-pace', 'chlorophyll-n20', 'chlorophyll'],
});
