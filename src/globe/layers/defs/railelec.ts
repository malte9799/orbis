import { defineExtra } from '../types';

export default defineExtra({
  id: 'railelec',
  order: 500,
  section: 'networks',
  cat: 'netze',
  label: 'Bahn: Elektrifizierung',
  hint: 'Stromsysteme der Strecken – OpenRailwayMap',
  glyph: 'plant',
  icon: 'power',
  color: '#fdd835',
  rasters: [
    {
      id: 'railelec',
      tiles: ['a', 'b', 'c'].map((sub) => `https://${sub}.tiles.openrailwaymap.org/electrification/{z}/{x}/{y}.png`),
      attribution: 'Elektrifizierung: <a href="https://www.openrailwaymap.org/">OpenRailwayMap</a> (CC BY-SA)',
      maxzoom: 19,
      opacity: 0.9,
    },
  ],
  layers: ['railelec'],
});
