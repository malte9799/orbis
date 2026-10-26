import { defineExtra } from '../types';

export default defineExtra({
  id: 'trains',
  order: 440,
  section: 'infra',
  cat: 'verkehr',
  label: 'Züge live',
  hint: 'Deutschland & Europa (Echtzeitfahrplan, Transitous), GPS: Finnland, USA (Amtrak)',
  glyph: 'train',
  icon: 'train',
  color: '#ffca28',
  layers: ['trains', 'trains-label'],
  clickLayers: ['trains'],
});
