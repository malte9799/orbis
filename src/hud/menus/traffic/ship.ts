import { defineMenuCat } from '../types';

export default defineMenuCat({
  order: 40,
  id: 'ship',
  label: 'Schiff',
  icon: 'ship',
  defaults: ['ships'],
  rows: [
    { label: 'Schiffsrouten', layers: ['shipping'] },
  ],
});
