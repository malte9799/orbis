import { defineWxFamily } from '../types';

export default defineWxFamily({
  order: 100,
  id: 'ocean',
  label: 'Ozean',
  hint: 'Satellit (NASA, täglich): Meerestemperatur & Meereis',
  icon: 'ocean',
  color: '#2aa8c8',
  variants: [['water', 'Meer + Eis'], ['sst', 'Meerestemperatur'], ['seaice', 'Meereis']],
});
