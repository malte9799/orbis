import { defineKey } from '../types';

export default defineKey({
  id: 'tomtom',
  order: 70,
  group: 'transit',
  tip: 'Live-Verkehrslage (Stau/Fluss) für die Verkehrssimulation. Ohne Key fahren die Fahrzeuge mit Normaltempo.',
  steps: [
    { t: '1. Kostenloses Konto bei TomTom Developer anlegen', u: 'https://developer.tomtom.com/user/register' },
    { t: '2. Unter „Keys“ einen API-Key mit „Traffic API“ kopieren (Free: 2.500 Anfragen/Tag)', u: 'https://developer.tomtom.com/user/me/apps' },
    { t: '3. Key hier einfügen' },
  ],
  optional: true,
  label: 'TomTom Traffic',
  placeholder: 'API-Key (optional – sonst Simulation ohne Verkehrslage)',
});
