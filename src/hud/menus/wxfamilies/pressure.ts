import { defineWxFamily } from '../types';

export default defineWxFamily({
  order: 70,
  id: 'pressure',
  label: 'Luftdruck',
  hint: 'Vorhersage',
  icon: 'gauge',
  color: '#a58bff',
  variants: [['pressure', '']],
});
