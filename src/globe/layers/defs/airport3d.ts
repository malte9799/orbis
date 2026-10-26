import { defineExtra } from '../types';
import { createAirport, getState, loadAircraftNow } from '../shared/air';
import { AP3D_LAYERS, AP3D_HIT_LAYER } from '../../airport3d';

export default defineExtra({
  id: 'airport3d',
  order: 390,
  section: 'air',
  cat: 'verkehr',
  label: 'Flughafen 3D',
  hint: 'Rollwege, Terminals und Flugzeuge in 3D ab Zoomstufe 11 – OpenStreetMap, ADS-B (zum Kippen Strg + Ziehen)',
  glyph: 'airport',
  icon: 'plane2',
  color: '#ff6a2b',
  addLayers(ctx) {
    createAirport(ctx);
  },
  onMoveEnd(ctx) {
    if (!ctx.isOn('aircraft')) loadAircraftNow(ctx);
    getState(ctx).airport3d?.onMoveEnd();
  },
  enable(ctx) {
    loadAircraftNow(ctx);
    ctx.every('airport3d', 10000, () => loadAircraftNow(ctx));
  },
  click({ p, pt }) {
  return { type: 'flight', hex: String(p.hex), lng: pt[0], lat: pt[1] };
  },
  layers: AP3D_LAYERS,
  clickLayers: [AP3D_HIT_LAYER],
});
