import { defineExtra } from '../types';
import { t } from '../../../i18n';
import { loadTideDetails, loadTideStations } from '../../../api/ocean';
import { cardHtml } from '../../popup';
import { escapeHtml } from '../../../util';
import { dateTimeTxt, heightTxt } from '../../../units';

export default defineExtra({
  id: 'tides',
  order: 230,
  section: 'ocean',
  cat: 'meer',
  label: 'Gezeitenpegel USA',
  hint: 'Wasserstand und nächste Hoch-/Niedrigwasser per Klick – NOAA CO-OPS',
  glyph: 'gauge',
  icon: 'wave',
  color: '#42a5f5',
  region: 'USA',
  sources: { tides: 'Pegel: <a href="https://tidesandcurrents.noaa.gov/">NOAA CO-OPS</a>' },
  addLayers({ add, hidden }) {
    add(
      {
        id: 'tides',
        type: 'circle',
        source: 'tides',
        minzoom: 3,
        layout: hidden,
        paint: { 'circle-color': '#42a5f5', 'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 2.5, 9, 6], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1 },
      },
      'gauges',
    );
  },
  enable(ctx) {
    ctx.loadOnce('tides', Infinity, async () => {
      const fc = await loadTideStations();
      ctx.setData('tides', fc);
      return { count: fc.features.length, note: t('layers.tides.note') };
    });
  },
  click({ p, pt }) {
    const id = String(p.id);
    return {
      type: 'html',
      html: cardHtml({ glyph: 'gauge', color: '#42a5f5', title: p.title, subtitle: p.subtitle, source: p.source, url: p.url, extra: '<div class="pop-loading small">Pegeldaten werden geladen …</div>' }),
      lng: pt[0],
      lat: pt[1],
      after: (node) => {
        loadTideDetails(id)
          .then((d) => {
            const t = (iso: string) => dateTimeTxt(new Date(iso), { weekday: 'short', hour: '2-digit', minute: '2-digit' });
            const rows: [string, string][] = [];
            if (d.level) rows.push([t('layers.tides.rowLevel'), `${heightTxt(d.level.v, 2)} (über MLLW) · ${t(d.level.t)}`]);
            for (const n of d.next) rows.push([n.type === 'H' ? 'Hochwasser' : 'Niedrigwasser', `${t(n.t)} · ${heightTxt(n.v, 2)}`]);
            const el = node.querySelector('.pop-loading');
            if (el) el.outerHTML = `<div class="pop-grid two">${rows.map(([k, v]) => `<span>${k}</span><b>${escapeHtml(v)}</b>`).join('')}</div>`;
          })
          .catch(() => {
            const el = node.querySelector('.pop-loading');
            if (el) el.textContent = t('layers.tides.noteNoData');
          });
      },
    };
  },
  layers: ['tides'],
  clickLayers: ['tides'],
});
