import { defineKey } from '../types';

export default defineKey({
  id: 'ontario511',
  order: 60,
  group: 'transit',
  tip: 'Verkehrskameras Ontario.',
  steps: [
    { t: '1. Kostenlos registrieren / anmelden („My Account“)', u: 'https://511on.ca' },
    { t: '2. Key nach der Registrierung im Account kopieren', u: 'https://511on.ca/about/faq' },
    { t: '3. Key hier einfügen' },
  ],
  label: '511 Ontario',
  placeholder: 'API-Key',
});
