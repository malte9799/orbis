import { defineMenuCat } from '../types';

export default defineMenuCat({
  order: 20,
  id: 'demos',
  label: 'Demonstrationen',
  icon: 'placard',
  defaults: ['demos'],
  rows: [
    { label: 'Versammlungen D/AT/CH', layers: ['demos'] },
    { label: 'US-Proteste', layers: ['usprotests'] },
  ],
});
