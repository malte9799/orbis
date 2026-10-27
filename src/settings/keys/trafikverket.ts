import { defineKey } from '../types';

export default defineKey({
  id: 'trafikverket',
  order: 60,
  group: 'snapshot',
  tip: 'Straßenkameras in Schweden (ohne Key: gemeinsamer Snapshot).',
  steps: [
    { t: '1. Kostenloses Konto bei Trafikverket anlegen', u: 'https://api.trafikinfo.trafikverket.se/Account/Register' },
    { t: '2. Autorisierungsschlüssel (Authentication key) kopieren', u: 'https://api.trafikinfo.trafikverket.se/' },
    { t: '3. Key hier einfügen' },
  ],
  optional: true,
  label: 'Trafikverket',
  placeholder: 'API-Key (optional – sonst gemeinsamer Snapshot)',
});
