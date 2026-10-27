import { defineMenuCat } from '../types';

export default defineMenuCat({
  order: 50,
  id: 'ueberwachung',
  label: 'Überwachung',
  icon: 'cam',
  rows: [
    { label: 'Live-Kameras', layers: ['webcams'] },
    { label: 'Kennzeichen-Kameras', layers: ['alpr'] },
    { label: 'Blitzer & Rotlicht', layers: ['blitzer'] },
  ],
});
