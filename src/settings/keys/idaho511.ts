import { defineKey } from '../types';

export default defineKey({
  id: 'idaho511',
  order: 72,
  group: 'snapshot',
  tip: 'Verkehrskameras Idaho 511 (ohne Key: gemeinsamer Snapshot).',
  steps: [
    { t: '1. Kostenloses Konto anlegen und anmelden', u: 'https://511.idaho.gov' },
    { t: '2. Developer-Key im Account unter „Developers“ anfordern', u: 'https://511.idaho.gov/developers/doc' },
    { t: '3. Key hier einfügen' },
  ],
  optional: true,
  label: 'Idaho 511',
  placeholder: 'API-Key (optional – sonst gemeinsamer Snapshot)',
});
