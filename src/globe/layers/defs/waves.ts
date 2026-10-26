import { defineExtra } from '../types';

export default defineExtra({
  id: 'waves',
  order: 200,
  section: 'ocean',
  cat: 'meer',
  label: 'Seegang & Strömung',
  hint: 'Wellenhöhe, Dünung und Meeresströmung im Kartenausschnitt – Open-Meteo Marine',
  glyph: 'tsunami',
  icon: 'wave',
  color: '#26c6da',
  layers: ['waves', 'waves-label'],
  clickLayers: ['waves'],
});
