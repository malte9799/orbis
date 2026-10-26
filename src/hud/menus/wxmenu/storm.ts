import { defineWxMenuItem } from '../types';

export default defineWxMenuItem({
  order: 40,
  id: 'storm',
  label: 'Gewitter',
  hint: 'Blitze live, CAPE-Vorhersage und Satellit live (Meteosat)',
  icon: 'bolt',
  color: '#ffcc33',
  subs: [
    { label: 'Blitze Live', main: 'lightning', mainVar: 'lightning' },
    { label: 'Vorhersage', main: 'cape', mainVar: 'cape' },
    { label: 'Live', main: 'sat', mainVar: 'sat-storm' },
  ],
});
