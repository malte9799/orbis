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
  rasters: [
    {
      id: 'railmap',
      tiles: ['a', 'b', 'c'].map((sub) => `https://${sub}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png`),
      attribution: 'Bahnnetz: <a href="https://www.openrailwaymap.org/">OpenRailwayMap</a> (CC BY-SA)',
      maxzoom: 19,
      opacity: 0.85,
    },
  ],
  layers: ['railmap'],
});
