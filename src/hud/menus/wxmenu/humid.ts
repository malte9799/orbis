import { defineWxMenuItem } from '../types';

export default defineWxMenuItem({
  order: 70,
  id: 'humid',
  label: 'Feuchtigkeit',
  hint: 'Vorhersage',
  icon: 'humid',
  color: '#4fc3c8',
  subs: [
    { label: 'Relativ', main: 'humidity', mainVar: 'humidity' },
    { label: 'Taupunkt', main: 'temp', mainVar: 'dewpoint' },
  ],
});
