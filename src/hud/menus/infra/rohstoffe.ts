import { defineMenuCat } from '../types';

export default defineMenuCat({
  order: 20,
  id: 'rohstoffe',
  label: 'Rohstoffe',
  icon: 'pick',
  defaults: ['resources'],
  rows: [
    { label: 'Vorkommen', layers: ['resources'] },
  ],
});
