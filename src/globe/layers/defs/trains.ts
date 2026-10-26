import { defineExtra } from '../types';
import { addVehicleLayers, applyVehicles, createVehicles3d, enableTrains, moveVehicles, vehicleClick } from '../shared/vehicles';

export default defineExtra({
  id: 'trains',
  order: 440,
  section: 'infra',
  cat: 'verkehr',
  label: 'Züge live',
  hint: 'Deutschland & Europa (Echtzeitfahrplan, Transitous), GPS: Finnland, USA (Amtrak)',
  glyph: 'train',
  icon: 'train',
  color: '#ffca28',
  sources: { trains: 'Züge & ÖPNV: <a href="https://transitous.org/">Transitous</a>, <a href="https://www.digitraffic.fi/">Fintraffic</a> (CC BY 4.0), <a href="https://amtraker.com/">Amtraker</a>, Entur (NLOD), MBTA, SEPTA, TTC (OGL – Toronto), data.gov.my (CC BY 4.0), Transport Victoria (CC BY 4.0), CTA, Trafiklab' },
  addLayers(ctx) {
    addVehicleLayers(ctx, 'trains', 'trains-label', ['==', ['get', 'rail'], true]);
    createVehicles3d(ctx);
  },
  apply: applyVehicles,
  enable: enableTrains,
  onMoveEnd: moveVehicles,
  click: vehicleClick,
  layers: ['trains', 'trains-label'],
  clickLayers: ['trains'],
});
