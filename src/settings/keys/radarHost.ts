import { defineKey } from '../types';

export default defineKey({
  id: 'radarHost',
  order: 120,
  group: 'weather',
  tip: 'Eigener RainViewer-kompatibler Server statt der begrenzten RainViewer-Quelle.',
  steps: [
    { t: '1. LibreWXR selbst hosten (open source, RainViewer- Ersatz)', u: 'https://librewxr.net/' },
    { t: '2. Server-URL (https://…) hier eintragen – kein Schlüssel nötig' },
  ],
  optional: true,
  label: 'Radar-Server',
  placeholder: 'https://radar.example.org',
  type: 'url',
  /** only https addresses are kept */
  httpsOnly: true,
});
