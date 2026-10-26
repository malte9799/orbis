import { defineExtra } from '../types';

export default defineExtra({
  id: 'hikenet',
  order: 520,
  section: 'networks',
  cat: 'netze',
  label: 'Wandernetz',
  hint: 'Wanderwege – Waymarked Trails',
  glyph: 'city',
  icon: 'mountain',
  color: '#8d6e63',
  rasters: [
    {
      id: 'hikenet',
      tiles: ['https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png'],
      attribution: 'Wanderwege: <a href="https://hiking.waymarkedtrails.org/">Waymarked Trails</a> (CC BY-SA)',
      maxzoom: 18,
      opacity: 0.95,
    },
  ],
  layers: ['hikenet'],
});
