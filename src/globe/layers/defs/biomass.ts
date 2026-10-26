import { defineExtra } from '../types';
import { ensurePower, loadOsmPowerNow } from '../shared/power';
import { FUELS } from '../../../api/infra';

export default defineExtra({
  id: 'biomass',
  order: 650,
  section: 'infra',
  cat: 'netze',
  label: 'Biomasse & Abfall',
  hint: 'Biomasse- und Müllheizkraftwerke weltweit',
  glyph: 'plant',
  icon: 'leaf',
  color: FUELS.Biomass.color,
  enable(ctx) {
    ensurePower(ctx);
  },
  onMoveEnd: loadOsmPowerNow,
  layers: ['power', 'osm-power'],
  clickLayers: ['power', 'osm-power'],
});
