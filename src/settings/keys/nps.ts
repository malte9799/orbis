import { defineKey } from '../types';

export default defineKey({
  id: 'nps',
  order: 50,
  group: 'snapshot',
  tip: 'Webcams der US-Nationalparks (ohne Key: gemeinsamer Snapshot).',
  steps: [
    { t: '1. Formular ausfüllen – Key kommt sofort nach dem Absenden per E-Mail', u: 'https://www.nps.gov/subjects/developer/get-started.htm' },
    { t: '2. Key hier einfügen' },
  ],
  optional: true,
  label: 'US National Park Service',
  placeholder: 'API-Key (optional – sonst gemeinsamer Snapshot)',
});
