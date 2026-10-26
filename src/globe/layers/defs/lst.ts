import { defineExtra } from '../types';
import { gibsWms } from '../shared/tiles';

export default defineExtra({
  id: 'lst',
  order: 160,
  section: 'earth',
  cat: 'erde',
  label: 'Bodentemperatur',
  hint: 'Landoberflächentemperatur am Tag – NASA MODIS',
  glyph: 'heat',
  icon: 'thermo',
  color: '#ff7043',
  rasters: [
      {
        id: 'lst',
        tiles: [gibsWms('MODIS_Terra_Land_Surface_Temp_Day')],
        attribution: 'Bodentemperatur: NASA MODIS',
        maxzoom: 7,
        opacity: 0.75,
      },
  ],
  layers: ['lst'],
});
