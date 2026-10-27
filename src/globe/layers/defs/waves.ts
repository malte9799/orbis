import { defineExtra, type ExtraCtx } from '../types';
import { loadWaves } from '../../../api/ocean';
import { waveLabel } from '../shared/ocean';
import { heightUnit } from '../../../units';

type St = { key: string };
const getState = (ctx: ExtraCtx) => ctx.state<St>('waves', () => ({ key: '' }));

function loadNow(ctx: ExtraCtx) {
  const st = getState(ctx);
  const b = ctx.map.getBounds();
  const z = ctx.map.getZoom();
  const q = (v: number) => Math.round(v / 2) * 2;
  const key = [q(b.getWest()), q(b.getSouth()), q(b.getEast()), q(b.getNorth())].join(',');
  if (key === st.key) return;
  st.key = key;
  ctx.set('waves', { loading: true });
  loadWaves({ west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth(), zoom: z })
    .then((r) => {
      if (st.key !== key) return;
      ctx.setData('waves', r.fc);
      ctx.set('waves', { loading: false, count: r.fc.features.length, note: `Raster ${r.step}° · Zahl = Wellenhöhe in ${heightUnit()} – zoomen für feineres Raster` });
    })
    .catch((e) => {
      console.warn('Open-Meteo Marine', e);
      st.key = '';
      ctx.set('waves', { loading: false, note: e instanceof Error && /Limit/.test(e.message) ? e.message : 'Open-Meteo Marine nicht erreichbar' });
    });
}

export default defineExtra({
  id: 'waves',
  order: 200,
  section: 'ocean',
  cat: 'meer',
  label: 'Seegang & Strömung',
  hint: 'Wellenhöhe, Dünung und Meeresströmung im Kartenausschnitt – Open-Meteo Marine',
  glyph: 'tsunami',
  icon: 'wave',
  color: '#26c6da',
  sources: { waves: 'Seegang: <a href="https://open-meteo.com/en/docs/marine-weather-api">Open-Meteo Marine</a> (CC BY 4.0)' },
  addLayers({ add, hidden }) {
    add(
      {
        id: 'waves',
        type: 'circle',
        source: 'waves',
        layout: hidden,
        paint: { 'circle-color': ['get', 'color'], 'circle-opacity': 0.8, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 1, 7, 8, 16], 'circle-stroke-color': 'rgba(0,0,0,0.4)', 'circle-stroke-width': 1 },
      },
      'gauges',
    );
    add(waveLabel('waves-label', 'waves'), 'marker');
  },
  click({ p, pt, html }) {
    return { type: 'html', html: html('tsunami', String(p.color)), lng: pt[0], lat: pt[1] };
  },
  enable(ctx) {
    loadNow(ctx);
  },
  disable(ctx) {
    getState(ctx).key = '';
  },
  onMoveEnd: loadNow,
  layers: ['waves', 'waves-label'],
  clickLayers: ['waves'],
});
