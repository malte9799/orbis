import { defineExtra } from '../types';
import { t } from '../../../i18n';
import { loadFirePerimeters } from '../../../api/earth';

export default defineExtra({
  id: 'fireareas',
  order: 80,
  section: 'earth',
  cat: 'erde',
  label: 'Brandflächen USA',
  hint: 'aktuelle Waldbrand-Umrisse – NIFC',
  glyph: 'fire',
  icon: 'layers',
  color: '#ff5722',
  sources: { fireareas: 'Brandflächen: <a href="https://data-nifc.opendata.arcgis.com/">NIFC</a>' },
  addLayers({ add, hidden }) {
    add(
      {
        id: 'fireareas-fill',
        type: 'fill',
        source: 'fireareas',
        layout: hidden,
        paint: { 'fill-color': '#ff3d00', 'fill-opacity': 0.4 },
      },
      'lbl-border-country',
    );
    add(
      {
        id: 'fireareas-line',
        type: 'line',
        source: 'fireareas',
        layout: hidden,
        paint: { 'line-color': '#ffab40', 'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.6, 10, 2] },
      },
      'lbl-border-country',
    );
  },
  enable(ctx) {
    ctx.loadOnce('fireareas', 30 * 60000, async () => {
      const fc = await loadFirePerimeters();
      ctx.setData('fireareas', fc);
      return { count: fc.features.length, note: fc.features.length ? undefined : t('layers.fireareas.noteNone') };
    });
  },
  click({ at, html }) {
    return { type: 'html', html: html('fire', '#ff5722'), lng: at.lng, lat: at.lat };
  },
  layers: ['fireareas-fill', 'fireareas-line'],
  clickLayers: ['fireareas-fill'],
});
