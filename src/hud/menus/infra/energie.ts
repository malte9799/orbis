import { defineMenuCat } from '../types';

export default defineMenuCat({
  order: 10,
  id: 'energie',
  label: 'Energie',
  icon: 'power',
  rows: [
    { label: 'Windkraft', layers: ['wind'] },
    { label: 'Solarparks', layers: ['solar'] },
    { label: 'Wasserkraft', layers: ['water'] },
    { label: 'Kernkraftwerke', layers: ['nuclear'] },
    { label: 'Kohlekraftwerke', layers: ['coal'] },
    { label: 'Gaskraftwerke', layers: ['gas'] },
    { label: 'Ölkraftwerke', layers: ['oil'] },
    { label: 'Biomasse & Abfall', layers: ['biomass'] },
    { label: 'Weitere Kraftwerke', layers: ['plants'] },
  ],
});
