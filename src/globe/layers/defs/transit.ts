import { defineExtra } from '../types';

export default defineExtra({
  id: 'transit',
  order: 450,
  section: 'infra',
  cat: 'verkehr',
  label: 'Busse, Trams & U-Bahn',
  hint: 'Deutschland & Europa ab Stadtzoom (Transitous); GPS: Norwegen, Boston, Toronto, Malaysia, optional Melbourne, Chicago, Schweden',
  glyph: 'train',
  icon: 'bus',
  color: '#ab47bc',
  layers: ['transit-veh', 'transit-label'],
  clickLayers: ['transit-veh'],
});
