import { defineKey } from '../types';

export default defineKey({
  id: 'graphhopper',
  order: 220,
  group: 'routing',
  tip: 'Routenplanung mit GraphHopper (500 Routen/Tag gratis).',
  steps: [
    { t: '1. Kostenloses Konto bei GraphHopper anlegen', u: 'https://graphhopper.com/dashboard/#/register' },
    { t: '2. Im Dashboard unter „API Keys“ einen Key erzeugen', u: 'https://graphhopper.com/dashboard/#/api-keys' },
    { t: '3. Key hier einfügen' },
  ],
  optional: true,
  label: 'GraphHopper',
  placeholder: 'API-Key',
});
