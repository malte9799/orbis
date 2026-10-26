import { defineExtra } from '../types';
import { FUELS } from '../../../api/infra';

export default defineExtra({
  id: 'wind',
  order: 580,
  section: 'infra',
  cat: 'netze',
  label: 'Windkraft',
  hint: 'Windparks, beim Zoomen einzelne Anlagen',
  glyph: 'wind',
  icon: 'windmill',
  color: FUELS.Wind.color,
  layers: ['power', 'osm-power'],
  clickLayers: ['power', 'osm-power'],
});
