import { defineExtra } from '../types';

export default defineExtra({
  id: 'nina',
  order: 40,
  section: 'europe',
  cat: 'gefahr',
  label: 'Bevölkerungswarnungen',
  hint: 'NINA: MoWaS, KATWARN, BIWAPP, Hochwasser, Polizei',
  glyph: 'warn',
  icon: 'warn',
  color: '#c2185b',
  region: 'DE',
  layers: ['nina-fill', 'nina-line'],
  clickLayers: ['nina-fill'],
});
