import { defineExtra } from '../types';

export default defineExtra({
  id: 'ships',
  order: 420,
  section: 'infra',
  cat: 'verkehr',
  label: 'Schiffe live (AIS)',
  hint: 'Ostsee frei (Fintraffic), weltweit über den Daten-Proxy oder mit eigenem aisstream-Schlüssel',
  glyph: 'vessel',
  icon: 'ship',
  color: '#4dd0e1',
  layers: ['ships'],
  clickLayers: ['ships'],
});
