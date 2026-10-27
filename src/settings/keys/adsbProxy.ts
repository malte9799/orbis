import { defineKey } from '../types';
import { builtInProxy } from '../../api/proxy';

export default defineKey({
  id: 'adsbProxy',
  order: 110,
  group: 'transit',
  tip: () => `Cloudflare-Worker für Flugdaten & OpenStreetMap. ${builtInProxy() ? 'Leer lassen = eingebauter Proxy.' : ''}`,
  steps: [
    { t: '1. Worker-Vorlage aus dem README deployen', u: 'https://github.com/malte9799/orbis' },
    { t: '2. Auf workers.cloudflare.com (Free-Tier) anlegen', u: 'https://workers.cloudflare.com' },
    { t: '3. Worker-URL (https://…workers.dev) hier eintragen' },
  ],
  optional: () => !!builtInProxy(),
  label: 'Daten-Proxy',
  placeholder: () => builtInProxy() || 'https://mein-proxy.workers.dev/',
  type: 'url',
  /** only https addresses are kept */
  httpsOnly: true,
});
