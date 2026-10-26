import { defineExtra, type ExtraCtx } from '../types';
import { isSuperseded } from '../../../api/overpass';
import { loadPipelines } from '../../../api/resources';

type St = { key: string };
const getState = (ctx: ExtraCtx) => ctx.state<St>('pipelines', () => ({ key: '' }));

function loadNow(ctx: ExtraCtx) {
  const st = getState(ctx);
  const z = ctx.map.getZoom();
  if (z < 8) {
    ctx.set('pipelines', { note: 'ab Zoomstufe 8 sichtbar' });
    return;
  }
  const b = ctx.viewBounds(10);
  const key = Object.values(b).join(',');
  if (key === st.key) return;
  st.key = key;
  ctx.set('pipelines', { loading: true, note: undefined });
  loadPipelines(b)
    .then((fc) => {
      if (st.key !== key) return;
      ctx.setData('pipelines', fc);
      ctx.set('pipelines', { loading: false, count: fc.features.length, note: 'blau Gas · orange Öl · lila Wasserstoff' });
    })
    .catch((e) => {
      if (isSuperseded(e) || st.key !== key) return;
      console.warn('Overpass pipelines', e);
      st.key = '';
      ctx.set('pipelines', { loading: false, note: 'OpenStreetMap (Overpass) nicht erreichbar' });
    });
}

export default defineExtra({
  id: 'pipelines',
  order: 540,
  section: 'infra',
  cat: 'netze',
  label: 'Öl- & Gaspipelines',
  hint: 'Pipelines für Gas, Öl, Wasserstoff (ab Zoom 8) – OpenStreetMap',
  glyph: 'cable',
  icon: 'pipe',
  color: '#29b6f6',
  sources: { pipelines: 'Pipelines: © OpenStreetMap-Mitwirkende' },
  addLayers({ add, hidden }) {
    add(
      {
        id: 'pipelines',
        type: 'line',
        source: 'pipelines',
        layout: { ...hidden, 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.5, 14, 4], 'line-opacity': 0.9 },
      },
      'lbl-border-country',
    );
  },
  enable(ctx) {
    loadNow(ctx);
  },
  onMoveEnd: loadNow,
  click({ p, at, html }) {
    return { type: 'html', html: html('cable', String(p.color)), lng: at.lng, lat: at.lat };
  },
  layers: ['pipelines'],
  clickLayers: ['pipelines'],
});
