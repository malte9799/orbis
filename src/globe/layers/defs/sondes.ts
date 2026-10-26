import { defineExtra } from '../types';

export default defineExtra({
  id: 'sondes',
  order: 360,
  section: 'air',
  cat: 'verkehr',
  label: 'Wetterballons',
  hint: 'Radiosonden live (SondeHub) – mit dem Flugverkehr als 3D-Modell und Detaildaten zum Klick',
  glyph: 'sonde',
  icon: 'balloon',
  color: '#ff8fab',
  layers: ['sondes'],
  clickLayers: ['sondes'],
});
