import { defineExtra } from '../types';

export default defineExtra({
  id: 'rivers',
  order: 210,
  section: 'ocean',
  cat: 'meer',
  label: 'Flussabfluss & Hochwasser',
  hint: 'Abfluss in m³/s mit 7-Tage-Trend an Flüssen im Kartenausschnitt – GloFAS via Open-Meteo',
  glyph: 'flood',
  icon: 'flood',
  color: '#1e88e5',
  layers: ['rivers', 'rivers-label'],
  clickLayers: ['rivers'],
});
