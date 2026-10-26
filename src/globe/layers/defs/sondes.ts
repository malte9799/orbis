import { defineExtra } from '../types';
import { getState, refreshSondesIcons } from '../shared/air';
import { loadSondes } from '../../../api/tracking';

export default defineExtra({
  id: 'sondes',
  order: 360,
  section: 'air',
  cat: 'verkehr',
  label: 'Wetterballons',
  hint: 'Radiosonden live (SondeHub) – mit dem Flugverkehr als 3D-Modell und Detaildaten zum Klick',
  glyph: 'sonde',
  icon: 'balloon',
  color: '#ff8fab',
  sources: { sondes: 'Radiosonden: <a href="https://sondehub.org/">SondeHub</a>' },
  addLayers({ add, hidden }) {
    add(
      {
        id: 'sondes',
        type: 'symbol',
        source: 'sondes',
        layout: { ...hidden, 'icon-image': 'sil-sonde', 'icon-size': 0.8, 'icon-allow-overlap': true },
        paint: { 'icon-color': '#ff8fab', 'icon-halo-color': 'rgba(0,0,0,0.7)', 'icon-halo-width': 1 },
      },
      'marker',
    );
  },
  enable(ctx) {
    const st = getState(ctx);
    ctx.loadOnce('sondes', 60000, async () => {
      const fc = await loadSondes();
      st.lastSondes = fc;
      st.lastSondesFed = Date.now();
      st.airport3d?.feedSondes(fc);
      ctx.setData('sondes', fc);
      refreshSondesIcons(ctx);
      return { count: fc.features.length };
    });
  },
  click({ p, pt }) {
    return { type: 'sonde', serial: String(p.serial ?? ''), lng: pt[0], lat: pt[1] };
  },
  layers: ['sondes'],
  clickLayers: ['sondes'],
});
