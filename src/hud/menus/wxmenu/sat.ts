import { defineWxMenuItem } from '../types';

export default defineWxMenuItem({
  order: 10,
  id: 'sat',
  label: 'Satellit',
  hint: 'HD-Tagesbild (VIIRS) und Wolken (IR)',
  icon: 'sat',
  color: '#8a94a8',
  subs: [
    { label: 'HD', main: 'sat', mainVar: 'sat-hd' },
    { label: 'Wolken', main: 'sat', mainVar: 'sat-ir' },
  ],
});
