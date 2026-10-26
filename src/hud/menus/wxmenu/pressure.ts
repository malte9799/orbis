import { defineWxMenuItem } from '../types';

export default defineWxMenuItem({
  order: 80,
  id: 'pressure',
  label: 'Luftdruck',
  hint: 'Vorhersage',
  icon: 'gauge',
  color: '#a58bff',
  subs: [
    { label: '', main: 'pressure', mainVar: 'pressure' },
  ],
});
