import { defineKey } from '../types';

export default defineKey({
  id: 'firms',
  order: 20,
  group: 'snapshot',
  tip: 'Aktuellere Feuer-Hotspots (ohne Key: gemeinsamer Snapshot).',
  steps: [
    { t: '1. Formular ausfüllen (Name, E-Mail)', u: 'https://firms.modaps.eosdis.nasa.gov/api/map_key/' },
    { t: '2. Bestätigungs-Mail anklicken' },
    { t: '3. MAP_KEY wird angezeigt – hier einfügen' },
  ],
  optional: true,
  label: 'NASA FIRMS MAP_KEY',
  placeholder: 'MAP_KEY',
});
