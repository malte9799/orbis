import { defineExtra } from '../types';
import { ensurePower, loadOsmPowerNow } from '../shared/power';
import { FUELS } from '../../../api/infra';

export default defineExtra({
  id: 'coal',
  order: 620,
  section: 'infra',
  cat: 'netze',
  label: 'Kohlekraftwerke',
  hint: 'Kohle- und Petrolkoks-Kraftwerke weltweit',
  glyph: 'plant',
  icon: 'mountain',
  color: FUELS.Coal.color,
  enable(ctx) {
    ensurePower(ctx);
  },
  onMoveEnd: loadOsmPowerNow,
  layers: ['power', 'osm-power'],
  clickLayers: ['power', 'osm-power'],
});
