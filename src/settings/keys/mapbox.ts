import { defineKey } from '../types';

export default defineKey({
  id: 'mapbox',
  order: 12,
  group: 'weather',
  tip: 'Schärfere Satelliten-Grundkarte (Mapbox).',
  steps: [
    { t: '1. Mapbox-Account erstellen (kostenloses Kontingent)', u: 'https://account.mapbox.com/auth/signup/' },
    { t: '2. Öffentlichen Token (pk.…) kopieren', u: 'https://account.mapbox.com/access-tokens/' },
    { t: '3. Hier einfügen – danach unter Grundkarte „Mapbox Satellit“ wählen' },
  ],
  label: 'Mapbox Satellit',
  placeholder: 'pk.…',
});
