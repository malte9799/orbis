import { defineExtra } from '../types';
import { FUELS } from '../../../api/infra';

export default defineExtra({
  id: 'plants',
  order: 660,
  section: 'infra',
  cat: 'netze',
  label: 'Weitere Kraftwerke',
  hint: 'Geothermie, Speicher, Kraft-Wärme-Kopplung …',
  glyph: 'plant',
  icon: 'power',
  color: FUELS.Geothermal.color,
  layers: ['power', 'osm-power'],
  clickLayers: ['power', 'osm-power'],
});
