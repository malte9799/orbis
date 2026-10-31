import type { ExpressionSpecification } from 'maplibre-gl';
import { t } from '../../../i18n';
import { defineExtra } from '../types';
import { FONT_REGULAR } from '../../vector';
import { cardHtml } from '../../popup';
import { escapeHtml } from '../../../util';
import { loadPorts } from '../../../api/ports';

export default defineExtra({
  id: 'ports',
  order: 430,
  section: 'infra',
  cat: 'erde',
  label: 'Häfen',
  hint: '~16.000 Seehäfen mit Größe, Tiefen und Umschlag – NGA World Port Index, UN/LOCODE',
  glyph: 'vessel',
  icon: 'layers',
  color: '#ffb74d',
  sources: { ports: 'Häfen: <a href="https://msi.nga.mil/Publications/WPI">NGA World Port Index</a>, UN/LOCODE von <a href="https://opendata.upply.com/seaports">Upply</a> (CC BY 4.0)' },
  addLayers({ add, hidden }) {
    // ports: the bigger, the earlier (zoom 2 / 5 / 7 / 9 / 11); a port that is not yet "due" has radius 0
    const byTier = (...v: number[]): ExpressionSpecification => ['case', ['<=', ['get', 'tier'], 1], v[0], ['<=', ['get', 'tier'], 2], v[1], ['<=', ['get', 'tier'], 3], v[2], ['<=', ['get', 'tier'], 4], v[3], v[4]];
    const dueAt = (tier: number, r: number): ExpressionSpecification => ['case', ['<=', ['get', 'tier'], tier], r, 0];
    add(
      {
        id: 'ports',
        type: 'circle',
        source: 'ports',
        layout: { ...hidden, 'circle-sort-key': ['-', 0, ['get', 'tier']] },
        paint: {
          'circle-color': '#ffb74d',
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, dueAt(1, 3.5), 4.5, dueAt(1, 5), 5, dueAt(2, 4.5), 7, dueAt(3, 4.5), 9, dueAt(4, 5), 11, byTier(7, 6.5, 6, 5.5, 5)],
          'circle-stroke-color': '#1b1200',
          'circle-stroke-width': 1,
        },
      },
      'marker',
    );
    add(
      {
        id: 'ports-label',
        type: 'symbol',
        source: 'ports',
        layout: {
          ...hidden,
          'text-field': ['step', ['zoom'], '', 5, ['case', ['<=', ['get', 'tier'], 1], ['get', 'name'], ''], 7, ['case', ['<=', ['get', 'tier'], 2], ['get', 'name'], ''], 9, ['case', ['<=', ['get', 'tier'], 3], ['get', 'name'], ''], 11, ['get', 'name']],
          'text-font': FONT_REGULAR,
          'text-size': 11,
          'text-offset': [0, 0.9],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: { 'text-color': '#ffe0b2', 'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1.2 },
      },
      'marker',
    );
  },
  enable(ctx) {
    ctx.loadOnce('ports', Infinity, async () => {
      const fc = await loadPorts();
      ctx.setData('ports', fc);
      return { count: fc.features.length, note: t('layers.ports.note') };
    });
  },
  click({ p, pt }) {
    const row = (k: string, v: unknown, unit = '') => (v === '' || v == null ? null : [k, `${v}${unit}`]);
    const rows = [
      row(t('layers.ports.rowSize'), p.size),
      row(t('layers.ports.rowType'), p.type),
      row(t('layers.ports.rowChannel'), p.channel, ' m'),
      row(t('layers.ports.rowPier'), p.pier, ' m'),
      row(t('layers.ports.rowMaxShip'), p.length, t('layers.ports.suffix')),
      row(t('layers.ports.rowDraft'), p.draft, ' m'),
      row(t('layers.ports.rowPilot'), p.pilot),
      row(t('layers.ports.rowShelter'), p.shelter),
      row(t('layers.ports.rowCargo'), p.fac),
    ].filter(Boolean) as string[][];
    const extra = rows.length ? `<div class="pop-grid two">${rows.map(([k, v]) => `<span>${k}</span><b>${escapeHtml(v)}</b>`).join('')}</div>` : '';
    return {
      type: 'html',
      html: cardHtml({
        glyph: 'vessel',
        color: '#ffb74d',
        title: p.name,
        subtitle: [p.code, p.country].filter(Boolean).join(' · '),
        source: p.wpi ? 'NGA World Port Index' : 'UN/LOCODE (Upply, CC BY 4.0)',
        extra,
      }),
      lng: pt[0],
      lat: pt[1],
    };
  },
  layers: ['ports', 'ports-label'],
  clickLayers: ['ports'],
});
