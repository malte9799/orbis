import { defineKey } from '../types';

export default defineKey({
  id: 'victoria',
  order: 80,
  group: 'transit',
  tip: 'Melbourne: Züge, Trams, Busse.',
  steps: [
    { t: '1. kostenlosen Account im Open-Data-Portal erstellen', u: 'https://opendata.transport.vic.gov.au' },
    { t: '2. Im Profil API-Key (KeyId) erzeugen und hier einfügen' },
  ],
  label: 'Transport Victoria',
  placeholder: 'KeyId',
});
