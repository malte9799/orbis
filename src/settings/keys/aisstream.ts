import { defineKey } from '../types';

export default defineKey({
  id: 'aisstream',
  order: 40,
  group: 'webcams',
  tip: 'Schiffe weltweit live.',
  steps: [
    { t: '1. Anmelden / registrieren (kostenlos)', u: 'https://aisstream.io' },
    { t: '2. Im Dashboard „API Keys“ → Create', u: 'https://dashboard.aisstream.io' },
    { t: '3. Key hier einfügen' },
  ],
  label: 'aisstream.io',
  placeholder: 'API-Key',
});
