import { defineExtra } from '../types';

export default defineExtra({
  id: 'pipelines',
  order: 540,
  section: 'infra',
  cat: 'netze',
  label: 'Öl- & Gaspipelines',
  hint: 'Pipelines für Gas, Öl, Wasserstoff (ab Zoom 8) – OpenStreetMap',
  glyph: 'cable',
  icon: 'pipe',
  color: '#29b6f6',
  layers: ['pipelines'],
  clickLayers: ['pipelines'],
});
