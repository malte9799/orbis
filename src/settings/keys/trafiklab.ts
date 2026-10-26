import { defineKey } from '../types';

export default defineKey({
  id: 'trafiklab',
  order: 100,
  group: 'transit',
  tip: 'Busse & Bahnen in Schweden (GTFS Regional Realtime).',
  steps: [
    { t: '1. Kostenloses Konto erstellen', u: 'https://www.trafiklab.se/signup' },
    { t: '2. Projekt anlegen → API „GTFS Regional Realtime“ hinzufügen → Key', u: 'https://www.trafiklab.se/docs/getting-started/using-trafiklab' },
    { t: '3. Key hier einfügen' },
  ],
  label: 'Trafiklab',
  placeholder: 'API-Key',
});
