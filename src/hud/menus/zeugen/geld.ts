import { defineMenuCat } from '../types';

export default defineMenuCat({
  order: 40,
  id: 'geld',
  label: 'Geldflüsse',
  icon: 'list',
  defaults: ['moneyflow'],
  rows: [],
});
