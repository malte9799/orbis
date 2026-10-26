import { defineExtra } from '../types';

export default defineExtra({
  id: 'launches',
  order: 370,
  section: 'air',
  cat: 'verkehr',
  label: 'Raketenstarts',
  hint: 'nächste Starts, Countdown, Tracking & Stream – The Space Devs',
  glyph: 'rocket',
  icon: 'rocket',
  color: '#ff6e40',
  layers: ['launches'],
  clickLayers: ['launches'],
});
