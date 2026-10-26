import { defineExtra } from '../types';
import { AP3D_LAYERS, AP3D_HIT_LAYER } from '../../airport3d';

export default defineExtra({
  id: 'airport3d',
  order: 390,
  section: 'air',
  cat: 'verkehr',
  label: 'Flughafen 3D',
  hint: 'Rollwege, Terminals und Flugzeuge in 3D ab Zoomstufe 11 – OpenStreetMap, ADS-B (zum Kippen Strg + Ziehen)',
  glyph: 'airport',
  icon: 'plane2',
  color: '#ff6a2b',
  layers: AP3D_LAYERS,
  clickLayers: [AP3D_HIT_LAYER],
});
