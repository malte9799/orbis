import { defineMenuCat } from '../types';

export default defineMenuCat({
  order: 30,
  id: 'netze',
  label: 'Netze',
  icon: 'cable',
  rows: [
    { label: 'Seekabel', layers: ['cables'] },
    { label: 'Internetknoten', layers: ['ixp'] },
    { label: 'Öl- & Gaspipelines', layers: ['pipelines'] },
  ],
});
