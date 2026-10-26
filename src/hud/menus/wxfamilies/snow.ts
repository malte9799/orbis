import { defineWxFamily } from '../types';

export default defineWxFamily({
  order: 90,
  id: 'snow',
  label: 'Schnee',
  hint: 'Vorhersage: Schneehöhe',
  icon: 'snow',
  color: '#d8e8ff',
  variants: [['snow', '']],
});
