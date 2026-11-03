import { defineMenuCat } from '../types';

export default defineMenuCat({
  order: 30,
  id: 'wahlen',
  label: 'Wahlergebnisse',
  icon: 'vote',
  defaults: ['wahlen'],
  rows: [],
});
