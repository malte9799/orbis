import type { MapGeoJSONFeature } from 'maplibre-gl';
import { t as tT } from '../../../i18n';
import { ShipsLayer } from '../../ships3d';
import type { ShipInfo } from '../../extras';
import type { ExtraCtx } from '../types';
import { AisStream, Ship, hasAisLive, loadDigitrafficShips, shipFeatures } from '../../../api/transport';

type St = { baltic: Ship[]; ais: AisStream | null; ships3d: ShipsLayer | undefined; shipsAll: Map<number, Ship> };
export const getState = (ctx: ExtraCtx) => ctx.state<St>('ships', () => ({ baltic: [], ais: null, ships3d: undefined, shipsAll: new Map() }));

export async function loadShips(ctx: ExtraCtx) {
  const st = getState(ctx);
  let note: string | undefined;
  try {
    st.baltic = await loadDigitrafficShips();
  } catch (e) {
    console.warn('Digitraffic AIS', e);
    if (!hasAisLive()) throw e;
    note = tT('layers.ships.noteFintraFail');
  }
  mergeShips(ctx);
  return { note: note ?? ctx.info('ships')?.note };
}

export function mergeShips(ctx: ExtraCtx) {
  const st = getState(ctx);
  const all = new Map<number, Ship>();
  for (const s of st.baltic) all.set(s.mmsi, s);
  if (st.ais) for (const s of st.ais.ships.values()) all.set(s.mmsi, s);
  st.shipsAll = all;
  ctx.setData('ships', shipFeatures(all.values()));
  st.ships3d?.setShips(all.values());
  const notes = [st.ais?.error, !hasAisLive() ? tT('layers.ships.noteProxy') : tT('layers.ships.noteLive')].filter(Boolean);
  const prev = ctx.info('ships');
  const note = notes.join(' · ');
  if (prev?.count !== all.size || prev?.note !== note) ctx.set('ships', { count: all.size, note });
}


export function createShips3d(ctx: ExtraCtx) {
  const st = getState(ctx);
  // low-poly 3D ships from zoom 11 on the flat map; the 2D icons (still clickable) fade out then
  st.ships3d = new ShipsLayer({
    enabled: () => ctx.isOn('ships'),
    modeChanged: (on) => {
      if (!ctx.map.getLayer('ships')) return;
      ctx.map.setPaintProperty('ships', 'icon-opacity', on ? 0 : ['case', ['get', 'moving'], 1, 0.6]);
      // the names move with the models as plain elements instead
      ctx.map.setPaintProperty('ships', 'text-opacity', on ? 0 : 1);
    },
  });
  ctx.map.addLayer(st.ships3d, 'marker');
}

export function applyAis(ctx: ExtraCtx) {
  const st = getState(ctx);
  if (!ctx.isOn('ships') || !hasAisLive()) {
    ctx.clear('ais-push');
    st.ais?.stop();
    if (!hasAisLive()) st.ais = null;
  }
}

export function enableShips(ctx: ExtraCtx) {
  const st = getState(ctx);
  ctx.loadOnce('ships', 60000, () => loadShips(ctx));
  if (hasAisLive()) {
    st.ais ??= new AisStream(() => mergeShips(ctx));
    st.ais.start(ctx.viewBounds(4));
    ctx.every('ais-push', 3000, () => mergeShips(ctx));
  }
}

export const shipsApi = {
  active: (ctx: ExtraCtx) => !!getState(ctx).ships3d?.isActive(),
  /** the 3D ship model under a screen point as a map feature, if any */
  pick(ctx: ExtraCtx, x: number, y: number): MapGeoJSONFeature | null {
    const st = getState(ctx);
    const ship = st.ships3d?.isActive() ? st.ships3d.pick(x, y) : null;
    if (!ship) return null;
    return { ...shipFeatures([ship]).features[0], layer: { id: 'ships' } } as unknown as MapGeoJSONFeature;
  },
  info(ctx: ExtraCtx, mmsi: number): ShipInfo | null {
    const st = getState(ctx);
    const ship = st.shipsAll.get(mmsi);
    if (!ship) return null;
    const pos = st.ships3d?.position(mmsi);
    return { ship, history: st.ships3d?.history(mmsi) ?? { speed: [], track: [] }, lon: pos?.[0] ?? ship.lon, lat: pos?.[1] ?? ship.lat };
  },
};
