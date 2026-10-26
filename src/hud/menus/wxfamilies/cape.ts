import { defineWxFamily } from '../types';

export default defineWxFamily({
  order: 110,
  id: 'cape',
  label: 'Gewitter',
  hint: 'Vorhersage: Gewitterenergie (CAPE)',
  icon: 'bolt',
  color: '#ffcc33',
  variants: [['cape', '']],
});
