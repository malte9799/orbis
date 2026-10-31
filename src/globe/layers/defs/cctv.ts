import { defineExtra, type ExtraCtx } from '../types';
import { tx } from '../../layers';
import { t } from '../../../i18n';
import type { Feature, FeatureCollection, Point } from 'geojson';
import { empty } from '../shared/geo';
import { DATA_BASE } from '../../../api/data';
import { ALPR_FOV_ANGLE, ALPR_FOV_RADIUS, ALPR_FOV_ZOOM, ALPR_MOUNT, CAM_DETAIL_ZOOM, CARDINAL, fovSectors } from '../shared/cams';
import { cardHtml } from '../../popup';
import { escapeHtml, fetchJson } from '../../../util';
import { coordsTxt } from '../../../units';

/** single cameras from this zoom on (a few 0.5° tiles); below it the density heatmap */
const CCTV_ZOOM = CAM_DETAIL_ZOOM + 2;
const CCTV_COLOR = '#a78bfa';
const CTYPE: Record<string, string> = { fixed: 'fest', dome: 'Kuppel', panning: 'Schwenkkamera', ptz: 'PTZ' };
const KIND: Record<string, string> = { public: 'öffentlicher Raum', outdoor: 'außen (privat)', indoor: 'innen' };

// Data: monthly extracts per region (scripts/cctv-heat.mjs) on their own branch next to `data`:
//   cctv-<region>.json           density cells [lon, lat, count]
//   cctv-<region>-tiles.json     the 0.5° tiles that exist
//   cctv-<region>/<ix>_<iy>.json cameras of one tile (record layout: see `record` in the script)
const HEAT_BASE = DATA_BASE.replace(/\/data\/$/, '/data-osm/');
const REGIONS = ['europe', 'russia', 'asia', 'north-america', 'central-america', 'south-america', 'africa', 'oceania'];
const TILE = 2; // tiles per degree
type Rec = [number, number, number, string, string, string, number, string, number];

type St = {
  key: string;
  fc: FeatureCollection<Point> | null;
  fovKey: string;
  heat: 'idle' | 'loading' | 'done';
  /** tiles that exist per region, null while loading */
  index: Promise<Map<string, Set<string>>> | null;
  tiles: Map<string, Promise<Rec[]>>;
};
const getState = (ctx: ExtraCtx) => ctx.state<St>('cctv', () => ({ key: '', fc: null, fovKey: '', heat: 'idle', index: null, tiles: new Map() }));

async function loadHeat(ctx: ExtraCtx) {
  const st = getState(ctx);
  if (st.heat !== 'idle') return;
  st.heat = 'loading';
  const parts = await Promise.allSettled(REGIONS.map((r) => fetchJson<[number, number, number][]>(`${HEAT_BASE}cctv-${r}.json`, undefined, 40000)));
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

function loadIndex(st: St) {
  st.index ??= Promise.allSettled(REGIONS.map((r) => fetchJson<string[]>(`${HEAT_BASE}cctv-${r}-tiles.json`, undefined, 30000))).then((res) => {
    const index = new Map<string, Set<string>>();
    res.forEach((p, i) => {
      if (p.status === 'fulfilled') index.set(REGIONS[i], new Set(p.value));
    });
    if (!index.size) st.index = null; // try again next time
    return index;
  });
  return st.index;
}

/** cameras of one tile in one region (cached; a failed tile is retried next time) */
function loadTile(st: St, region: string, tile: string): Promise<Rec[]> {
  const key = `${region}/${tile}`;
  let p = st.tiles.get(key);
  if (!p) {
    p = fetchJson<Rec[]>(`${HEAT_BASE}cctv-${key}.json`, undefined, 30000).catch((e) => {
      st.tiles.delete(key);
      throw e;
    });
    st.tiles.set(key, p);
  }
  return p;
}

const toFeature = ([lon, lat, dir, kind, ctype, mount, guard, operator, id]: Rec): Feature<Point> => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [lon, lat] },
  properties: {
    title: guard ? t('layers.cctv.rowGuard') : t('layers.cctv.rowCam'),
    subtitle: [ctype, operator].filter(Boolean).join(' · '),
    dir,
    kind,
    ctype,
    mount,
    operator,
    url: `https://www.openstreetmap.org/node/${id}`,
  },
});

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
    ctx.set('cctv', { loading: false, note: st.heat === 'done' ? `Übersicht aus Monatsauszug · Einzelkameras ab Zoomstufe ${CCTV_ZOOM}` : `Einzelkameras ab Zoomstufe ${CCTV_ZOOM}` });
    return;
  }
  const b = ctx.map.getBounds();
  const [x0, x1, y0, y1] = [Math.floor(b.getWest() * TILE), Math.floor(b.getEast() * TILE), Math.floor(b.getSouth() * TILE), Math.floor(b.getNorth() * TILE)];
  const key = [x0, x1, y0, y1].join(',');
  if (key === st.key) return;
  st.key = key;
  ctx.set('cctv', { loading: true, note: undefined });
  loadIndex(st)
    .then(async (index) => {
      if (!index.size) throw new Error('Kameradaten nicht erreichbar');
      const jobs: Promise<Rec[]>[] = [];
      for (let x = x0; x <= x1; x++) {
        for (let y = y0; y <= y1; y++) {
          for (const [region, tiles] of index) if (tiles.has(`${x}_${y}`)) jobs.push(loadTile(st, region, `${x}_${y}`));
        }
      }
      const loaded = await Promise.allSettled(jobs);
      if (st.key !== key) return;
      const failed = loaded.filter((r) => r.status === 'rejected').length;
      const fc: FeatureCollection<Point> = { type: 'FeatureCollection', features: loaded.flatMap((r) => (r.status === 'fulfilled' ? r.value.map(toFeature) : [])) };
      ctx.setData('cctv', fc);
      st.fc = fc;
      updateCones(ctx);
      const n = fc.features.length;
      if (failed) st.key = ''; // load the missing tiles again on the next move
      ctx.set('cctv', {
        loading: false,
        count: n,
        note: failed ? `${failed} Kachel(n) nicht erreichbar` : n ? 'Stand: Monatsauszug von OpenStreetMap – real gibt es deutlich mehr' : 'keine Kameras im Ausschnitt (oder Region noch nicht im Monatsauszug)',
      });
    })
    .catch((e) => {
      if (st.key !== key) return;
      console.warn('CCTV', e);
      st.key = '';
      ctx.set('cctv', { loading: false, note: 'Kameradaten nicht erreichbar' });
    });
}

export default defineExtra({
  id: 'cctv',
  order: 695,
  section: 'cams',
  cat: 'medien',
  label: 'Überwachungskameras',
  hint: 'CCTV-Kameras aus OpenStreetMap: Dichte-Übersicht (Monatsauszug), Einzelkameras ab Zoom 11 – ohne Kennzeichenleser und Webcams',
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
          'circle-radius': ['interpolate', ['linear'], ['zoom'], CCTV_ZOOM, 2.5, 14, 5.5],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], CCTV_ZOOM, 0, 14, 1.3],
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
      [t('layers.cctv.rowZone'), KIND[String(p.kind)] ?? p.kind],
      [t('layers.cctv.rowCtype'), CTYPE[String(p.ctype)] ?? p.ctype],
      [t('layers.cctv.rowMount'), tx(`layers.cams.alprMount.${String(p.mount).replace(/[-_](\w)/g, (_0, s1: string) => s1.toUpperCase())}`, ALPR_MOUNT[String(p.mount)] ?? p.mount ?? '')],
      [t('layers.cctv.rowDirection'), dir >= 0 ? `${Math.round(dir)}° (${card})` : ''],
      [t('layers.cctv.rowOperator'), p.operator],
      [t('layers.cctv.rowPosition'), coordsTxt(pt[1] as number, pt[0] as number)],
    ].filter(([, v]) => v);
    const extra = rows.length ? `<div class="pop-grid two">${rows.map(([k, v]) => `<span>${k}</span><b>${escapeHtml(String(v))}</b>`).join('')}</div>` : '';
    return { type: 'html', html: cardHtml({ glyph: 'cctv', color: CCTV_COLOR, title: p.title, subtitle: p.subtitle, source: 'OpenStreetMap (ODbL)', url: p.url, extra }), lng: pt[0], lat: pt[1] };
  },
  layers: ['cctv-heat', 'cctv-cone', 'cctv-cone-line', 'cctv'],
  clickLayers: ['cctv'],
});
