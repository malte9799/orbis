import { defineWxFamily } from '../types';

export default defineWxFamily({
  order: 50,
  id: 'precip',
  label: 'Niederschlag',
  hint: 'Vorhersage (Modell)',
  icon: 'drop',
  color: '#3db8ff',
  variants: [['precip', '']],
});
