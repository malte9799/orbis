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
  layers: ['railelec'],
});
