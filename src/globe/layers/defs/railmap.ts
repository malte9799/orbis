import { defineExtra } from '../types';

export default defineExtra({
  id: 'railmap',
  order: 470,
  section: 'networks',
  cat: 'netze',
  label: 'Bahnnetz',
  hint: 'Gleise, Bahnhöfe, Strecken – OpenRailwayMap',
  glyph: 'train',
  icon: 'rail',
  color: '#78909c',
  layers: ['railmap'],
});
