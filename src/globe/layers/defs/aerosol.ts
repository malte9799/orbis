import { defineExtra } from '../types';

export default defineExtra({
  id: 'aerosol',
  order: 180,
  section: 'earth',
  cat: 'erde',
  label: 'Aerosole & Staub',
  hint: 'Dunst, Rauch, Saharastaub (AOD) – NASA MODIS',
  glyph: 'dust',
  icon: 'air',
  color: '#bcaaa4',
  layers: ['aerosol'],
});
