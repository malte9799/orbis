import { defineExtra } from '../types';

export default defineExtra({
  id: 'bathymetry',
  order: 240,
  section: 'ocean',
  cat: 'meer',
  label: 'Meerestiefe',
  hint: 'Bathymetrie weltweit – GEBCO; Europa genauer – EMODnet',
  glyph: 'tsunami',
  icon: 'ocean',
  color: '#1565c0',
  layers: ['emodnet', 'gebco'],
});
