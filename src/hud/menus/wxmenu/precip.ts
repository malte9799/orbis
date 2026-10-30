import { defineWxMenuItem } from '../types';

export default defineWxMenuItem({
  order: 30,
  id: 'precip',
  label: 'Niederschlag',
  hint: 'Vorhersage (Open-Meteo), Satellit (NASA IMERG) und Schneehöhe',
  icon: 'drop',
  color: '#3db8ff',
  subs: [
    { label: 'Vorhersage', main: 'precip', mainVar: 'precip' },
    { label: 'Satellit', main: 'sat', mainVar: 'imerg' },
    { label: 'Schnee', main: 'snow', mainVar: 'snow' },
  ],
});
