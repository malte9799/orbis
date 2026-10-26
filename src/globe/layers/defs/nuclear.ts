import { defineExtra } from '../types';
import { ensurePower, loadOsmPowerNow } from '../shared/power';
import { FUELS } from '../../../api/infra';

export default defineExtra({
  id: 'nuclear',
  order: 610,
  section: 'infra',
  cat: 'netze',
  label: 'Kernkraftwerke',
  hint: 'Kernkraftwerke weltweit (WRI Global Power Plant Database)',
  glyph: 'radiation',
  icon: 'radiation',
  color: FUELS.Nuclear.color,
  enable(ctx) {
    ensurePower(ctx);
  },
  onMoveEnd: loadOsmPowerNow,
  layers: ['power', 'osm-power'],
  clickLayers: ['power', 'osm-power'],
});
