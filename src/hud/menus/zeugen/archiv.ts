import { defineMenuCat } from '../types';

export default defineMenuCat({
  order: 10,
  id: 'archiv',
  label: 'Gaza',
  icon: 'warn',
  defaults: ['warfootage'],
  rows: [
    { label: 'Zeugen-Archiv', layers: ['warfootage'] },
    { label: 'Zahlen & Verlauf', layers: ['gazazahlen'] },
    { label: 'Hunger (IPC)', layers: ['gazahunger'] },
    { label: 'Vertreibung', layers: ['gazavertreibung'] },
    { label: 'Gesundheitseinrichtungen', layers: ['gazagesundheit'] },
    { label: 'Geldflüsse (PAC)', layers: ['moneyflow'] },
    { label: 'Geldflüsse (Länderbögen)', layers: ['geldfluesse'] },
  ],
});
