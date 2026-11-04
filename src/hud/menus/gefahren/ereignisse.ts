import { defineMenuCat } from '../types';

export default defineMenuCat({
  order: 20,
  id: 'ereignisse',
  label: 'Ereignisse',
  icon: 'quake',
  defaults: ['quakes'],
  rows: [
    { label: 'Erdbeben', layers: ['quakes'] },
    { label: 'Vulkane', layers: ['volcanoes'] },
    { label: 'Feuer', layers: ['fires'] },
    { label: 'Tsunami-Meldungen', layers: ['tsunami'] },
    { label: 'Radioaktivität', layers: ['radiation'] },
    { label: 'Ereignisse nachgestellt', layers: ['incidents'] },
  ],
});
