import { defineKey } from '../types';

export default defineKey({
  id: 'arizona511',
  order: 71,
  group: 'snapshot',
  tip: 'Verkehrskameras AZ511 (ohne Key: gemeinsamer Snapshot).',
  steps: [
    { t: '1. Kostenloses Konto anlegen und anmelden', u: 'https://az511.com' },
    { t: '2. Developer-Key im Account unter „Developers“ anfordern', u: 'https://az511.com/developers/doc' },
    { t: '3. Key hier einfügen' },
  ],
  optional: true,
  label: 'AZ511',
  placeholder: 'API-Key (optional – sonst gemeinsamer Snapshot)',
});
