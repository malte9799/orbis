import { defineExtra } from '../types';
import { t } from '../../../i18n';
import { loadPegel } from '../../../api/europe';

export default defineExtra({
  id: 'gauges',
  order: 30,
  section: 'europe',
  cat: 'meer',
  label: 'Pegel & Hochwasser DE',
  hint: 'PEGELONLINE, Bundeswasserstraßen',
  glyph: 'gauge',
  icon: 'gauge',
  color: '#3d9ad1',
  region: 'DE',
  enable(ctx) {
    ctx.loadOnce('gauges', 15 * 60000, async () => {
      const fc = await loadPegel();
      ctx.setData('gauges', fc);
      const high = fc.features.filter((f) => f.properties.state === 'high').length;
      return { count: fc.features.length, note: high ? t('layers.gauges.note', { high }) : undefined };
    });
  },
  click({ p, pt, html }) {
    return { type: 'html', html: html('gauge', String(p.color)), lng: pt[0], lat: pt[1] };
  },
  layers: ['gauges'],
  clickLayers: ['gauges'],
});
