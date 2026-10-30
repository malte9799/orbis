import { defineKey } from '../types';

export default defineKey({
  id: 'googleTiles',
  order: 210,
  group: 'tiles3d',
  tip: 'Fotorealistische 3D-Kacheln von Google (Abrechnung pro Sitzung, Attribution Pflicht).',
  steps: [
    { t: '1. In der Google Cloud Console ein Projekt mit Abrechnung anlegen', u: 'https://console.cloud.google.com/' },
    { t: '2. „Map Tiles API“ aktivieren', u: 'https://console.cloud.google.com/apis/library/tile.googleapis.com' },
    { t: '3. API-Key erzeugen und hier einfügen' },
  ],
  label: 'Google Map Tiles Key',
  placeholder: 'API-Key',
});
