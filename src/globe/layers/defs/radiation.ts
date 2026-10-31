import { defineExtra } from '../types';
import { t } from '../../../i18n';
import { FONT_BOLD } from '../../vector';
import { loadRadiation } from '../../../api/earth';

export default defineExtra({
  id: 'radiation',
  order: 110,
  section: 'earth',
  cat: 'gefahr',
  label: 'Radioaktivität',
  hint: 'Ortsdosisleistung – BfS (DE), EURDEP (40+ Länder, u. a. Frankreich, Türkei, Kanada), Safecast (weltweit)',
  glyph: 'radiation',
  icon: 'radiation',
  color: '#c0ca33',
  sources: { radiation: 'Radioaktivität: <a href="https://odlinfo.bfs.de/">BfS</a> (DL-DE 2.0), <a href="https://remap.jrc.ec.europa.eu/">EURDEP</a>, <a href="https://safecast.org/">Safecast</a> (CC0)' },
  addLayers({ add, hidden }) {
    add(
      {
        id: 'radiation',
        type: 'circle',
        source: 'radiation',
        layout: { ...hidden, 'circle-sort-key': ['get', 'v'] },
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 3, 9, 7],
          'circle-stroke-color': 'rgba(0,0,0,0.55)',
          'circle-stroke-width': 1,
        },
      },
      'gauges',
    );
    add(
      {
        id: 'radiation-label',
        type: 'symbol',
        source: 'radiation',
        minzoom: 8,
        layout: { ...hidden, 'text-field': ['get', 'label'], 'text-font': FONT_BOLD, 'text-size': 10, 'text-offset': [0, 1.2], 'text-anchor': 'top', 'text-optional': true },
        paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1.2 },
      },
      'marker',
    );
  },
  enable(ctx) {
    ctx.loadOnce('radiation', 60 * 60000, async () => {
      const r = await loadRadiation();
      ctx.setData('radiation', r.fc);
      return { count: r.fc.features.length, note: r.failed.length ? t('layers.radiation.noteFail', { failed: r.failed.join(', ') }) : t('layers.radiation.noteFallback') };
    });
  },
  click({ p, pt, html }) {
    return { type: 'html', html: html('radiation', String(p.color)), lng: pt[0], lat: pt[1] };
  },
  layers: ['radiation', 'radiation-label'],
  clickLayers: ['radiation'],
});
