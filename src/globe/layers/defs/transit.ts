import { defineExtra } from '../types';
import { addVehicleLayers, moveVehicles, vehicleClick } from '../shared/vehicles';

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
  addLayers(ctx) {
    addVehicleLayers(ctx, 'transit-veh', 'transit-label', ['!=', ['get', 'rail'], true]);
  },
  onMoveEnd(ctx) {
    if (!ctx.isOn('trains')) moveVehicles(ctx);
  },
  click: vehicleClick,
  layers: ['transit-veh', 'transit-label'],
  clickLayers: ['transit-veh'],
});
