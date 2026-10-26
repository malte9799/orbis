import { defineExtra } from '../types';
import { ensurePower, loadOsmPowerNow } from '../shared/power';
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
  enable(ctx) {
    ensurePower(ctx);
  },
  onMoveEnd: loadOsmPowerNow,
  layers: ['power', 'osm-power'],
  clickLayers: ['power', 'osm-power'],
});
