import { defineExtra, type ExtraCtx } from '../types';
import { empty } from '../shared/geo';
import { CAM_DETAIL_ZOOM, CAM_ZOOM_RED, CARDINAL } from '../shared/cams';
import { cardHtml } from '../../popup';
import { escapeHtml } from '../../../util';
import { isSuperseded } from '../../../api/overpass';
import { loadSpeedcams } from '../../../api/cams';
import { speedTxt, coordsTxt } from '../../../units';

type St = { key: string };
const getState = (ctx: ExtraCtx) => ctx.state<St>('blitzer', () => ({ key: '' }));

function loadNow(ctx: ExtraCtx) {
  const st = getState(ctx);
  if (ctx.map.getZoom() < CAM_DETAIL_ZOOM) {
    ctx.setData('blitzer', empty());
    st.key = '';
    ctx.set('blitzer', { note: `Details ab Zoomstufe ${CAM_DETAIL_ZOOM} · messpunktgenau, mobile Blitzer fehlen` });
    return;
  }
  const b = ctx.viewBounds();
  const key = Object.values(b).join(',');
  if (key === st.key) return;
  st.key = key;
  ctx.set('blitzer', { loading: true, note: undefined });
  loadSpeedcams(b)
    .then((fc) => {
      if (st.key !== key) return;
      ctx.setData('blitzer', fc);
      const notes = ['Lageplan – keine Fahrwarnung (in DE verboten während der Fahrt)'];
      if (!fc.features.length) notes.unshift('keine Anlagen im Ausschnitt erfasst');
      ctx.set('blitzer', { loading: false, count: fc.features.length, note: notes.join(' · ') });
    })
    .catch((e) => {
      if (isSuperseded(e) || st.key !== key) return;
      console.warn('Overpass Blitzer', e);
      st.key = '';
      ctx.set('blitzer', { loading: false, note: 'OpenStreetMap (Overpass) nicht erreichbar' });
    });
}

export default defineExtra({
  id: 'blitzer',
  order: 700,
  section: 'infra',
  cat: 'verkehr',
  label: 'Blitzer & Rotlicht',
  hint: 'ortsfeste Messstellen, Strecken-Abschnitte und Ampel-Kameras (ab Zoom 9) – OpenStreetMap; Lageplan, keine Fahrwarnung (in DE Nutzung während der Fahrt verboten)',
  glyph: 'blitzer',
  icon: 'blitzer',
  color: '#e53935',
  sources: { blitzer: 'Blitzer: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap-Mitwirkende</a> (ODbL) – Lageplan, keine Fahrwarnung' },
  addLayers({ add, hidden }) {
    add(
      {
        id: 'blitzer',
        type: 'circle',
        source: 'blitzer',
        layout: hidden,
        paint: {
          // red: fixed camera · orange: monitored stretch (average speed) · violet: red-light camera
          'circle-color': ['match', ['get', 'kind'], 'section', '#fb8c00', 'signals', '#ba68c8', CAM_ZOOM_RED],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 3, 14, 6],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 9, 0.6, 14, 1.5],
        },
      },
      'marker',
    );
  },
  enable(ctx) {
    loadNow(ctx);
  },
  onMoveEnd: loadNow,
  click({ p, pt }) {
    const dir = Number(p.dir);
    const card = dir >= 0 ? CARDINAL[Math.round(dir / 45) % 8] : '';
    const raw = String(p.speed ?? '');
    const speed = /^\d+(\.\d+)?$/.test(raw) ? speedTxt(Number(raw)) : /\d/.test(raw) ? raw : '';
    const rows = [
      ['Tempo', speed],
      ['Blickrichtung', dir >= 0 ? `${Math.round(dir)}° (${card})` : ''],
      ['Betreiber', p.operator],
      ['Kennung', p.ref],
      ['Position', coordsTxt(pt[1] as number, pt[0] as number)],
    ].filter(([, v]) => v);
    const extra = `${rows.length ? `<div class="pop-grid two">${rows.map(([k, v]) => `<span>${k}</span><b>${escapeHtml(String(v))}</b>`).join('')}</div>` : ''}
      <div class="pop-sub">Lageplan – keine Fahrwarnung: Nutzung während der Fahrt in DE verboten (§ 23 StVO)</div>`;
    return { type: 'html', html: cardHtml({ glyph: 'blitzer', color: p.kind === 'section' ? '#fb8c00' : p.kind === 'signals' ? '#ba68c8' : CAM_ZOOM_RED, title: p.title, subtitle: p.subtitle, source: 'OpenStreetMap (ODbL)', url: p.url, extra }), lng: pt[0], lat: pt[1] };
  },
  layers: ['blitzer'],
  clickLayers: ['blitzer'],
});
