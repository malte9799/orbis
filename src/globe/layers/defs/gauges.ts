import { defineExtra } from '../types';

export default defineExtra({
  id: 'gauges',
  order: 30,
  section: 'europe',
  cat: 'meer',
  label: 'Pegel & Hochwasser DE',
  hint: 'PEGELONLINE, Bundeswasserstraßen',
  glyph: 'gauge',
  icon: 'gauge',
  color: '#3d9ad1',
  region: 'DE',
  layers: ['gauges'],
  clickLayers: ['gauges'],
});
