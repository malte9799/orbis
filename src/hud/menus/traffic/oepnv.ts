import { defineMenuCat } from '../types';

export default defineMenuCat({
  order: 20,
  id: 'oepnv',
  label: 'ÖPNV',
  icon: 'bus',
  defaults: ['trains'],
  rows: [
    { label: 'Busse live', layers: ['transit'] },
    { label: 'Busnetz', layers: ['busnet'] },
    { label: 'Züge live', layers: ['trains'] },
    { label: 'Zugnetz', layers: ['railspeed'] },
  ],
});
