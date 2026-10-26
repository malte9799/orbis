import { defineMenuCat } from '../types';

export default defineMenuCat({
  order: 10,
  id: 'auto',
  label: 'Auto',
  icon: 'car',
  defaults: ['roadnet'],
  rows: [
    { label: 'Straßen', layers: ['roadnet'] },
    { label: 'Staus & Baustellen', layers: ['autobahn'] },
    { label: 'Blitzer & Rotlicht', layers: ['blitzer'] },
  ],
});
