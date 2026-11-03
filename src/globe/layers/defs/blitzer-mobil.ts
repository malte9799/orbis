import { defineExtra, type ExtraCtx } from '../types';
import { empty } from '../shared/geo';
import { CAM_DETAIL_ZOOM, CAM_ZOOM_RED } from '../shared/cams';
import { cardHtml } from '../../popup';
import { escapeHtml } from '../../../util';
import { loadMobileSpeedcams } from '../../../api/cams';
import { speedTxt, coordsTxt } from '../../../units';

type St = { key: string };
const getState = (ctx: ExtraCtx) => ctx.state<St>('blitzer-mobil', () => ({ key: '' }));

function loadNow(ctx: ExtraCtx) {
  const st = getState(ctx);
  if (ctx.map.getZoom() < CAM_DETAIL_ZOOM) {
    ctx.setData('blitzer-mobil', empty());
    st.key = '';
    ctx.set('blitzer-mobil', { note: `Details ab Zoomstufe ${CAM_DETAIL_ZOOM}` });
    return;
  }
  const b = ctx.viewBounds();
  const key = Object.values(b).join(',');
  if (key === st.key) return;
  st.key = key;
  ctx.set('blitzer-mobil', { loading: true, note: undefined });
  loadMobileSpeedcams(b)
    .then((fc) => {
      if (st.key !== key) return;
      ctx.setData('blitzer-mobil', fc);
      const notes = ['Community-Meldungen, keine Fahrwarnung (in DE verboten während der Fahrt)'];
      if (!fc.features.length) notes.unshift('keine Meldungen im Ausschnitt');
      ctx.set('blitzer-mobil', { loading: false, count: fc.features.length, note: notes.join(' · ') });
    })
    .catch((e) => {
      if (st.key !== key) return;
      console.warn('Mobile Blitzer', e);
      st.key = '';
      ctx.set('blitzer-mobil', { loading: false, note: 'Quelle nicht erreichbar (inoffizielle Schnittstelle, Blitzer.de)' });
    });
}

export default defineExtra({
  id: 'blitzer-mobil',
  order: 701,
  section: 'infra',
  cat: 'verkehr',
  label: 'Mobile Blitzer',
  hint: 'Community-gemeldete mobile Geschwindigkeitskontrollen (ab Zoom 9) – inoffizielle, nicht garantierte Quelle (Blitzer.de); Lageplan, keine Fahrwarnung (in DE Nutzung während der Fahrt verboten)',
  glyph: 'blitzer',
  icon: 'blitzer',
  color: '#ff7043',
  sources: { 'blitzer-mobil': 'Mobile Blitzer: Community-Meldungen, inoffizielle Quelle (Blitzer.de) – Lageplan, keine Fahrwarnung' },
  addLayers({ add, hidden }) {
    add(
      {
        id: 'blitzer-mobil',
        type: 'circle',
        source: 'blitzer-mobil',
        layout: hidden,
        paint: {
          'circle-color': '#ff7043',
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
    const raw = String(p.speed ?? '');
    const speed = /^\d+(\.\d+)?$/.test(raw) ? speedTxt(Number(raw)) : /\d/.test(raw) ? raw : '';
    const rows = [
      ['Tempo', speed],
      ['Bestätigungen', p.votes],
      ['Gemeldet', p.reported],
      ['Position', coordsTxt(pt[1] as number, pt[0] as number)],
    ].filter(([, v]) => v);
    const extra = `${rows.length ? `<div class="pop-grid two">${rows.map(([k, v]) => `<span>${k}</span><b>${escapeHtml(String(v))}</b>`).join('')}</div>` : ''}
      <div class="pop-sub">Community-Meldung, inoffizielle Quelle – keine Fahrwarnung: Nutzung während der Fahrt in DE verboten (§ 23 StVO)</div>`;
    return { type: 'html', html: cardHtml({ glyph: 'blitzer', color: CAM_ZOOM_RED, title: p.title, subtitle: p.subtitle, source: 'Blitzer.de (inoffiziell)', extra }), lng: pt[0], lat: pt[1] };
  },
  layers: ['blitzer-mobil'],
  clickLayers: ['blitzer-mobil'],
});
