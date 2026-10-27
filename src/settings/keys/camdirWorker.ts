import { defineKey } from '../types';
import { builtInCamdir } from '../../api/camdircloud';

export default defineKey({
  id: 'camdirWorker',
  order: 35,
  group: 'webcams',
  tip: () => `Eigener Cloudflare-Worker mit korrigierten Kamera-Blickrichtungen. ${builtInCamdir() ? 'Leer lassen = eingebauter Worker.' : ''}`,
  steps: [
    { t: '1. proxy/camdir-worker.js als Cloudflare-Worker deployen, KV-Namespace als CAMDIR binden (siehe README „Kamera-Richtungen“)', u: 'https://github.com/malte9799/orbis' },
    { t: '2. Worker-URL (https://…workers.dev) hier eintragen' },
  ],
  optional: () => !!builtInCamdir(),
  label: 'Kamera-Richtungen (Worker)',
  placeholder: () => builtInCamdir() || 'https://meine-kamerarichtungen.workers.dev',
  type: 'url',
  httpsOnly: true,
});
