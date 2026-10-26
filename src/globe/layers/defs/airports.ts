import { defineExtra } from '../types';

export const AIRPORT_FAR = ['airports-far-1', 'airports-far-2', 'airports-far-3'];

export default defineExtra({
  id: 'airports',
  order: 380,
  section: 'air',
  cat: 'verkehr',
  label: 'Flughäfen',
  hint: 'mit Abflügen & Ankünften vom Vortag – OpenSky',
  glyph: 'airport',
  icon: 'plane2',
  color: '#90caf9',
  layers: ['airports', 'airports-minor', ...AIRPORT_FAR],
  clickLayers: ['airports', 'airports-minor', ...AIRPORT_FAR],
});
