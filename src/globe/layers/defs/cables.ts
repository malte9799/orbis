import { defineExtra } from '../types';
import { cardHtml } from '../../popup';
import { escapeHtml } from '../../../util';
import { loadCables } from '../../../api/infra';

export default defineExtra({
  id: 'cables',
  order: 560,
  section: 'infra',
  cat: 'netze',
  label: 'Seekabel',
  hint: 'Unterseekabel (unvollständig) – OpenStreetMap',
  glyph: 'cable',
  icon: 'cable',
  color: '#9c6bff',
  sources: { cables: 'Seekabel: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap-Mitwirkende</a> (ODbL)' },
  addLayers({ add, hidden }) {
    add(
      {
        id: 'cables',
        type: 'line',
        source: 'cables',
        layout: { ...hidden, 'line-join': 'round' },
        paint: {
          'line-color': ['coalesce', ['get', 'color'], '#9c6bff'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 1, 1, 6, 2.2],
          'line-opacity': 0.85,
        },
      },
      'lbl-border-country',
    );
  },
  enable(ctx) {
    ctx.loadOnce('cables', Infinity, async () => {
      const fc = await loadCables();
      ctx.setData('cables', fc);
      return { count: fc.features.length };
    });
  },
  click({ p, at }) {
    const id = String(p.id ?? '');
    const rows = [
      ['Betreiber', p.operator],
      ['In Betrieb seit', p.since],
    ].filter(([, v]) => v);
    return {
      type: 'html',
      html: cardHtml({
        glyph: 'cable',
        color: String(p.color ?? '#9c6bff'),
        title: String(p.name || 'Seekabel'),
        subtitle: 'Unterseekabel (Telekommunikation)',
        source: 'OpenStreetMap-Mitwirkende (ODbL)',
        url: id ? `https://www.openstreetmap.org/way/${encodeURIComponent(id)}` : undefined,
        extra: rows.length ? `<div class="pop-grid two">${rows.map(([k, v]) => `<span>${k}</span><b>${escapeHtml(String(v))}</b>`).join('')}</div>` : undefined,
      }),
      lng: at.lng,
      lat: at.lat,
    };
  },
  layers: ['cables'],
  clickLayers: ['cables'],
});
