import { defineExtra } from '../types';
import { ensurePower, loadOsmPowerNow } from '../shared/power';
import { FUELS } from '../../../api/infra';

export default defineExtra({
  id: 'solar',
  order: 590,
  section: 'infra',
  cat: 'netze',
  label: 'Solarparks',
  hint: 'Photovoltaik-Kraftwerke',
  glyph: 'solar',
  icon: 'sun',
  color: FUELS.Solar.color,
  enable(ctx) {
    ensurePower(ctx);
  },
  onMoveEnd: loadOsmPowerNow,
  layers: ['power', 'osm-power'],
  clickLayers: ['power', 'osm-power'],
});
