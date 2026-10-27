import { defineKey } from '../types';

export default defineKey({
  id: 'georgia511',
  order: 75,
  group: 'snapshot',
  tip: 'Verkehrskameras Georgia 511 (ohne Key: gemeinsamer Snapshot).',
  steps: [
    { t: '1. Kostenloses Konto anlegen und anmelden', u: 'https://511ga.org' },
    { t: '2. Developer-Key im Account unter „Developers“ anfordern', u: 'https://511ga.org/developers/doc' },
    { t: '3. Key hier einfügen' },
  ],
  optional: true,
  label: 'Georgia 511',
  placeholder: 'API-Key (optional – sonst gemeinsamer Snapshot)',
});
