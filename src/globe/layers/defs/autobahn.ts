import { defineExtra } from '../types';

export default defineExtra({
  id: 'autobahn',
  order: 530,
  section: 'infra',
  cat: 'verkehr',
  label: 'Autobahn: Staus & Baustellen',
  hint: 'Verkehrsmeldungen, Sperrungen, Baustellen – Autobahn GmbH',
  glyph: 'warn',
  icon: 'car',
  color: '#ffa000',
  region: 'DE',
  layers: ['autobahn-line', 'autobahn'],
  clickLayers: ['autobahn'],
});
