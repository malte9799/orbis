import { defineKey } from '../types';

export default defineKey({
  id: 'protomaps',
  order: 16,
  group: 'weather',
  tip: 'Vektor-Grundkarten „Protomaps Dunkel“ und „Protomaps Hell“.',
  steps: [
    { t: '1. Protomaps-Account erstellen (kostenlos für nicht-kommerzielle Nutzung)', u: 'https://protomaps.com/api' },
    { t: '2. API-Key kopieren', u: 'https://protomaps.com/dashboard' },
    { t: '3. Hier einfügen – danach unter Grundkarte „Protomaps Dunkel/Hell“ wählen' },
  ],
  label: 'Protomaps Grundkarten',
  placeholder: 'Key',
});
