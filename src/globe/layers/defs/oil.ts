import { defineExtra } from '../types';
import { FUELS } from '../../../api/infra';

export default defineExtra({
  id: 'oil',
  order: 640,
  section: 'infra',
  cat: 'netze',
  label: 'Ölkraftwerke',
  hint: 'Öl-Kraftwerke weltweit',
  glyph: 'plant',
  icon: 'barrel',
  color: FUELS.Oil.color,
  layers: ['power', 'osm-power'],
  clickLayers: ['power', 'osm-power'],
});
