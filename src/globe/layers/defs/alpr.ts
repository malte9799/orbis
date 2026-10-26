import { defineExtra, type ExtraCtx } from '../types';
import type { Feature, Point } from 'geojson';
import { empty } from '../shared/geo';
import { ALPR_FOV_ANGLE, ALPR_FOV_RADIUS, ALPR_FOV_ZOOM, ALPR_MOUNT, ALPR_RED, ALPR_ZONE, CAM_DETAIL_ZOOM, CARDINAL, alprVendorImg, fovSectors } from '../shared/cams';
import { ALPR_SOURCE_LAYER, ALPR_TILES_CA, ALPR_TILES_US, loadAlpr } from '../../../api/cams';
import { cardHtml } from '../../popup';
import { escapeHtml, safeUrl } from '../../../util';
import { isSuperseded } from '../../../api/overpass';
import { coordsTxt } from '../../../units';

type St = { key: string; tilesAdded: boolean; tilesFailed: boolean; live: Feature[]; fovKey: string };
const getState = (ctx: ExtraCtx) => ctx.state<St>('alpr', () => ({ key: '', tilesAdded: false, tilesFailed: false, live: [], fovKey: '' }));

function ensureTiles(ctx: ExtraCtx) {
  const st = getState(ctx);
  if (st.tilesAdded) return;
  st.tilesAdded = true;
  const m = ctx.map;
  const attribution = 'ALPR-Übersicht: <a href="https://github.com/flockhopper3/deflock-data">deflock-data</a>, © OpenStreetMap (ODbL)';
  m.addSource('alpr-us', { type: 'vector', url: ALPR_TILES_US, attribution });
  m.addSource('alpr-ca', { type: 'vector', url: ALPR_TILES_CA });
  for (const src of ['alpr-us', 'alpr-ca']) {
    m.addLayer(
      {
        id: `alpr-heat-${src}`,
        type: 'heatmap',
        source: src,
        'source-layer': ALPR_SOURCE_LAYER,
        paint: {
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 2, 4, 8, 14],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 2, 0.35, 8, 1],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.85, 10, 0.6, 14, 0.6],
          'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(239,68,68,0)', 0.2, 'rgba(239,68,68,0.45)', 0.5, '#f97316', 0.8, '#fde047', 1, '#ffffff'],
        },
      },
      'alpr-cone',
    );
    m.addLayer(
      {
        id: `alpr-dots-${src}`,
        type: 'circle',
        source: src,
        'source-layer': ALPR_SOURCE_LAYER,
        minzoom: 6,
        // no maxzoom: the tiles carry single cameras up to zoom 14, so the map stays filled when
        // the live Overpass query fails (the live layer is drawn on top of these dots)
        paint: { 'circle-color': ALPR_RED, 'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 1.8, CAM_DETAIL_ZOOM, 3, 14, 6], 'circle-opacity': 0.8 },
      },
      'alpr-cone',
    );
  }
  m.on('idle', () => updateFov(ctx));
  ctx.registerLayers('alpr', ['alpr-heat-alpr-us', 'alpr-heat-alpr-ca', 'alpr-dots-alpr-us', 'alpr-dots-alpr-ca']);
}

function updateFov(ctx: ExtraCtx) {
  const st = getState(ctx);
  if (!ctx.isOn('alpr')) return;
  const m = ctx.map;
  const cams = new Map<string, [number, number, number]>();
  const take = (lon: number, lat: number, dir: unknown) => {
    const d = Number(dir);
    if (dir == null || dir === '' || !Number.isFinite(d) || d < 0) return;
    cams.set(`${lon.toFixed(6)},${lat.toFixed(6)},${d}`, [lon, lat, d]);
  };
  if (m.getZoom() >= ALPR_FOV_ZOOM) {
    for (const f of st.live) take((f.geometry as Point).coordinates[0], (f.geometry as Point).coordinates[1], f.properties?.dir);
    if (st.tilesAdded && !st.tilesFailed) {
      for (const src of ['alpr-us', 'alpr-ca']) {
        if (!m.getSource(src)) continue;
        for (const f of m.querySourceFeatures(src, { sourceLayer: ALPR_SOURCE_LAYER, filter: ['has', 'direction'] })) {
          if (f.geometry.type === 'Point') take(f.geometry.coordinates[0], f.geometry.coordinates[1], f.properties?.direction);
        }
      }
    }
  }
  const key = [...cams.keys()].sort().join('|');
  if (key === st.fovKey) return;
  st.fovKey = key;
  ctx.setData('alpr-fov', { type: 'FeatureCollection', features: fovSectors([...cams.values()], ALPR_FOV_RADIUS, ALPR_FOV_ANGLE) });
}

function updateNote(ctx: ExtraCtx) {
  const st = getState(ctx);
  const z = ctx.map.getZoom();
  if (z >= CAM_DETAIL_ZOOM) return; // keeps the per-view summary
  const notes: string[] = [];
  if (z < CAM_DETAIL_ZOOM)
    notes.push(st.tilesFailed ? 'Übersicht nicht erreichbar – ab Zoomstufe 9 live aus OpenStreetMap' : 'Übersicht USA/Kanada · Details ab Zoomstufe 9 (weltweit)');
  ctx.set('alpr', { note: notes.join(' · ') || undefined });
}

function loadNow(ctx: ExtraCtx) {
  const st = getState(ctx);
  updateNote(ctx);
  if (ctx.map.getZoom() < CAM_DETAIL_ZOOM) {
    ctx.setData('alpr', empty());
    st.live = [];
    st.key = '';
    return;
  }
  const b = ctx.viewBounds();
  const key = Object.values(b).join(',');
  if (key === st.key) return;
  st.key = key;
  ctx.set('alpr', { loading: true });
  loadAlpr(b)
    .then((fc) => {
      if (st.key !== key) return;
      ctx.setData('alpr', fc);
      st.live = fc.features;
      updateFov(ctx);
      const flock = fc.features.filter((f) => f.properties?.flock).length;
      ctx.set('alpr', { loading: false, count: fc.features.length, note: fc.features.length ? `${flock} davon Flock Safety (im Ausschnitt)` : 'keine Kennzeichen-Kameras im Ausschnitt erfasst' });
    })
    .catch((e) => {
      if (isSuperseded(e) || st.key !== key) return;
      console.warn('Overpass ALPR', e);
      st.key = '';
      ctx.set('alpr', { loading: false, note: 'OpenStreetMap (Overpass) nicht erreichbar' });
    });
}


export default defineExtra({
  id: 'alpr',
  order: 690,
  section: 'cams',
  cat: 'medien',
  label: 'Kennzeichen-Kameras',
  hint: 'ALPR/Flock-Kameras aus OpenStreetMap – DeFlock-Community',
  glyph: 'alpr',
  icon: 'cam',
  color: '#ef4444',
  sources: { alpr: 'ALPR: © OpenStreetMap-Mitwirkende, <a href="https://deflock.org/">DeFlock</a>', 'alpr-fov': '' },
  addLayers(ctx) {
    const { add, hidden } = ctx;
    // field of view as real-size sectors (metres on the ground, so they scale with the zoom)
    add(
      {
        id: 'alpr-cone',
        type: 'fill',
        source: 'alpr-fov',
        layout: hidden,
        paint: { 'fill-color': ALPR_RED, 'fill-opacity': 0.28 },
      },
      'marker',
    );
    add(
      {
        id: 'alpr-cone-line',
        type: 'line',
        source: 'alpr-fov',
        layout: hidden,
        paint: { 'line-color': ALPR_RED, 'line-width': 1.2, 'line-opacity': 0.85 },
      },
      'marker',
    );
    add(
      {
        id: 'alpr',
        type: 'circle',
        source: 'alpr',
        layout: hidden,
        paint: {
          'circle-color': ['case', ['get', 'flock'], ALPR_RED, '#ff9800'],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, 3, 14, 6],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 11, 0, 14, 1.5],
        },
      },
      'marker',
    );
        const st = getState(ctx);
    ctx.map.on('error', (ev) => {
          const e = ev as typeof ev & { sourceId?: string };
          if (e.sourceId !== 'alpr-us' && e.sourceId !== 'alpr-ca') return;
          if (!st.tilesFailed) console.warn('ALPR-Übersicht', e.error);
          st.tilesFailed = true;
          updateNote(ctx);
        });
  },
  enable(ctx) {
    ensureTiles(ctx);
    loadNow(ctx);
  },
  onMoveEnd: loadNow,
  click({ p, pt }) {
    const dir = Number(p.dir);
    const card = dir >= 0 ? CARDINAL[Math.round(dir / 45) % 8] : '';
    const rows = [
      ['Hersteller', p.brand],
      ['Betreiber', p.operator],
      ['Bereich', ALPR_ZONE[String(p.zone)] ?? p.zone],
      ['Montage', ALPR_MOUNT[String(p.mount)] ?? p.mount],
      ['Blickrichtung', dir >= 0 ? `${Math.round(dir)}° (${card})` : ''],
      ['Seit', p.since],
      ['Kennung', p.ref],
      ['Position', coordsTxt(pt[1] as number, pt[0] as number)],
    ].filter(([, v]) => v);
    const photo = alprVendorImg(String(p.brand ?? ''));
    const extra = `${photo ? `<div class="pop-cam"><img src="${escapeHtml(photo)}" alt="${escapeHtml(String(p.brand))} (Beispielfoto)" loading="lazy" referrerpolicy="no-referrer"></div>` : ''}${rows.length ? `<div class="pop-grid two">${rows.map(([k, v]) => `<span>${k}</span><b>${escapeHtml(String(v))}</b>`).join('')}</div>` : ''}
      <div class="pop-foot"><a href="${escapeHtml(safeUrl(p.deflock) ?? '#')}" target="_blank" rel="noopener noreferrer">Auf DeFlock ansehen ↗</a></div>`;
    return { type: 'html', html: cardHtml({ glyph: 'alpr', color: p.flock ? ALPR_RED : '#ff9800', title: p.title, subtitle: p.subtitle, source: 'OpenStreetMap / DeFlock (Beispielfoto: deflock.org)', url: p.url, extra }), lng: pt[0], lat: pt[1] };
  },
  layers: ['alpr-heat', 'alpr-dots', 'alpr-cone', 'alpr-cone-line', 'alpr'],
  clickLayers: ['alpr', 'alpr-dots-alpr-us', 'alpr-dots-alpr-ca'],
});
