import { defineExtra, type ExtraCtx } from '../types';
import type { Feature, FeatureCollection, Point } from 'geojson';
import { empty } from '../shared/geo';
import { ALPR_FOV_ZOOM, CAM_COLOR, CAM_DETAIL_ZOOM, CAM_DOT_ZOOM, CAM_FOV_ANGLE, CAM_FOV_RADIUS, ROAD_CAM_FOV_ANGLE, ROAD_CAM_FOV_RADIUS, fovSectors } from '../shared/cams';
import { LayerSpecification } from 'maplibre-gl';
import { SNAPSHOT_CAMS, camFeedsInView } from '../../../api/camfeeds';
import { hasWindyKey, loadDigitrafficCams, loadOsmWebcams, loadWindyWebcams } from '../../../api/cams';
import { isSuperseded } from '../../../api/overpass';
import { snapshotJson } from '../../../api/data';
import { estimateHeadings, needsEstimate } from '../../../api/camdir';
import { loadCamDirs, onCamDirsChange, withCloudDir } from '../../../api/camdircloud';

/** the overview dots/halo (not clickable) end here – above it only the live camera dots are drawn, otherwise every camera shows twice */
const CAM_OVERVIEW_MAXZOOM = 14;

type St = { fi: FeatureCollection; windy: FeatureCollection; feeds: Map<string, { at: number; features: Feature<Point>[] }>; feedLoading: Set<string>; feedErrors: Set<string>; key: string; osmCount: number; windyKey: string; heatAdded: boolean; heatLoaded: boolean; osmFc: FeatureCollection<Point> | null; osmRaw: FeatureCollection<Point> | null; fovKey: string; estimating: boolean; unsub: (() => void) | null };
const getState = (ctx: ExtraCtx) => ctx.state<St>('webcams', () => ({ fi: empty(), windy: empty(), feeds: new Map(), feedLoading: new Set(), feedErrors: new Set(), key: '', osmCount: 0, windyKey: '', heatAdded: false, heatLoaded: false, osmFc: null, osmRaw: null, fovKey: '', estimating: false, unsub: null }));

function merge(ctx: ExtraCtx) {
  const st = getState(ctx);
  const feedCams = [...st.feeds.values()].flatMap((f) => f.features);
  // corrected viewing directions (own worker, see camdircloud.ts) win over the feeds' and the estimates
  const all = { type: 'FeatureCollection' as const, features: ([...st.fi.features, ...st.windy.features, ...feedCams] as Feature<Point>[]).map(withCloudDir) };
  applyOsm(ctx);
  ctx.setData('webcams', all);
  ctx.set('webcams', { count: all.features.length + st.osmCount || undefined });
  updateNote(ctx);
  updateFov(ctx);
}

/** the OpenStreetMap webcams with the corrected directions */
function applyOsm(ctx: ExtraCtx) {
  const st = getState(ctx);
  if (!st.osmRaw) return;
  st.osmFc = { ...st.osmRaw, features: st.osmRaw.features.map(withCloudDir) };
  ctx.setData('webcams-osm', st.osmFc);
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
          st.osmRaw = fc;
          applyOsm(ctx);
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
      maxzoom: CAM_OVERVIEW_MAXZOOM,
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
      maxzoom: CAM_OVERVIEW_MAXZOOM,
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

/** road cameras without a direction in their feed: heading of the nearest road as an estimate (see camdir.ts) */
function estimateMissing(ctx: ExtraCtx) {
  const st = getState(ctx);
  if (st.estimating) return;
  const vb = ctx.map.getBounds();
  const c = ctx.map.getCenter();
  const cand = ([...st.fi.features, ...[...st.feeds.values()].flatMap((f) => f.features)] as Feature<Point>[])
    .filter((f) => f.properties?.kind === 'road' && vb.contains(f.geometry.coordinates as [number, number]) && needsEstimate(f) && !withCloudDir(f).properties?.dirset)
    .sort((a, b) => Math.hypot(a.geometry.coordinates[0] - c.lng, a.geometry.coordinates[1] - c.lat) - Math.hypot(b.geometry.coordinates[0] - c.lng, b.geometry.coordinates[1] - c.lat));
  if (!cand.length) return;
  st.estimating = true;
  estimateHeadings(cand)
    .then((found) => {
      for (const [f, dir] of found) f.properties = { ...f.properties, dir };
      // the layer data carries the direction too (popup, 3D view)
      if (found.size) merge(ctx);
    })
    .catch((e) => {
      if (!isSuperseded(e)) console.warn('Webcam-Blickrichtung', e);
    })
    .finally(() => {
      st.estimating = false;
    });
}

function updateFov(ctx: ExtraCtx) {
  const st = getState(ctx);
  if (!ctx.isOn('webcams')) return;
  const withDir = (features: Feature[] | undefined) => {
    const out: [number, number, number][] = [];
    for (const f of features ?? []) {
      const dir = Number(f.properties?.dir ?? -1);
      if (dir >= 0) out.push([(f.geometry as Point).coordinates[0], (f.geometry as Point).coordinates[1], dir]);
    }
    return out;
  };
  const zoomed = ctx.map.getZoom() >= ALPR_FOV_ZOOM;
  const cams = zoomed ? withDir(st.osmFc?.features) : [];
  // road cameras of the feeds: direction from the feed's direction text (estimated, drawn fainter);
  // a corrected direction is no estimate any more
  const roadCams = [...st.fi.features, ...[...st.feeds.values()].flatMap((f) => f.features)].map((f) => withCloudDir(f as Feature<Point>));
  const road = zoomed ? withDir(roadCams.filter((f) => !f.properties?.dirset)) : [];
  if (zoomed) cams.push(...withDir(roadCams.filter((f) => f.properties?.dirset)));
  if (zoomed) estimateMissing(ctx);
  const key = [...cams, ...road].map((c) => c.join(',')).sort().join('|');
  if (key === st.fovKey) return;
  st.fovKey = key;
  const estimated = fovSectors(road, ROAD_CAM_FOV_RADIUS, ROAD_CAM_FOV_ANGLE).map((f) => ({ ...f, properties: { est: true } }));
  ctx.setData('webcams-fov', { type: 'FeatureCollection', features: [...fovSectors(cams, CAM_FOV_RADIUS, CAM_FOV_ANGLE), ...estimated] });
}


export default defineExtra({
  id: 'webcams',
  order: 670,
  section: 'cams',
  cat: 'medien',
  label: 'Live-Webcams',
  hint: 'Livestreams (weiß umrandet): Kalifornien, Delaware, Norwegen · London, New York, Austin, Washington State, Kanada, Hongkong, Singapur, Finnland, Island, Neuseeland, Australien (NSW), Autobahn, OpenStreetMap – optional Windy und US-Nationalparks',
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
        paint: { 'fill-color': CAM_COLOR, 'fill-opacity': ['case', ['has', 'est'], 0.16, 0.28] },
      },
      'marker',
    );
    add(
      {
        id: 'webcams-cone-line',
        type: 'line',
        source: 'webcams-fov',
        layout: hidden,
        paint: { 'line-color': CAM_COLOR, 'line-width': 1.2, 'line-opacity': ['case', ['has', 'est'], 0.55, 0.85] },
      },
      'marker',
    );
    ctx.map.on('idle', () => updateFov(ctx));
  },
  enable(ctx) {
    const st = getState(ctx);
    if (!st.unsub) st.unsub = onCamDirsChange(() => ctx.isOn('webcams') && merge(ctx));
    loadCamDirs().catch((e) => console.warn('Kamera-Richtungen', e));
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
    // the camera panel on the right shows the picture and the 3D board (see campanel.ts)
    return { type: 'cam', p, lng: pt[0], lat: pt[1] };
  },
  layers: ['webcams-glow', 'webcams-heat', 'webcams-dots', 'webcams', 'webcams-osm', 'webcams-cone', 'webcams-cone-line'],
  clickLayers: ['webcams', 'webcams-osm'],
});
