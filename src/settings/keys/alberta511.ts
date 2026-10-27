import { defineKey } from '../types';

export default defineKey({
  id: 'alberta511',
  order: 70,
  group: 'transit',
  tip: 'Verkehrskameras Alberta.',
  steps: [
    { t: '1. Kostenlos registrieren / anmelden', u: 'https://511.alberta.ca' },
    { t: '2. Key unter „Developers“ nach dem Login kopieren', u: 'https://511.alberta.ca/developers/doc' },
    { t: '3. Key hier einfügen' },
  ],
  label: '511 Alberta',
  placeholder: 'API-Key',
});
