import { defineExtra, type ExtraCtx } from '../types';
import { t } from '../../../i18n';
import { loadRivers } from '../../../api/ocean';
import { waveLabel } from '../shared/ocean';

type St = { key: string };
const getState = (ctx: ExtraCtx) => ctx.state<St>('rivers', () => ({ key: '' }));

function loadNow(ctx: ExtraCtx) {
  const st = getState(ctx);
  const b = ctx.map.getBounds();
  const q = (v: number) => Math.round(v / 2) * 2;
  const key = [q(b.getWest()), q(b.getSouth()), q(b.getEast()), q(b.getNorth())].join(',');
  if (key === st.key) return;
  st.key = key;
  ctx.set('rivers', { loading: true });
  loadRivers({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth(), zoom: ctx.map.getZoom() })
    .then((r) => {
      if (st.key !== key) return;
      ctx.setData('rivers', r.fc);
      ctx.set('rivers', { loading: false, count: r.fc.features.length, note: r.fc.features.length ? t('layers.rivers.noteGrid', { step: r.step }) : t('layers.rivers.noteNone') });
    })
    .catch((e) => {
      console.warn('Open-Meteo Flood', e);
      st.key = '';
      ctx.set('rivers', { loading: false, note: e instanceof Error && /Limit/.test(e.message) ? e.message : t('layers.rivers.noteFail') });
    });
}

export default defineExtra({
  id: 'rivers',
  order: 210,
  section: 'ocean',
  cat: 'meer',
  label: 'Flussabfluss & Hochwasser',
  hint: 'Abfluss in m³/s mit 7-Tage-Trend an Flüssen im Kartenausschnitt – GloFAS via Open-Meteo',
  glyph: 'flood',
  icon: 'flood',
  color: '#1e88e5',
  sources: { rivers: 'Flüsse: <a href="https://open-meteo.com/en/docs/flood-api">Open-Meteo Flood</a> / GloFAS (CC BY 4.0)' },
  addLayers({ add, hidden }) {
    add(
      {
        id: 'rivers',
        type: 'circle',
        source: 'rivers',
        layout: { ...hidden, 'circle-sort-key': ['get', 'q'] },
        paint: { 'circle-color': ['get', 'color'], 'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 4, 9, 11], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1 },
      },
      'gauges',
    );
    add({ ...waveLabel('rivers-label', 'rivers'), minzoom: 5 }, 'marker');
  },
  click({ p, pt, html }) {
    return { type: 'html', html: html('flood', String(p.color)), lng: pt[0], lat: pt[1] };
  },
  enable(ctx) {
    loadNow(ctx);
  },
  disable(ctx) {
    getState(ctx).key = '';
  },
  onMoveEnd: loadNow,
  layers: ['rivers', 'rivers-label'],
  clickLayers: ['rivers'],
});
