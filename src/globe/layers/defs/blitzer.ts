import { defineExtra } from '../types';

export default defineExtra({
  id: 'blitzer',
  order: 700,
  section: 'infra',
  cat: 'verkehr',
  label: 'Blitzer & Rotlicht',
  hint: 'ortsfeste Messstellen, Strecken-Abschnitte und Ampel-Kameras (ab Zoom 9) – OpenStreetMap; Lageplan, keine Fahrwarnung (in DE Nutzung während der Fahrt verboten)',
  glyph: 'blitzer',
  icon: 'blitzer',
  color: '#e53935',
  layers: ['blitzer'],
  clickLayers: ['blitzer'],
});
