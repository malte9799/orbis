import { defineKey } from '../types';

export default defineKey({
  id: 'googleRoutes',
  order: 200,
  group: 'routing',
  tip: 'Routenplanung mit Google Routes (Live-Verkehr, beste Abdeckung). Ohne Key nutzt Orbis kostenlose OpenStreetMap-Dienste.',
  steps: [
    { t: '1. In der Google Cloud Console ein Projekt mit Abrechnung anlegen (es gibt ein monatliches Gratis-Kontingent)', u: 'https://console.cloud.google.com/projectcreate' },
    { t: '2. „Routes API“ aktivieren', u: 'https://console.cloud.google.com/apis/library/routes.googleapis.com' },
    { t: '3. Unter „Anmeldedaten“ einen API-Key erstellen und auf „HTTP-Referrer“ (diese Seite) sowie auf die Routes API beschränken', u: 'https://console.cloud.google.com/apis/credentials' },
    { t: '4. Key hier einfügen – danach unter Route planen „Google Routes“ wählen' },
  ],
  optional: true,
  label: 'Google Routes',
  placeholder: 'AIza…',
});
