import { defineWxMenuItem } from '../types';

export default defineWxMenuItem({
  order: 60,
  id: 'temp',
  label: 'Temperatur',
  hint: 'Vorhersage, 2 m über Grund; Wasser: Satellit (NASA)',
  icon: 'thermo',
  color: '#ff8a4c',
  subs: [
    { label: 'Luft', main: 'temp', mainVar: 'temp' },
    { label: 'Gefühlt', main: 'temp', mainVar: 'feels' },
    { label: 'Wasser', main: 'ocean', mainVar: 'water' },
  ],
});
