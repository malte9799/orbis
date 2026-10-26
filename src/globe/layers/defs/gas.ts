import { defineExtra } from '../types';
import { FUELS } from '../../../api/infra';

export default defineExtra({
  id: 'gas',
  order: 630,
  section: 'infra',
  cat: 'netze',
  label: 'Gaskraftwerke',
  hint: 'Gaskraftwerke weltweit',
  glyph: 'plant',
  icon: 'flame',
  color: FUELS.Gas.color,
  layers: ['power', 'osm-power'],
  clickLayers: ['power', 'osm-power'],
});
