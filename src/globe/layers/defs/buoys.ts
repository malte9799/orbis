import { defineExtra } from '../types';
import { loadBuoys } from '../../../api/ocean';
import { waveLabel } from '../shared/ocean';

export default defineExtra({
  id: 'buoys',
  order: 220,
  section: 'ocean',
  cat: 'meer',
  label: 'Messbojen',
  hint: 'Wellen, Wind, Luftdruck, Wassertemperatur live – NOAA NDBC (~900 Stationen)',
  glyph: 'gauge',
  icon: 'ocean',
  color: '#4fc3f7',
  sources: { buoys: 'Bojen: <a href="https://www.ndbc.noaa.gov/">NOAA NDBC</a>' },
  addLayers({ add, hidden }) {
    add(
      {
        id: 'buoys',
        type: 'circle',
        source: 'buoys',
        layout: { ...hidden, 'circle-sort-key': ['get', 'wave'] },
        paint: { 'circle-color': ['get', 'color'], 'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 3, 9, 8], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1 },
      },
      'gauges',
    );
    add({ ...waveLabel('buoys-label', 'buoys'), minzoom: 5 }, 'marker');
  },
  enable(ctx) {
    ctx.loadOnce('buoys', 10 * 60000, async () => {
      const fc = await loadBuoys();
      ctx.setData('buoys', fc);
      return { count: fc.features.length, note: 'Farbe = Wellenhöhe, Zahl = Wellenhöhe in m (sonst Wind in kn)' };
    });
  },
  click({ p, pt, html }) {
    return { type: 'html', html: html('gauge', String(p.color)), lng: pt[0], lat: pt[1] };
  },
  layers: ['buoys', 'buoys-label'],
  clickLayers: ['buoys'],
});
