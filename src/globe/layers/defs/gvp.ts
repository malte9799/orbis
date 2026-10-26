import { defineExtra } from '../types';

export default defineExtra({
  id: 'gvp',
  order: 70,
  section: 'earth',
  cat: 'erde',
  label: 'Alle Vulkane',
  hint: '~1.300 Vulkane mit letztem Ausbruch – Smithsonian GVP',
  glyph: 'volcano',
  icon: 'layers',
  color: '#ff7043',
  layers: ['gvp'],
  clickLayers: ['gvp'],
});
