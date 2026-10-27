import { defineKey } from '../types';

export default defineKey({
  id: 'pennsylvania511',
  order: 77,
  group: 'snapshot',
  tip: 'Verkehrskameras 511PA (ohne Key: gemeinsamer Snapshot).',
  steps: [
    { t: '1. Kostenloses Konto anlegen und anmelden', u: 'https://511pa.com' },
    { t: '2. Developer-Key im Account unter „Developers“ anfordern', u: 'https://511pa.com/developers/doc' },
    { t: '3. Key hier einfügen' },
  ],
  optional: true,
  label: '511PA',
  placeholder: 'API-Key (optional – sonst gemeinsamer Snapshot)',
});
