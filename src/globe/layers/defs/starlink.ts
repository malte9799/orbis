import { defineExtra } from '../types';
import { satClick, startSatellites } from '../shared/sats';

export default defineExtra({
  id: 'starlink',
  order: 410,
  section: 'air',
  cat: 'verkehr',
  label: 'Starlink',
  hint: 'tausende Satelliten – CelesTrak',
  glyph: 'satellite',
  icon: 'orbit',
  color: '#7e8aa8',
  enable(ctx) {
    startSatellites(ctx);
  },
  click: satClick,
  layers: ['sats-dot', 'sat-track'],
  clickLayers: ['sats-dot'],
});
