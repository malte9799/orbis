import { defineWxFamily } from '../types';

export default defineWxFamily({
  order: 30,
  id: 'wind',
  label: 'Wind',
  hint: 'Vorhersage, mit Windpartikeln',
  icon: 'wind',
  color: '#36c2a8',
  variants: [['wind', 'Mittelwind'], ['gusts', 'Böen']],
});
