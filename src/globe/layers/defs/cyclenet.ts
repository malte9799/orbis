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
  layers: ['cyclenet'],
});
