import { defineExtra } from '../types';

export default defineExtra({
  id: 'roadnet',
  order: 460,
  section: 'networks',
  cat: 'netze',
  label: 'Straßennetz',
  hint: 'Autobahnen bis Kreisstraßen mit Nummern – OpenStreetMap',
  glyph: 'city',
  icon: 'road',
  color: '#f57c00',
  layers: ['road-secondary', 'road-primary', 'road-trunk', 'road-motorway', 'road-ref'],
});
