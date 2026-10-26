import { defineMenuCat } from '../types';

export default defineMenuCat({
  order: 40,
  id: 'radio',
  label: 'Radio',
  icon: 'radio',
  defaults: ['radio'],
  rows: [
    { label: 'Radiosender', layers: ['radio'] },
  ],
});
