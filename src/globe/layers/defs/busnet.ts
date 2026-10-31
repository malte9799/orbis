import { defineExtra, type ExtraCtx } from '../types';
import { t } from '../../../i18n';
import { FONT_BOLD } from '../../vector';
import { cardHtml } from '../../popup';
import { escapeHtml } from '../../../util';
import { isSuperseded } from '../../../api/overpass';
import { loadTransitNetwork } from '../../../api/networks';

type St = { key: string };
const getState = (ctx: ExtraCtx) => ctx.state<St>('busnet', () => ({ key: '' }));

function loadNow(ctx: ExtraCtx) {
  const st = getState(ctx);
  const z = ctx.map.getZoom();
  if (z < 11) {
    ctx.set('busnet', { note: t('layers.busnet.noteZoom') });
    return;
  }
  const b = ctx.viewBounds(z >= 13 ? 50 : 10);
  const key = Object.values(b).join(',');
  if (key === st.key) return;
  st.key = key;
  ctx.set('busnet', { loading: true, note: undefined });
  loadTransitNetwork(b)
    .then((r) => {
      if (st.key !== key) return;
      ctx.setData('busnet', r.lines);
      ctx.setData('busnet-stops', r.stops);
      const modes = new Set(r.lines.features.map((f) => f.properties?.modeLabel));
      ctx.set('busnet', { loading: false, count: r.lines.features.length, note: r.lines.features.length ? t('layers.busnet.noteLines', { modes: [...modes].join(', ') }) : t('layers.busnet.noteNone') });
    })
    .catch((e) => {
      if (isSuperseded(e) || st.key !== key) return;
      console.warn('Overpass ÖPNV', e);
      st.key = '';
      ctx.set('busnet', { loading: false, note: t('layers.busnet.noteFail') });
    });
}

export default defineExtra({
  id: 'busnet',
  order: 480,
  section: 'networks',
  cat: 'netze',
  label: 'Bus- & ÖPNV-Netz',
  hint: 'Bus-, Tram-, U-Bahn- und Fährlinien mit Haltestellen (ab Stadtzoom) – OpenStreetMap',
  glyph: 'train',
  icon: 'bus',
  color: '#7e57c2',
  sources: { busnet: 'ÖPNV-Netz: © OpenStreetMap-Mitwirkende', 'busnet-stops': 'ÖPNV-Netz: © OpenStreetMap-Mitwirkende' },
  addLayers({ add, hidden }) {
    add(
      {
        id: 'busnet-line',
        type: 'line',
        source: 'busnet',
        layout: { ...hidden, 'line-join': 'round', 'line-cap': 'round', 'line-sort-key': ['get', 'order'] },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, ['match', ['get', 'mode'], 'bus', 1.2, 2], 16, ['match', ['get', 'mode'], 'bus', 3, 5]],
          'line-opacity': 0.85,
        },
      },
      'lbl-border-country',
    );
    add(
      {
        id: 'busnet-stop',
        type: 'circle',
        source: 'busnet-stops',
        minzoom: 13,
        layout: hidden,
        paint: { 'circle-color': '#ffffff', 'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 2, 17, 5], 'circle-stroke-color': '#7e57c2', 'circle-stroke-width': 1.5 },
      },
      'marker',
    );
    add(
      {
        id: 'busnet-label',
        type: 'symbol',
        source: 'busnet',
        minzoom: 12,
        filter: ['!=', ['get', 'ref'], ''],
        layout: {
          ...hidden,
          'symbol-placement': 'line',
          'symbol-spacing': 300,
          'text-field': ['get', 'ref'],
          'text-font': FONT_BOLD,
          'text-size': 10,
          'text-rotation-alignment': 'viewport',
        },
        paint: { 'text-color': '#ffffff', 'text-halo-color': ['get', 'color'], 'text-halo-width': 2.5 },
      },
      'marker',
    );
  },
  enable(ctx) {
    loadNow(ctx);
  },
  onMoveEnd: loadNow,
  click({ p, at }) {
    const rows = [
      ['Verkehrsmittel', p.modeLabel],
      ['Strecke', p.from && p.to ? `${p.from} → ${p.to}` : ''],
      ['Betreiber', p.operator],
    ].filter(([, v]) => v);
    return {
      type: 'html',
      html: cardHtml({
        glyph: 'train',
        color: String(p.color),
        title: p.ref ? `${p.modeLabel} ${p.ref}` : p.name || String(p.modeLabel),
        subtitle: p.ref ? p.name : '',
        source: 'OpenStreetMap',
        url: p.url,
        extra: `<div class="pop-grid two">${rows.map(([k, v]) => `<span>${k}</span><b>${escapeHtml(v)}</b>`).join('')}</div>`,
      }),
      lng: at.lng,
      lat: at.lat,
    };
  },
  layers: ['busnet-line', 'busnet-label', 'busnet-stop'],
  clickLayers: ['busnet-line'],
});
