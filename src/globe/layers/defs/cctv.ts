import { defineExtra, type ExtraCtx } from '../types';
import type { FeatureCollection, Point } from 'geojson';
import { empty } from '../shared/geo';
import { DATA_BASE } from '../../../api/data';
import { fetchJson } from '../../../util';
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

type St = { key: string; fc: FeatureCollection<Point> | null; fovKey: string; heat: 'idle' | 'loading' | 'done' };
const getState = (ctx: ExtraCtx) => ctx.state<St>('cctv', () => ({ key: '', fc: null, fovKey: '', heat: 'idle' }));

/** monthly density files per region (scripts/cctv-heat.mjs), on their own branch next to `data` */
const HEAT_BASE = DATA_BASE.replace(/\/data\/$/, '/data-cctv/');
const HEAT_REGIONS = ['europe', 'russia', 'asia', 'north-america', 'central-america', 'south-america', 'africa', 'oceania'];

async function loadHeat(ctx: ExtraCtx) {
  const st = getState(ctx);
  if (st.heat !== 'idle') return;
  st.heat = 'loading';
  const parts = await Promise.allSettled(HEAT_REGIONS.map((r) => fetchJson<[number, number, number][]>(`${HEAT_BASE}cctv-${r}.json`, undefined, 40000)));
  const cells = parts.flatMap((p) => (p.status === 'fulfilled' ? p.value : []));
  if (!cells.length) {
    st.heat = 'idle';
    return;
  }
  st.heat = 'done';
  if (ctx.map.getZoom() < CCTV_ZOOM) ctx.set('cctv', { note: `Übersicht aus Monatsauszug · Einzelkameras ab Zoomstufe ${CCTV_ZOOM}` });
  ctx.setData('cctv-world', {
    type: 'FeatureCollection',
    features: cells.map(([lon, lat, n]) => ({ type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [lon, lat] }, properties: { n } })),
  });
}

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
    ctx.set('cctv', { note: st.heat === 'done' ? `Übersicht aus Monatsauszug · Einzelkameras ab Zoomstufe ${CCTV_ZOOM}` : `Einzelkameras ab Zoomstufe ${CCTV_ZOOM}` });
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
  hint: 'CCTV-Kameras aus OpenStreetMap: Dichte-Übersicht (Monatsauszug), Einzelkameras ab Zoom 12 – ohne Kennzeichenleser und Webcams',
  glyph: 'cctv',
  icon: 'cam',
  color: CCTV_COLOR,
  sources: { 'cctv-world': 'Kameradichte: © OpenStreetMap-Mitwirkende (ODbL), Auszüge von Geofabrik', cctv: 'Überwachungskameras: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap-Mitwirkende</a> (ODbL)', 'cctv-fov': '' },
  addLayers({ add, hidden }) {
    // overview: density of the monthly extracts, fades out where the single cameras take over
    add(
      {
        id: 'cctv-heat',
        type: 'heatmap',
        source: 'cctv-world',
        layout: hidden,
        maxzoom: CCTV_ZOOM + 1,
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'n'], 1, 0.15, 10, 0.5, 100, 1],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 2, 4, 8, 14, 11, 22],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 2, 0.35, 8, 1],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.85, CCTV_ZOOM - 1, 0.6, CCTV_ZOOM + 1, 0],
          'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(167,139,250,0)', 0.2, 'rgba(167,139,250,0.45)', 0.5, '#c4b5fd', 0.8, '#ede9fe', 1, '#ffffff'],
        },
      },
      'marker',
    );
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
    void loadHeat(ctx);
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
  layers: ['cctv-heat', 'cctv-cone', 'cctv-cone-line', 'cctv'],
  clickLayers: ['cctv'],
});
