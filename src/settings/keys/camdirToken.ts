import { defineKey } from '../types';

export default defineKey({
  id: 'camdirToken',
  order: 36,
  group: 'webcams',
  optional: true,
  tip: 'Admin-Token, mit dem du Blickrichtungen von Kameras ändern darfst (nur du kennst ihn).',
  steps: [
    { t: '1. Im Worker das Secret ADMIN_TOKEN setzen (lange Zufallszeichenfolge)' },
    { t: '2. Dieselbe Zeichenfolge hier einfügen – sie bleibt nur in diesem Browser' },
  ],
  label: 'Kamera-Richtungen: Token',
  placeholder: 'Admin-Token',
});
