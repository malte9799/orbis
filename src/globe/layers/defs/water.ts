import { defineExtra } from '../types';
import { ensurePower, loadOsmPowerNow } from '../shared/power';
import { FUELS } from '../../../api/infra';

export default defineExtra({
  id: 'water',
  order: 600,
  section: 'infra',
  cat: 'netze',
  label: 'Wasserkraft',
  hint: 'Wasser- und Gezeitenkraftwerke',
  glyph: 'hydro',
  icon: 'drop',
  color: FUELS.Hydro.color,
  enable(ctx) {
    ensurePower(ctx);
  },
  onMoveEnd: loadOsmPowerNow,
  layers: ['power', 'osm-power'],
  clickLayers: ['power', 'osm-power'],
});
