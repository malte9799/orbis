import { defineExtra } from '../types';

export default defineExtra({
  id: 'dwdnowcast',
  order: 310,
  section: 'ocean',
  cat: 'wetter',
  label: 'Radar-Nowcast Deutschland',
  hint: 'Radar-Vorhersage für die nächsten 2 Stunden, 1 km – Deutscher Wetterdienst (WN-Produkt)',
  glyph: 'storm',
  icon: 'radar',
  color: '#7b1fa2',
  region: 'DE',
  layers: ['dwdnowcast'],
});
