import { defineExtra, type ExtraCtx } from '../types';
import type { FeatureCollection, Point } from 'geojson';
import { empty } from '../shared/geo';
import { ALPR_FOV_ANGLE, ALPR_FOV_RADIUS, ALPR_FOV_ZOOM, ALPR_MOUNT, CAM_DETAIL_ZOOM, CARDINAL, fovSectors } from '../shared/cams';
import { CCTV_LIMIT, loadCctv } from '../../../api/cams';
import { cardHtml } from '../../popup';
import { escapeHtml } from '../../../util';
import { isSuperseded } from '../../../api/overpass';
import { coordsTxt } from '../../../units';

/** dense cities hold thousands of cameras, so a smaller area keeps the query fast */
const CCTV_ZOOM = CAM_DETAIL_ZOOM + 3;
const CCTV_COLOR = '#a78bfa';
const CTYPE: Record<string, string> = { fixed: 'fest', dome: 'Kuppel', panning: 'Schwenkkamera', ptz: 'PTZ' };
const KIND: Record<string, string> = { public: 'öffentlicher Raum', outdoor: 'außen (privat)', indoor: 'innen' };

type St = { key: string; fc: FeatureCollection<Point> | null; fovKey: string };
const getState = (ctx: ExtraCtx) => ctx.state<St>('cctv', () => ({ key: '', fc: null, fovKey: '' }));

function updateCones(ctx: ExtraCtx) {
  const st = getState(ctx);
  const cams: [number, number, number][] = [];
  if (st.fc && ctx.map.getZoom() >= ALPR_FOV_ZOOM) {
    for (const f of st.fc.features) {
      const d = Number(f.properties?.dir);
      if (Number.isFinite(d) && d >= 0) cams.push([f.geometry.coordinates[0], f.geometry.coordinates[1], d]);
    }
  }
  const key = cams.map((c) => c.join(',')).join('|');
  if (key === st.fovKey) return;
  st.fovKey = key;
  ctx.setData('cctv-fov', { type: 'FeatureCollection', features: fovSectors(cams, ALPR_FOV_RADIUS, ALPR_FOV_ANGLE) });
}

function loadNow(ctx: ExtraCtx) {
  const st = getState(ctx);
  if (ctx.map.getZoom() < CCTV_ZOOM) {
    ctx.setData('cctv', empty());
    st.key = '';
    st.fc = null;
    updateCones(ctx);
    ctx.set('cctv', { note: `Überwachungskameras ab Zoomstufe ${CCTV_ZOOM} (Städte haben tausende)` });
    return;
  }
  const b = ctx.viewBounds();
  const key = Object.values(b).join(',');
  if (key === st.key) return;
  st.key = key;
  ctx.set('cctv', { loading: true, note: undefined });
  loadCctv(b)
    .then((fc) => {
      if (st.key !== key) return;
      ctx.setData('cctv', fc);
      st.fc = fc;
      updateCones(ctx);
      const n = fc.features.length;
      ctx.set('cctv', {
        loading: false,
        count: n,
        note: n >= CCTV_LIMIT ? 'Obergrenze erreicht – näher heranzoomen' : n ? 'nur das, was Mapper erfasst haben – real gibt es deutlich mehr' : 'keine Kameras im Ausschnitt erfasst',
      });
    })
    .catch((e) => {
      if (isSuperseded(e) || st.key !== key) return;
      console.warn('Overpass CCTV', e);
      st.key = '';
      ctx.set('cctv', { loading: false, note: 'OpenStreetMap (Overpass) nicht erreichbar' });
    });
}

export default defineExtra({
  id: 'cctv',
  order: 695,
  section: 'cams',
  cat: 'medien',
  label: 'Überwachungskameras',
  hint: 'CCTV-Kameras aus OpenStreetMap (ab Zoom 12) – ohne Kennzeichenleser und Webcams',
  glyph: 'cctv',
  icon: 'cam',
  color: CCTV_COLOR,
  sources: { cctv: 'Überwachungskameras: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap-Mitwirkende</a> (ODbL)', 'cctv-fov': '' },
  addLayers({ add, hidden }) {
    add({ id: 'cctv-cone', type: 'fill', source: 'cctv-fov', layout: hidden, paint: { 'fill-color': CCTV_COLOR, 'fill-opacity': 0.25 } }, 'marker');
    add({ id: 'cctv-cone-line', type: 'line', source: 'cctv-fov', layout: hidden, paint: { 'line-color': CCTV_COLOR, 'line-width': 1.1, 'line-opacity': 0.8 } }, 'marker');
    add(
      {
        id: 'cctv',
        type: 'circle',
        source: 'cctv',
        layout: hidden,
        paint: {
          'circle-color': CCTV_COLOR,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 2.5, 14, 5.5],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 12, 0, 14, 1.3],
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
    const rows = [
      ['Bereich', KIND[String(p.kind)] ?? p.kind],
      ['Bauart', CTYPE[String(p.ctype)] ?? p.ctype],
      ['Montage', ALPR_MOUNT[String(p.mount)] ?? p.mount],
      ['Blickrichtung', dir >= 0 ? `${Math.round(dir)}° (${card})` : ''],
      ['Betreiber', p.operator],
      ['Seit', p.since],
      ['Kennung', p.ref],
      ['Position', coordsTxt(pt[1] as number, pt[0] as number)],
    ].filter(([, v]) => v);
    const extra = rows.length ? `<div class="pop-grid two">${rows.map(([k, v]) => `<span>${k}</span><b>${escapeHtml(String(v))}</b>`).join('')}</div>` : '';
    return { type: 'html', html: cardHtml({ glyph: 'cctv', color: CCTV_COLOR, title: p.title, subtitle: p.subtitle, source: 'OpenStreetMap (ODbL)', url: p.url, extra }), lng: pt[0], lat: pt[1] };
  },
  layers: ['cctv-cone', 'cctv-cone-line', 'cctv'],
  clickLayers: ['cctv'],
});
