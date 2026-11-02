import type { MapGeoJSONFeature } from 'maplibre-gl';
import type { Feature, FeatureCollection, Point } from 'geojson';
import { VehiclesLayer } from '../../vehicles3d';
import type { ClickResult } from '../../extras';
import type { ClickCtx, ExtraCtx } from '../types';
import { empty } from './geo';
import type { Segment } from '../../../api/transit';
import { ExpressionSpecification } from 'maplibre-gl';
import { FONT_BOLD } from '../../vector';
import { RAIL_MODES, loadAmtrak, loadSegments, modeStyle, positionsAt } from '../../../api/transit';
import { cardHtml } from '../../popup';
import { escapeHtml } from '../../../util';
import { feedsInView, vehicleFeatures } from '../../../api/vehicles';
import { loadTrainDetails, loadTrains } from '../../../api/transport';
import { clockTxt, speedTxt } from '../../../units';

type St = { segs: Segment[]; segKey: string; segAt: number; segLoading: boolean; gpsTrains: FeatureCollection; feedVeh: Map<string, { at: number; features: Feature<Point>[] }>; feedLoading: Set<string>; feedErrors: Set<string>; vehicles3d: VehiclesLayer | undefined };
export const getState = (ctx: ExtraCtx) =>
  ctx.state<St>('vehicles', () => ({ segs: [], segKey: '', segAt: 0, segLoading: false, gpsTrains: empty(), feedVeh: new Map(), feedLoading: new Set(), feedErrors: new Set(), vehicles3d: undefined }));

export async function loadGpsTrains(ctx: ExtraCtx) {
  const st = getState(ctx);
  const [fi, us] = await Promise.allSettled([loadTrains(), loadAmtrak()]);
  const features = [...(fi.status === 'fulfilled' ? fi.value.features : []), ...(us.status === 'fulfilled' ? us.value : [])];
  st.gpsTrains = { type: 'FeatureCollection', features };
  updateVehicles(ctx);
  const failed = [fi.status === 'rejected' ? 'Finnland' : '', us.status === 'rejected' ? 'Amtrak' : ''].filter(Boolean);
  return { note: trainNote(ctx, failed) };
}

export function trainNote(ctx: ExtraCtx, failed: string[] = []) {
  const z = ctx.map.getZoom();
  return [z < 5 ? 'Deutschland & Europa ab Zoomstufe 5' : '', failed.length ? `${failed.join(', ')} nicht erreichbar` : ''].filter(Boolean).join(' · ') || undefined;
}

export function loadSegmentsNow(ctx: ExtraCtx, force = false) {
  const st = getState(ctx);
  const z = ctx.map.getZoom();
  const wantRail = ctx.isOn('trains') && z >= 5;
  const wantLocal = ctx.isOn('transit') && z >= 10;
  const cityNote = 'Fahrplan-Echtzeit (Transitous) ab Zoomstufe 10 – GPS-Regionen schon früher';
  if (ctx.isOn('transit')) ctx.set('transit', { note: z < 10 ? cityNote : ctx.info('transit')?.note === cityNote ? undefined : ctx.info('transit')?.note });
  if (ctx.isOn('trains')) ctx.set('trains', { note: trainNote(ctx) });
  if (!wantRail && !wantLocal) {
    st.segs = [];
    st.segKey = '';
    updateVehicles(ctx);
    return;
  }
  const b = ctx.viewBounds(z >= 10 ? 20 : 2);
  const key = `${Object.values(b).join(',')}|${Math.round(z)}`;
  if (st.segLoading || (!force && key === st.segKey && Date.now() - st.segAt < 60000)) return;
  st.segLoading = true;
  const now = Date.now();
  loadSegments(b, z, now - 30000, now + 3 * 60000)
    .then((segs) => {
      st.segs = segs;
      st.segKey = key;
      st.segAt = Date.now();
      updateVehicles(ctx);
    })
    .catch((e) => {
      console.warn('Transitous', e);
      if (ctx.isOn('trains')) ctx.set('trains', { note: 'Transitous nicht erreichbar – nur GPS-Züge (Finnland, USA)' });
      if (ctx.isOn('transit')) ctx.set('transit', { note: 'Transitous nicht erreichbar' });
    })
    .finally(() => {
      st.segLoading = false;
    });
}

export function loadFeedsNow(ctx: ExtraCtx) {
  const st = getState(ctx);
  if (ctx.map.getZoom() < 4) return;
  const b = ctx.map.getBounds();
  const view = { west: b.getWest(), south: b.getSouth(), east: b.getEast(), north: b.getNorth() };
  const active = new Set<string>();
  for (const feed of feedsInView(view)) {
    active.add(feed.id);
    const prev = st.feedVeh.get(feed.id);
    if (st.feedLoading.has(feed.id) || (prev && Date.now() - prev.at < feed.every * 1000)) continue;
    st.feedLoading.add(feed.id);
    // Entur supports a bounding box – pad the view so small pans need no reload
    const padX = (view.east - view.west) * 0.3;
    const padY = (view.north - view.south) * 0.3;
    feed
      .load({ west: view.west - padX, east: view.east + padX, south: view.south - padY, north: view.north + padY })
      .then((list) => {
        st.feedVeh.set(feed.id, { at: Date.now(), features: vehicleFeatures(feed, list) });
        st.feedErrors.delete(feed.label);
        updateVehicles(ctx);
      })
      .catch((e) => {
        console.warn(feed.id, e);
        st.feedVeh.set(feed.id, { at: Date.now(), features: [] });
        st.feedErrors.add(feed.label);
        const note = `${[...st.feedErrors].join(', ')} nicht erreichbar`;
        if (ctx.isOn('transit')) ctx.set('transit', { note });
      })
      .finally(() => st.feedLoading.delete(feed.id));
  }
  // drop vehicles of regions that left the view
  for (const id of [...st.feedVeh.keys()]) if (!active.has(id)) st.feedVeh.delete(id);
}

export function updateVehicles(ctx: ExtraCtx) {
  const st = getState(ctx);
  const rail = ctx.isOn('trains');
  const local = ctx.isOn('transit');
  const live = positionsAt(st.segs, Date.now(), (m) => (RAIL_MODES.has(m) ? rail : local));
  const gps = [...st.feedVeh.values()].flatMap((f) => f.features).filter((f) => (f.properties?.rail ? rail : local));
  const features = [...live.features, ...gps, ...(rail ? st.gpsTrains.features : [])];
  ctx.setData('trains', { type: 'FeatureCollection', features });
  st.vehicles3d?.setFeatures(features as Feature<Point>[]);
  const nRail = features.filter((f) => f.properties?.rail).length;
  if (rail && ctx.info('trains')?.count !== nRail) ctx.set('trains', { count: nRail, loading: false });
  if (local && ctx.info('transit')?.count !== features.length - nRail) ctx.set('transit', { count: features.length - nRail });
}


export function vehicleCard(p: Record<string, unknown>, pt: number[]): ClickResult {
  const st = modeStyle(String(p.mode));
  const t = (ms: unknown) => clockTxt(Number(ms));
  const delay = Number(p.delay);
  const rows =
    p.src === 'amtrak' || p.src === 'gps'
      ? [
          ['Art', st.label],
          ...(p.src === 'gps' ? [['Von', p.from], ['Nach', p.to], ['Verspätung', delay === -999 ? '' : delay > 0 ? `+${delay} min` : 'pünktlich']] : []),

          ['Strecke', p.from && p.to ? `${p.from} → ${p.to}` : ''],
          ['Geschwindigkeit', p.speed != null ? speedTxt(Number(p.speed)) : ''],
          ['Status', p.timely],
        ]
      : [
          ['Art', st.label],
          ['Abschnitt', `${p.from} → ${p.to}`],
          ['Ankunft', t(p.arr)],
          ['Verspätung', delay === -999 ? 'keine Echtzeitdaten' : delay > 0 ? `+${delay} min` : delay < 0 ? `${delay} min` : 'pünktlich'],
        ];
  const extra = `<div class="pop-grid two">${rows
    .filter(([, v]) => v)
    .map(([k, v]) => `<span>${k}</span><b>${escapeHtml(v)}</b>`)
    .join('')}</div>${p.src === 'transitous' ? '<div class="small muted">Position aus Echtzeitfahrplan berechnet</div>' : ''}`;
  return {
    type: 'html',
    html: cardHtml({
      glyph: 'train',
      color: String(p.color ?? st.color),
      title: p.name,
      source: p.src === 'amtrak' ? 'Amtraker (Amtrak-GPS)' : p.src === 'gps' ? `${p.feed} (GPS)` : 'Transitous',
      url: p.src === 'amtrak' ? 'https://amtraker.com/' : p.src === 'gps' ? undefined : 'https://transitous.org/',
      extra,
    }),
    lng: pt[0],
    lat: pt[1],
  };
}

export function addVehicleLayers(ctx: ExtraCtx, id: string, label: string, filter: ExpressionSpecification) {
  const { add, hidden } = ctx;
    add(
      {
        id,
        type: 'circle',
        source: 'trains',
        filter,
        layout: hidden,
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 2.6, 10, 5, 14, 7],
          'circle-stroke-color': ['case', ['==', ['get', 'realTime'], false], 'rgba(255,255,255,0.45)', '#ffffff'],
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 4, 0.8, 10, 1.5],
        },
      },
      'marker',
    );
    add(
      {
        id: label,
        type: 'symbol',
        source: 'trains',
        filter,
        minzoom: 9,
        layout: {
          ...hidden,
          'text-field': ['get', 'name'],
          'text-font': FONT_BOLD,
          'text-size': 10,
          'text-offset': [0, 1.0],
          'text-anchor': 'top',
          'text-optional': true,
        },
        paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.85)', 'text-halo-width': 1.3 },
      },
      'marker',
    );
}

export function createVehicles3d(ctx: ExtraCtx) {
  const st = getState(ctx);
  // low-poly 3D trains, subways, trams, buses … from zoom 9 on the flat map and only while
  // few enough of them are in view (otherwise they lag); the 2D dots step aside
  st.vehicles3d = new VehiclesLayer({
    enabled: () => ctx.isOn('trains') || ctx.isOn('transit'),
    modeChanged: (on) => {
      for (const id of ['trains', 'transit-veh']) {
        if (!ctx.map.getLayer(id)) continue;
        ctx.map.setPaintProperty(id, 'circle-opacity', on ? 0 : 1);
        ctx.map.setPaintProperty(id, 'circle-stroke-opacity', on ? 0 : 1);
      }
      for (const id of ['trains-label', 'transit-label']) if (ctx.map.getLayer(id)) ctx.map.setPaintProperty(id, 'text-opacity', on ? 0 : 1);
    },
  });
  ctx.map.addLayer(st.vehicles3d, 'marker');
}

export function applyVehicles(ctx: ExtraCtx) {
  if (ctx.isOn('trains') || ctx.isOn('transit')) {
    loadSegmentsNow(ctx, );
    ctx.every('veh-anim', 2000, () => updateVehicles(ctx));
    ctx.every('veh-fetch', 60000, () => loadSegmentsNow(ctx, true));
    loadFeedsNow(ctx);
    ctx.every('veh-feeds', 10000, () => loadFeedsNow(ctx));
  } else {
    ctx.clear('veh-anim');
    ctx.clear('veh-fetch');
    ctx.clear('veh-feeds');
  }
}

export function enableTrains(ctx: ExtraCtx) {
  ctx.loadOnce('trains', 30000, () => loadGpsTrains(ctx));
}

/** after the map stopped moving: GPS feeds and Transitous segments of the new view */
export function moveVehicles(ctx: ExtraCtx) {
  loadFeedsNow(ctx);
  loadSegmentsNow(ctx);
}

export function vehicleClick({ p, pt }: ClickCtx): ClickResult | null {
  if (p.src === 'transitous' || p.src === 'amtrak' || p.src === 'gps') return vehicleCard(p, pt);
  const num = Number(p.num);
  return {
    type: 'html',
    html: cardHtml({
      glyph: 'train',
      color: '#ffca28',
      title: `Zug ${num}`,
      subtitle: speedTxt(Number(p.speed)),
      source: 'Fintraffic Digitraffic',
      url: `https://www.junat.net/en/train/${num}`,
      extra: '<div class="pop-loading small">Details werden geladen …</div>',
    }),
    lng: pt[0],
    lat: pt[1],
    after: (node) => {
      loadTrainDetails(num, String(p.date))
        .then((d) => {
          const el = node.querySelector('.pop-loading');
          if (!el || !d) return el?.remove();
          const head = node.querySelector('.pop-head b');
          if (head) head.textContent = d.title;
          const rows = [
            ['Art', d.category],
            ['Strecke', d.from && d.to ? `${d.from} → ${d.to}` : ''],
            ['Zuletzt', d.lastStation],
            ['Verspätung', d.delay != null ? (d.delay > 0 ? `+${d.delay} min` : 'pünktlich') : ''],
          ].filter(([, v]) => v);
          el.outerHTML = `<div class="pop-grid two">${rows.map(([k, v]) => `<span>${k}</span><b>${escapeHtml(v)}</b>`).join('')}</div>`;
        })
        .catch(() => node.querySelector('.pop-loading')?.remove());
    },
  };
}

export const vehiclesApi = {
  active: (ctx: ExtraCtx) => !!getState(ctx).vehicles3d?.isActive(),
  /** the 3D vehicle model under a screen point as a map feature, if any */
  pick(ctx: ExtraCtx, x: number, y: number): MapGeoJSONFeature | null {
    const f = getState(ctx).vehicles3d?.isActive() ? getState(ctx).vehicles3d!.pick(x, y) : null;
    if (!f) return null;
    return { ...f, layer: { id: f.properties?.rail ? 'trains' : 'transit-veh' } } as unknown as MapGeoJSONFeature;
  },
};
