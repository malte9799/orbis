import { defineWxFamily } from '../types';

export default defineWxFamily({
  order: 40,
  id: 'temp',
  label: 'Temperatur',
  hint: 'Vorhersage, 2 m über Grund',
  icon: 'thermo',
  color: '#ff8a4c',
  variants: [['temp', 'Luft'], ['feels', 'Gefühlt'], ['dewpoint', 'Taupunkt']],
});
