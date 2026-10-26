import { defineExtra, type ExtraCtx } from '../types';
import type { Feature, FeatureCollection, Point } from 'geojson';
import { empty } from '../shared/geo';
import { ALPR_FOV_ZOOM, CAM_COLOR, CAM_DETAIL_ZOOM, CAM_DOT_ZOOM, CAM_FOV_ANGLE, CAM_FOV_RADIUS, CARDINAL, fovSectors } from '../shared/cams';
import { LayerSpecification } from 'maplibre-gl';
import { SNAPSHOT_CAMS, camFeedsInView } from '../../../api/camfeeds';
import { cardHtml } from '../../popup';
import { attachHls } from '../../hls';
import { escapeHtml, safeUrl } from '../../../util';
import { hasWindyKey, loadDigitrafficCams, loadOsmWebcams, loadWindyWebcams } from '../../../api/cams';
import { isSuperseded } from '../../../api/overpass';
import { snapshotJson } from '../../../api/data';

type St = { fi: FeatureCollection; windy: FeatureCollection; feeds: Map<string, { at: number; features: Feature<Point>[] }>; feedLoading: Set<string>; feedErrors: Set<string>; key: string; osmCount: number; windyKey: string; heatAdded: boolean; heatLoaded: boolean; osmFc: FeatureCollection<Point> | null; fovKey: string };
const getState = (ctx: ExtraCtx) => ctx.state<St>('webcams', () => ({ fi: empty(), windy: empty(), feeds: new Map(), feedLoading: new Set(), feedErrors: new Set(), key: '', osmCount: 0, windyKey: '', heatAdded: false, heatLoaded: false, osmFc: null, fovKey: '' }));

function merge(ctx: ExtraCtx) {
  const st = getState(ctx);
  const feedCams = [...st.feeds.values()].flatMap((f) => f.features);
  const all = { type: 'FeatureCollection' as const, features: [...st.fi.features, ...st.windy.features, ...feedCams] };
  ctx.setData('webcams', all);
  ctx.set('webcams', { count: all.features.length + st.osmCount || undefined });
  updateNote(ctx);
}

function updateNote(ctx: ExtraCtx) {
  const st = getState(ctx);
  const notes: string[] = [];
  if (ctx.map.getZoom() < CAM_DETAIL_ZOOM) notes.push('Webcams aus OpenStreetMap ab Zoomstufe 9');
  if (st.feedErrors.size) notes.push(`${[...st.feedErrors].join(', ')} nicht erreichbar`);
  if (!hasWindyKey()) notes.push('weltweit viele weitere mit kostenlosem Windy-Schlüssel (Einstellungen)');
  else if (ctx.map.getZoom() < 5) notes.push('Windy-Webcams ab Zoomstufe 5');
  ctx.set('webcams', { note: notes.join(' · ') || undefined });
}

function loadNow(ctx: ExtraCtx) {
  const st = getState(ctx);
  const m = ctx.map;
  const z = m.getZoom();
  // regional camera feeds (London, California, Hong Kong, …) once their region is in view
  const vb = m.getBounds();
  for (const feed of camFeedsInView({ west: vb.getWest(), south: vb.getSouth(), east: vb.getEast(), north: vb.getNorth() })) {
    const prev = st.feeds.get(feed.id);
    // signed image URLs (Singapore) expire – refresh those more often
    const maxAge = (feed.id === 'singapore' ? 4 : 10) * 60000;
    if (st.feedLoading.has(feed.id) || (prev && Date.now() - prev.at < maxAge)) continue;
    st.feedLoading.add(feed.id);
    // camera lists are mirrored daily into the data branch (images still load live)
    const load = SNAPSHOT_CAMS.has(feed.id) ? () => snapshotJson(`cams/${feed.id}.json`, () => feed.load()) : () => feed.load();
    load()
      .then((features) => {
        st.feeds.set(feed.id, { at: Date.now(), features });
        st.feedErrors.delete(feed.label);
        merge(ctx);
      })
      .catch((e) => {
        console.warn('Webcams', feed.id, e);
        st.feeds.set(feed.id, { at: Date.now(), features: prev?.features ?? [] });
        st.feedErrors.add(feed.label);
        updateNote(ctx);
      })
      .finally(() => st.feedLoading.delete(feed.id));
  }
  // OpenStreetMap webcams for the visible area
  if (z >= CAM_DETAIL_ZOOM) {
    const b = ctx.viewBounds();
    const key = Object.values(b).join(',');
    if (key !== st.key) {
      st.key = key;
      loadOsmWebcams(b)
        .then((fc) => {
          if (st.key !== key) return;
          ctx.setData('webcams-osm', fc);
          st.osmFc = fc;
          st.osmCount = fc.features.length;
          updateFov(ctx);
          merge(ctx);
        })
        .catch((e) => {
          if (isSuperseded(e) || st.key !== key) return;
          console.warn('Overpass webcams', e);
          st.key = '';
        });
    }
  }
  // Windy webcams around the map centre
  if (hasWindyKey() && z >= 5) {
    const c = m.getCenter();
    const b = m.getBounds();
    const km = Math.min(250, (Math.abs(b.getNorth() - b.getSouth()) * 111) / 2);
    const key = `${c.lat.toFixed(1)},${c.lng.toFixed(1)},${Math.round(km / 10)}`;
    // image URLs expire after 10 minutes on the free tier – reload at least that often
    if (key !== st.windyKey || Date.now() - (ctx.info('webcams')?.at ?? 0) > 8 * 60000) {
      st.windyKey = key;
      loadWindyWebcams(c.lat, c.lng, km)
        .then((fc) => {
          if (st.windyKey !== key) return;
          st.windy = fc;
          merge(ctx);
        })
        .catch((e) => {
          console.warn('Windy', e);
          st.windyKey = '';
          ctx.set('webcams', { note: 'Windy-Webcams nicht erreichbar – Schlüssel prüfen' });
        });
    }
  }
  updateNote(ctx);
}

function ensureHeat(ctx: ExtraCtx) {
  const st = getState(ctx);
  if (st.heatAdded) return;
  st.heatAdded = true;
  const m = ctx.map;
  const before = m.getLayer('webcams') ? 'webcams' : undefined;
  // halo first, so it lies below the heatmap and does not tint its white core
  m.addLayer(
    {
      id: 'webcams-glow',
      type: 'circle',
      source: 'webcams-world',
      minzoom: CAM_DOT_ZOOM,
      paint: { 'circle-color': CAM_COLOR, 'circle-radius': ['interpolate', ['linear'], ['zoom'], CAM_DOT_ZOOM, 8, CAM_DETAIL_ZOOM, 9, 14, 7], 'circle-blur': 1, 'circle-opacity': 0.25 },
    },
    before,
  );
  m.addLayer(
    {
      id: 'webcams-heat',
      type: 'heatmap',
      source: 'webcams-world',
      paint: {
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 2, 4, 8, 14],
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 2, 0.35, 8, 1],
        'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.85, 10, 0.6, 12, 0],
        'heatmap-color': [
          'interpolate', ['linear'], ['heatmap-density'],
          0, 'rgba(0,191,165,0)', 0.2, 'rgba(0,191,165,0.45)', 0.45, '#26c6da', 0.65, '#80deea', 0.8, '#ffffff', 1, '#ffffff',
        ],
      },
    },
    before,
  );
  m.addLayer(
    {
      id: 'webcams-dots',
      type: 'circle',
      source: 'webcams-world',
      minzoom: CAM_DOT_ZOOM,
      paint: { 'circle-color': CAM_COLOR, 'circle-radius': ['interpolate', ['linear'], ['zoom'], CAM_DOT_ZOOM, 1.8, CAM_DETAIL_ZOOM, 3, 14, 6], 'circle-opacity': 0.8 },
    },
    before,
  );
}

async function loadWorldHeat(ctx: ExtraCtx) {
  const st = getState(ctx);
  if (st.heatLoaded) return;
  st.heatLoaded = true;
  try {
    const pts = await snapshotJson<[number, number][]>('cams/world.json');
    ctx.setData('webcams-world', {
      type: 'FeatureCollection',
      features: pts.map(([lon, lat]) => ({ type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [lon, lat] }, properties: {} })),
    });
  } catch (e) {
    st.heatLoaded = false;
    console.warn('Webcam-Heatmap', e);
  }
}

function updateFov(ctx: ExtraCtx) {
  const st = getState(ctx);
  if (!ctx.isOn('webcams')) return;
  const cams: [number, number, number][] = [];
  if (ctx.map.getZoom() >= ALPR_FOV_ZOOM && st.osmFc) {
    for (const f of st.osmFc.features) {
      const dir = Number(f.properties?.dir);
      if (dir >= 0) cams.push([(f.geometry as Point).coordinates[0], (f.geometry as Point).coordinates[1], dir]);
    }
  }
  const key = cams.map((c) => c.join(',')).sort().join('|');
  if (key === st.fovKey) return;
  st.fovKey = key;
  ctx.setData('webcams-fov', { type: 'FeatureCollection', features: fovSectors(cams, CAM_FOV_RADIUS, CAM_FOV_ANGLE) });
}


export default defineExtra({
  id: 'webcams',
  order: 670,
  section: 'cams',
  cat: 'medien',
  label: 'Live-Webcams',
  hint: 'Livestreams (weiß umrandet): Kalifornien, Delaware, Norwegen · London, New York, Kanada, Hongkong, Singapur, Finnland, Island, Neuseeland, Australien (NSW), Autobahn, OpenStreetMap – optional Windy und US-Nationalparks',
  glyph: 'webcam',
  icon: 'cam',
  color: '#00bfa5',
  sources: { webcams: 'Webcams: <a href="https://www.windy.com/webcams">Windy</a>, <a href="https://www.digitraffic.fi/">Digitraffic</a> (CC BY 4.0), <a href="https://www.vegagerdin.is/vegagerdin/gagnasafn/vefthjonustur/vefmyndavelar">Vegagerðin</a>, <a href="https://data.calgary.ca">Calgary</a>, <a href="https://www.drivebc.ca">DriveBC</a> (OGL), <a href="https://opendata.transport.nsw.gov.au">TfNSW</a> (CC BY 4.0), <a href="https://www.nzta.govt.nz">NZTA</a>, <a href="https://deldot.gov">DelDOT</a>, <a href="https://www.vegvesen.no">Statens vegvesen</a> (NLOD)', 'webcams-world': 'Kamera-Positionen (Heatmap): Aggregat der Webcam-Feeds (siehe „Webcams")', 'webcams-osm': 'Webcams: © OpenStreetMap', 'webcams-fov': '' },
  addLayers(ctx) {
    const { add, hidden } = ctx;
    const camIcon = (id: string, source: string): LayerSpecification => ({
      id,
      type: 'circle',
      source,
      minzoom: CAM_DOT_ZOOM,
      layout: hidden,
      // cameras with a live video stream get a white ring
      paint: { 'circle-color': CAM_COLOR, 'circle-radius': ['interpolate', ['linear'], ['zoom'], CAM_DOT_ZOOM, 1.8, CAM_DETAIL_ZOOM, 3, 14, 6], 'circle-opacity': 0.8, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], CAM_DOT_ZOOM, ['case', ['has', 'hls'], 0.6, 0], 14, ['case', ['has', 'hls'], 1.6, 0]] },
    });
    add(camIcon('webcams', 'webcams'), 'marker');
    add(camIcon('webcams-osm', 'webcams-osm'), 'marker');
    // viewing direction of OpenStreetMap webcams (camera:direction), same sectors as the ALPR cameras
    add(
      {
        id: 'webcams-cone',
        type: 'fill',
        source: 'webcams-fov',
        layout: hidden,
        paint: { 'fill-color': CAM_COLOR, 'fill-opacity': 0.28 },
      },
      'marker',
    );
    add(
      {
        id: 'webcams-cone-line',
        type: 'line',
        source: 'webcams-fov',
        layout: hidden,
        paint: { 'line-color': CAM_COLOR, 'line-width': 1.2, 'line-opacity': 0.85 },
      },
      'marker',
    );
    ctx.map.on('idle', () => updateFov(ctx));
  },
  enable(ctx) {
    const st = getState(ctx);
    ctx.loadOnce('webcams', 6 * 60 * 60000, async () => {
      try {
        st.fi = await loadDigitrafficCams();
      } catch (e) {
        console.warn('Digitraffic', e);
      }
      merge(ctx);
      return {};
    });
    ensureHeat(ctx);
    void loadWorldHeat(ctx);
    loadNow(ctx);
  },
  onMoveEnd: loadNow,
  click({ p, pt }) {
  const img = safeUrl(p.image);
  // still images are cached by browsers – add a cache-buster (not for signed Windy URLs)
  const src = img && p.kind === 'road' ? `${img}${img.includes('?') ? '&' : '?'}t=${Math.floor(Date.now() / 60000)}` : img;
  const video = safeUrl(p.video);
  const hls = safeUrl(p.hls);
  const dir = Number(p.dir);
  const subtitle = dir >= 0 ? [p.subtitle, `Blickrichtung ${Math.round(dir)}° (${CARDINAL[Math.round(dir / 45) % 8]})`].filter(Boolean).join(' · ') : p.subtitle;
  const still = src
    ? `<a class="pop-cam" href="${escapeHtml(safeUrl(p.url) ?? img)}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(src)}" alt="Webcam-Bild" loading="lazy" referrerpolicy="no-referrer"></a>`
    : '<div class="pop-sub">Livestream gerade nicht verfügbar</div>';
  const extra = hls
    ? `<video class="pop-cam" ${src ? `poster="${escapeHtml(src)}"` : ''} autoplay muted playsinline controls></video>`
    : video
    ? `<video class="pop-cam" src="${escapeHtml(video)}" ${src ? `poster="${escapeHtml(src)}"` : ''} autoplay muted loop playsinline controls></video>`
    : src
    ? still
    : `<a class="btn small pop-cam-link" href="${escapeHtml(safeUrl(p.url) ?? '#')}" target="_blank" rel="noopener noreferrer">Webcam öffnen ↗</a>`;
  const after = hls
    ? (node: HTMLElement) => {
        const el = node.querySelector<HTMLVideoElement>('video.pop-cam');
        // stream not playable (offline, blocked): fall back to the still image
        if (el) attachHls(el, hls, () => (el.outerHTML = still));
      }
    : undefined;
  return { type: 'html', html: cardHtml({ glyph: 'webcam', color: '#00bfa5', title: p.title, subtitle, date: p.updated, source: p.source, url: p.url, extra }), lng: pt[0], lat: pt[1], after };
  },
  layers: ['webcams-glow', 'webcams-heat', 'webcams-dots', 'webcams', 'webcams-osm', 'webcams-cone', 'webcams-cone-line'],
  clickLayers: ['webcams', 'webcams-osm'],
});
