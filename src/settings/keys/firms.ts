import { defineKey } from '../types';

export default defineKey({
  id: 'firms',
  order: 20,
  section: 'keys',
  label: 'NASA FIRMS MAP_KEY',
  hint: 'eigener Schlüssel für aktuellere Feuer-Hotspots – sonst wird ein gemeinsamer Snapshot genutzt',
  placeholder: 'MAP_KEY',
});
