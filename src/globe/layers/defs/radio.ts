import { defineExtra } from '../types';

export default defineExtra({
  id: 'radio',
  order: 680,
  section: 'cams',
  cat: 'medien',
  label: 'Radiosender',
  hint: 'über 50.000 Sender weltweit – direkt anhören (Radio Browser)',
  glyph: 'radio',
  icon: 'radio',
  color: '#ff4081',
  layers: ['radio', 'radio-label'],
  clickLayers: ['radio'],
});
