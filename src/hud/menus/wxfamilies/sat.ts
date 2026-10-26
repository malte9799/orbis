import { defineWxFamily } from '../types';

export default defineWxFamily({
  order: 20,
  id: 'sat',
  label: 'Satellit',
  hint: 'HD-Tagesbild (VIIRS) und Live-Daten',
  icon: 'sat',
  color: '#8a94a8',
  variants: [['sat-hd', 'HD'], ['sat-ir', 'Wolken (IR)'], ['imerg', 'Niederschlag'], ['sat-storm', 'Gewitter live']],
});
