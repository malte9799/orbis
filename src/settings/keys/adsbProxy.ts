import { defineKey } from '../types';
import { builtInProxy } from '../../api/proxy';

export default defineKey({
  id: 'adsbProxy',
  order: 110,
  section: 'transit',
  label: 'Daten-Proxy',
  hint: () => `Cloudflare Worker für Flugdaten & OpenStreetMap – Anleitung im README${builtInProxy() ? '; leer lassen = eingebauter Proxy' : ''}`,
  placeholder: () => builtInProxy() || 'https://mein-proxy.workers.dev/',
  type: 'url',
  /** only https addresses are kept */
  httpsOnly: true,
});
