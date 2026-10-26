import { defineWxMenuItem } from '../types';

export default defineWxMenuItem({
  order: 50,
  id: 'wind',
  label: 'Wind',
  hint: 'Vorhersage, mit Windpartikeln',
  icon: 'wind',
  color: '#36c2a8',
  subs: [
    { label: 'Stärke', main: 'wind', mainVar: 'wind' },
    { label: 'Böen', main: 'wind', mainVar: 'gusts' },
  ],
});
