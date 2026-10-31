import { defineExtra } from '../types';
import { t } from '../../../i18n';
import { loadTsunami } from '../../../api/earth';

export default defineExtra({
  id: 'tsunami',
  order: 90,
  section: 'earth',
  cat: 'gefahr',
  label: 'Tsunami-Meldungen',
  hint: 'NOAA-Tsunamiwarnzentren, letzte 7 Tage',
  glyph: 'tsunami',
  icon: 'tsunami',
  color: '#1e88e5',
  sources: { tsunami: 'Tsunami: <a href="https://www.tsunami.gov/">NOAA</a>' },
  addLayers({ add, hidden }) {
    add(
      {
        id: 'tsunami-ring',
        type: 'circle',
        source: 'tsunami',
        layout: hidden,
        paint: { 'circle-color': 'rgba(0,0,0,0)', 'circle-radius': 16, 'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': 3, 'circle-stroke-opacity': 0.8 },
      },
      'marker',
    );
    add(
      {
        id: 'tsunami',
        type: 'symbol',
        source: 'tsunami',
        layout: { ...hidden, 'icon-image': 'glyph-tsunami', 'icon-size': 0.8, 'icon-allow-overlap': true },
      },
      'marker',
    );
  },
  enable(ctx) {
    ctx.loadOnce('tsunami', 10 * 60000, async () => {
      const fc = await loadTsunami();
      ctx.setData('tsunami', fc);
      const warn = fc.features.filter((f) => f.properties?.level === 'warning').length;
      return { count: fc.features.length, note: !fc.features.length ? t('layers.tsunami.noteNone') : warn ? t('layers.tsunami.noteWarn', { count: warn }) : undefined };
    });
  },
  click({ p, pt, html }) {
    return { type: 'html', html: html('tsunami', String(p.color)), lng: pt[0], lat: pt[1] };
  },
  layers: ['tsunami-ring', 'tsunami'],
  clickLayers: ['tsunami'],
});
