import { defineExtra } from '../types';

export default defineExtra({
  id: 'busnet',
  order: 480,
  section: 'networks',
  cat: 'netze',
  label: 'Bus- & ÖPNV-Netz',
  hint: 'Bus-, Tram-, U-Bahn- und Fährlinien mit Haltestellen (ab Stadtzoom) – OpenStreetMap',
  glyph: 'train',
  icon: 'bus',
  color: '#7e57c2',
  layers: ['busnet-line', 'busnet-label', 'busnet-stop'],
  clickLayers: ['busnet-line'],
});
