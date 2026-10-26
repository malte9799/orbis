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
  rasters: [
    {
      id: 'railspeed',
      tiles: ['a', 'b', 'c'].map((sub) => `https://${sub}.tiles.openrailwaymap.org/maxspeed/{z}/{x}/{y}.png`),
      attribution: 'Streckengeschwindigkeit: <a href="https://www.openrailwaymap.org/">OpenRailwayMap</a> (CC BY-SA)',
      maxzoom: 19,
      opacity: 0.9,
    },
  ],
  layers: ['railspeed'],
});
