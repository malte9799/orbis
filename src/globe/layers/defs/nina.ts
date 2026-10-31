import { defineExtra } from '../types';
import { t } from '../../../i18n';
import { cardHtml } from '../../popup';
import { escapeHtml } from '../../../util';
import { loadNina, loadNinaDetails } from '../../../api/transit';

export default defineExtra({
  id: 'nina',
  order: 40,
  section: 'europe',
  cat: 'gefahr',
  label: 'Bevölkerungswarnungen',
  hint: 'NINA: MoWaS, KATWARN, BIWAPP, Hochwasser, Polizei',
  glyph: 'warn',
  icon: 'warn',
  color: '#c2185b',
  region: 'DE',
  sources: { nina: 'Warnungen: <a href="https://warnung.bund.de/">NINA / BBK</a>' },
  addLayers({ add, hidden }) {
    add(
      {
        id: 'nina-fill',
        type: 'fill',
        source: 'nina',
        layout: hidden,
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.25 },
      },
      'lbl-border-country',
    );
    add(
      {
        id: 'nina-line',
        type: 'line',
        source: 'nina',
        layout: hidden,
        paint: { 'line-color': ['get', 'color'], 'line-width': 1.4 },
      },
      'lbl-border-country',
    );
  },
  enable(ctx) {
    ctx.loadOnce('nina', 5 * 60000, async () => {
      const fc = await loadNina();
      ctx.setData('nina', fc);
      const ids = new Set(fc.features.map((f) => f.properties?.id));
      return { count: ids.size, note: ids.size ? undefined : t('layers.nina.noteNone') };
    });
  },
  click({ p, at }) {
    const id = String(p.id ?? '');
    return {
      type: 'html',
      html: cardHtml({ glyph: 'warn', color: String(p.color), title: p.title, subtitle: p.subtitle, date: p.date, source: p.source, url: p.url, extra: '<div class="pop-loading small">Text wird geladen …</div>' }),
      lng: at.lng,
      lat: at.lat,
      after: (node) => {
        loadNinaDetails(id)
          .then((txt) => {
            const el = node.querySelector('.pop-loading');
            if (el) el.outerHTML = txt ? `<p class="pop-desc">${escapeHtml(txt.slice(0, 700))}${txt.length > 700 ? ' …' : ''}</p>` : '';
          })
          .catch(() => node.querySelector('.pop-loading')?.remove());
      },
    };
  },
  layers: ['nina-fill', 'nina-line'],
  clickLayers: ['nina-fill'],
});
