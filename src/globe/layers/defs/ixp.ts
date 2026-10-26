import { defineExtra } from '../types';

export default defineExtra({
  id: 'ixp',
  order: 570,
  section: 'infra',
  cat: 'netze',
  label: 'Internetknoten',
  hint: 'Internet Exchange Points – PeeringDB',
  glyph: 'cable',
  icon: 'cable',
  color: '#e040fb',
  layers: ['ixp'],
  clickLayers: ['ixp'],
});
