import { defineKey } from '../types';

export default defineKey({
  id: 'nevada511',
  order: 73,
  group: 'snapshot',
  tip: 'Verkehrskameras NVRoads (ohne Key: gemeinsamer Snapshot).',
  steps: [
    { t: '1. Kostenloses Konto anlegen und anmelden', u: 'https://nvroads.com' },
    { t: '2. Developer-Key im Account unter „Developers“ anfordern', u: 'https://nvroads.com/developers/doc' },
    { t: '3. Key hier einfügen' },
  ],
  optional: true,
  label: 'NVRoads',
  placeholder: 'API-Key (optional – sonst gemeinsamer Snapshot)',
});
