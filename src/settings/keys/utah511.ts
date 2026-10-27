import { defineKey } from '../types';

export default defineKey({
  id: 'utah511',
  order: 70,
  group: 'snapshot',
  tip: 'Verkehrskameras UDOT Traffic (ohne Key: gemeinsamer Snapshot).',
  steps: [
    { t: '1. Kostenloses Konto anlegen und anmelden', u: 'https://udottraffic.utah.gov' },
    { t: '2. Developer-Key im Account unter „Developers“ anfordern', u: 'https://prod-ut.ibi511.com/developers/doc' },
    { t: '3. Key hier einfügen' },
  ],
  optional: true,
  label: 'UDOT Traffic',
  placeholder: 'API-Key (optional – sonst gemeinsamer Snapshot)',
});
