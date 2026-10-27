import { defineKey } from '../types';

export default defineKey({
  id: 'qldtraffic',
  order: 79,
  group: 'snapshot',
  tip: 'Straßenkameras Queensland (ohne Key: gemeinsamer Snapshot).',
  steps: [
    { t: '1. Kostenloses Konto anlegen und anmelden', u: 'https://qldtraffic.qld.gov.au/more/Developers-and-Data/' },
    { t: '2. API-Key laut Spezifikation (PDF) bzw. Anforderung verwenden', u: 'https://qldtraffic.qld.gov.au/more/Developers-and-Data/' },
    { t: '3. Key hier einfügen' },
  ],
  optional: true,
  label: 'QLDTraffic',
  placeholder: 'API-Key (optional – sonst gemeinsamer Snapshot)',
});
