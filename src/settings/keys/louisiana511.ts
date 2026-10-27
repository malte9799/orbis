import { defineKey } from '../types';

export default defineKey({
  id: 'louisiana511',
  order: 76,
  group: 'snapshot',
  tip: 'Verkehrskameras Louisiana 511 (ohne Key: gemeinsamer Snapshot).',
  steps: [
    { t: '1. Kostenloses Konto anlegen und anmelden', u: 'https://511la.org' },
    { t: '2. Developer-Key im Account unter „Developers“ anfordern', u: 'https://511la.org/developers/doc' },
    { t: '3. Key hier einfügen' },
  ],
  optional: true,
  label: 'Louisiana 511',
  placeholder: 'API-Key (optional – sonst gemeinsamer Snapshot)',
});
