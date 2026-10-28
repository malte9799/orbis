import { defineKey } from '../types';

export default defineKey({
  id: 'maptiler',
  order: 14,
  group: 'weather',
  tip: 'Schärfere Satelliten-Grundkarte (MapTiler).',
  steps: [
    { t: '1. MapTiler-Account erstellen (kostenloser Plan, nicht-kommerziell)', u: 'https://cloud.maptiler.com/auth/widget?mode=signup' },
    { t: '2. API-Key kopieren', u: 'https://cloud.maptiler.com/account/keys/' },
    { t: '3. Hier einfügen – danach unter Grundkarte „MapTiler Satellit“ wählen' },
  ],
  label: 'MapTiler Satellit',
  placeholder: 'Key',
});
