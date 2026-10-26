import { defineExtra } from '../types';
import { gibsWms } from '../shared/tiles';

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
  rasters: [
      {
        id: 'aerosol',
        tiles: [gibsWms('MODIS_Combined_Value_Added_AOD')],
        attribution: 'Aerosole: NASA MODIS',
        maxzoom: 6,
        opacity: 0.75,
      },
  ],
  layers: ['aerosol'],
});
