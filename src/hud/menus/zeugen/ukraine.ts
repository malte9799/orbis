import { defineMenuCat } from '../types';

export default defineMenuCat({
  order: 15,
  id: 'ukraine',
  label: 'Ukraine',
  icon: 'warn',
  defaults: ['ukraineharm'],
  rows: [
    { label: 'Zivile Schäden (Bellingcat)', layers: ['ukraineharm'] },
    { label: 'Lage nach Oblast', layers: ['ukrainelage'] },
    { label: 'Angriffe aufs Gesundheitswesen (WHO)', layers: ['ukrainezahlen'] },
    { label: 'Hilfe nach Geberland (Kiel)', layers: ['ukrainesupport'] },
  ],
});
