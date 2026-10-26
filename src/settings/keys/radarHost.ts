import { defineKey } from '../types';

export default defineKey({
  id: 'radarHost',
  order: 120,
  section: 'transit',
  label: 'Radar-Server',
  hint: 'optional: eigener RainViewer-kompatibler Server, z. B. selbst gehostetes LibreWXR – ersetzt das eingeschränkte kostenlose RainViewer',
  placeholder: 'https://radar.example.org',
  type: 'url',
  /** only https addresses are kept */
  httpsOnly: true,
});
