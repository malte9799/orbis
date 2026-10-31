import { defineExtra, type ExtraCtx } from '../types';
import { t } from '../../../i18n';
import { loadDwdWarnings } from '../../../api/europe';

async function loadDwd(ctx: ExtraCtx) {
  try {
    const fc = await loadDwdWarnings();
    ctx.setData('dwd-warn', fc);
    ctx.vis('dwd', false);
    return { count: fc.features.length, note: fc.features.length ? undefined : t('layers.dwdwarn.noteNone') };
  } catch (e) {
    // WFS unavailable – fall back to the rendered WMS image (not clickable)
    console.warn('DWD WFS', e);
    ctx.vis('dwd', ctx.isOn('dwdwarn'));
    return { note: t('layers.dwdwarn.noteImage') };
  }
}

export default defineExtra({
  id: 'dwdwarn',
  order: 20,
  section: 'europe',
  cat: 'gefahr',
  label: 'Unwetterwarnungen DE',
  hint: 'Deutscher Wetterdienst, amtlich',
  glyph: 'warn',
  icon: 'warn',
  color: '#e53935',
  region: 'DE',
  enable(ctx) {
    // the WMS image only stands in while the warnings are not available as data
    if (ctx.info('dwdwarn')?.note) ctx.vis('dwd', true);
    ctx.loadOnce('dwdwarn', 10 * 60000, () => loadDwd(ctx));
  },
  disable(ctx) {
    ctx.vis('dwd', false);
  },
  click({ p, at, html }) {
    return { type: 'html', html: html('warn', String(p.color)), lng: at.lng, lat: at.lat };
  },
  layers: ['dwd-warn-fill', 'dwd-warn-line'],
  clickLayers: ['dwd-warn-fill'],
});
