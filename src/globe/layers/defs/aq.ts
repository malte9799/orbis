import { defineExtra } from '../types';
import { loadCityAirQuality } from '../../../api/europe';

export default defineExtra({
  id: 'aq',
  order: 50,
  section: 'europe',
  cat: 'wetter',
  label: 'Luftqualität & Pollen',
  hint: 'europäische Städte – Copernicus CAMS',
  glyph: 'air',
  icon: 'air',
  color: '#50c878',
  region: 'EU',
  enable(ctx) {
    ctx.loadOnce('aq', 60 * 60000, async () => {
      const fc = await loadCityAirQuality();
      ctx.setData('aq', fc);
      return { count: fc.features.length };
    });
  },
  click({ p, pt, html }) {
    return { type: 'html', html: html('air', String(p.color)), lng: pt[0], lat: pt[1] };
  },
  layers: ['aq-circle', 'aq-text'],
  clickLayers: ['aq-circle'],
});
