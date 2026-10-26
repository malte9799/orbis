import { defineExtra } from '../types';

export default defineExtra({
  id: 'shipping',
  order: 550,
  section: 'infra',
  cat: 'netze',
  label: 'Schiffsrouten & Fähren',
  hint: 'Hauptschifffahrtswege, Fährlinien (OSM)',
  glyph: 'ship',
  icon: 'ship',
  color: '#26c6da',
  layers: ['ship-lanes', 'ferries'],
});
