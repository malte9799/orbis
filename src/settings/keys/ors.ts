import { defineKey } from '../types';

export default defineKey({
  id: 'ors',
  order: 210,
  group: 'routing',
  tip: 'Routenplanung mit OpenRouteService (gute Rad- und Fußrouten, 2 000 Routen/Tag gratis).',
  steps: [
    { t: '1. Kostenloses Konto bei OpenRouteService anlegen', u: 'https://account.heigit.org/signup' },
    { t: '2. Im Dashboard einen Token („Standard“) erzeugen', u: 'https://account.heigit.org/manage/key' },
    { t: '3. Token hier einfügen' },
  ],
  optional: true,
  label: 'OpenRouteService',
  placeholder: 'Token',
});
