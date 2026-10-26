import { defineExtra } from '../types';

export default defineExtra({
  id: 'ecsnow',
  order: 320,
  section: 'ocean',
  cat: 'wetter',
  label: 'Schneeradar Kanada',
  hint: 'Radar nur für Schneefall, 1 km – Environment Canada',
  glyph: 'ice',
  icon: 'snow',
  color: '#81d4fa',
  region: 'CA',
  layers: ['ecsnow'],
});
