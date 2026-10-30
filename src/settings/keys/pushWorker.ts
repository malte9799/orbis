import { defineKey } from '../types';
import { builtInPush } from '../../api/pushnotify';

export default defineKey({
  id: 'pushWorker',
  order: 120,
  group: 'transit',
  tip: () => `Eigener Cloudflare-Worker für den Fahrplan: Bahn-Verspätungen (DB-Daten) und Benachrichtigungen für Pendler-Verbindungen. ${builtInPush() ? 'Leer lassen = eingebauter Worker.' : ''}`,
  steps: [
    { t: '1. proxy/fahrplan-push-worker.js als Cloudflare-Worker deployen, KV und Schlüssel einrichten (siehe README „Fahrplan: Bahn-Verspätungen & Benachrichtigungen“)', u: 'https://github.com/malte9799/orbis' },
    { t: '2. Worker-URL (https://…workers.dev) hier eintragen' },
  ],
  optional: () => !!builtInPush(),
  label: 'Fahrplan-Worker (Verspätungen & Push)',
  placeholder: () => builtInPush() || 'https://mein-fahrplan-push.workers.dev',
  type: 'url',
  httpsOnly: true,
});
