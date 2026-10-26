import { defineExtra } from '../types';

export default defineExtra({
  id: 'railspeed',
  order: 490,
  section: 'networks',
  cat: 'netze',
  label: 'Bahn: Geschwindigkeit',
  hint: 'zulässige Streckengeschwindigkeit – OpenRailwayMap',
  glyph: 'train',
  icon: 'rail',
  color: '#e53935',
  layers: ['railspeed'],
});
