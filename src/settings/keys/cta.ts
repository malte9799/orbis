import { defineKey } from '../types';

export default defineKey({
  id: 'cta',
  order: 90,
  group: 'transit',
  tip: 'Chicago „L“: Zug-Positionen & Ankünfte.',
  steps: [
    { t: '1. Antragsformular ausfüllen (kostenlos, wird kurz geprüft)', u: 'https://www.transitchicago.com/developers/traintrackerapply/' },
    { t: '2. Key per E-Mail erhalten und hier einfügen' },
  ],
  label: 'CTA Train Tracker',
  placeholder: 'API-Key',
});
