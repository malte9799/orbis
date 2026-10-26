import { defineExtra } from '../types';
import { chlDay, gibsWms } from '../shared/tiles';

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
  rasters: [
      {
        id: 'chlorophyll-pace',
        tiles: [gibsWms('OCI_PACE_Chlorophyll_a', chlDay)],
        attribution: 'Chlorophyll: NASA PACE / GIBS',
        maxzoom: 7,
        opacity: 0.8,
      },
      {
        id: 'chlorophyll-n20',
        tiles: [gibsWms('VIIRS_NOAA20_Chlorophyll_a', chlDay)],
        attribution: 'Chlorophyll: NASA VIIRS / GIBS',
        maxzoom: 7,
        opacity: 0.8,
      },
      {
        id: 'chlorophyll',
        tiles: [gibsWms('VIIRS_SNPP_L2_Chlorophyll_A', chlDay)],
        attribution: 'Chlorophyll: NASA VIIRS / GIBS',
        maxzoom: 7,
        opacity: 0.8,
      },
  ],
  layers: ['chlorophyll-pace', 'chlorophyll-n20', 'chlorophyll'],
});
