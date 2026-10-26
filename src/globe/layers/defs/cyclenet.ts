import { defineExtra } from '../types';

export default defineExtra({
  id: 'cyclenet',
  order: 510,
  section: 'networks',
  cat: 'netze',
  label: 'Radnetz',
  hint: 'Radfernwege & regionale Radrouten – Waymarked Trails',
  glyph: 'city',
  icon: 'road',
  color: '#43a047',
  rasters: [
    {
      id: 'cyclenet',
      tiles: ['https://tile.waymarkedtrails.org/cycling/{z}/{x}/{y}.png'],
      attribution: 'Radrouten: <a href="https://cycling.waymarkedtrails.org/">Waymarked Trails</a> (CC BY-SA)',
      maxzoom: 18,
      opacity: 0.95,
    },
  ],
  layers: ['cyclenet'],
});
