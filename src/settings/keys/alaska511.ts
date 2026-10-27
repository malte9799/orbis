import { defineKey } from '../types';

export default defineKey({
  id: 'alaska511',
  order: 74,
  group: 'snapshot',
  tip: 'Verkehrskameras Alaska 511 (ohne Key: gemeinsamer Snapshot).',
  steps: [
    { t: '1. Kostenloses Konto anlegen und anmelden', u: 'https://511.alaska.gov' },
    { t: '2. Developer-Key im Account unter „Developers“ anfordern', u: 'https://511.alaska.gov/developers/doc' },
    { t: '3. Key hier einfügen' },
  ],
  optional: true,
  label: 'Alaska 511',
  placeholder: 'API-Key (optional – sonst gemeinsamer Snapshot)',
});
