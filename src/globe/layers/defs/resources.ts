import { defineExtra } from '../types';

export default defineExtra({
  id: 'resources',
  order: 120,
  section: 'earth',
  cat: 'erde',
  label: 'Rohstoffvorkommen',
  hint: 'Öl, Gas, Kohle, Erze, Steine – weltweit (Wikidata), genauer ab Zoom 7 (USGS, BGR) und 10 (OpenStreetMap)',
  glyph: 'plant',
  icon: 'pick',
  color: '#8d6e63',
  layers: ['kor250', 'resources', 'resources-label'],
  clickLayers: ['resources'],
});
