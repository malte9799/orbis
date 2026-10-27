import { defineKey } from '../types';

export default defineKey({
  id: 'ohgo',
  order: 78,
  group: 'snapshot',
  tip: 'Verkehrskameras Ohio (ohne Key: gemeinsamer Snapshot).',
  steps: [
    { t: '1. Kostenloses Konto anlegen und anmelden', u: 'https://publicapi.ohgo.com/docs/registration' },
    { t: '2. Key abrufen', u: 'https://publicapi.ohgo.com/docs/api-key' },
    { t: '3. Key hier einfügen' },
  ],
  optional: true,
  label: 'OHGO (Ohio)',
  placeholder: 'API-Key (optional – sonst gemeinsamer Snapshot)',
});
