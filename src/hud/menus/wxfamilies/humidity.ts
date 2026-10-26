import { defineWxFamily } from '../types';

export default defineWxFamily({
  order: 80,
  id: 'humidity',
  label: 'Feuchte',
  hint: 'Vorhersage: relative Luftfeuchtigkeit',
  icon: 'humid',
  color: '#4fc3c8',
  variants: [['humidity', '']],
});
