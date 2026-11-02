import type { FeatureCollection } from 'geojson';
import { groundTrack, loadSatellites, loadSatGroup, satelliteFeatures, type Sat } from '../../../api/tracking';
import type { ClickResult } from '../../extras';
import { SatellitesLayer } from '../../satellites3d';
import type { ClickCtx, ExtraCtx } from '../types';

type St = { base: Sat[]; starlink: Sat[]; baseLoading: Promise<void> | null; starlinkLoading: Promise<void> | null; part: SatellitesLayer | null };
const emptyFc = (): FeatureCollection => ({ type: 'FeatureCollection', features: [] });
export const getState = (ctx: ExtraCtx) => ctx.state<St>('sats', () => ({ base: [], starlink: [], baseLoading: null, starlinkLoading: null, part: null }));

export function startSatellites(ctx: ExtraCtx) {
  const st = getState(ctx);
  const wantBase = ctx.isOn('sats');
  const wantStarlink = ctx.isOn('starlink');
  if (wantBase && !st.base.length && !st.baseLoading) {
    ctx.set('sats', { loading: true });
    st.baseLoading = loadSatellites()
      .then((s) => {
        st.base = s;
        ctx.set('sats', { loading: false, count: s.length });
      })
      .catch(() => {
        ctx.set('sats', { loading: false, note: 'CelesTrak nicht erreichbar' });
        ctx.toast('Satellitendaten (CelesTrak) konnten nicht geladen werden.');
      })
      .finally(() => {
        st.baseLoading = null;
        updateSatPositions(ctx);
      });
  }
  if (wantStarlink && !st.starlink.length && !st.starlinkLoading) {
    ctx.set('starlink', { loading: true });
    st.starlinkLoading = loadSatGroup('starlink')
      .then((s) => {
        st.starlink = s;
        ctx.set('starlink', { loading: false, count: s.length });
      })
      .catch(() => ctx.set('starlink', { loading: false, note: 'CelesTrak nicht erreichbar' }))
      .finally(() => {
        st.starlinkLoading = null;
        updateSatPositions(ctx);
      });
  }
  updateSatPositions(ctx);
  ctx.clear('sat-pos');
  ctx.every('sat-pos', wantStarlink ? 4000 : 2000, () => updateSatPositions(ctx));
}

export function updateSatPositions(ctx: ExtraCtx) {
  const st = getState(ctx);
  const list = [...(ctx.isOn('sats') ? st.base : []), ...(ctx.isOn('starlink') ? st.starlink : [])];
  const part = satellites(ctx);
  part.setSats(list);
  // on the globe the dots are drawn at their real height; the flat map keeps the 2D icons
  ctx.setData('sats', part.drawsDots(ctx.stage.frame) ? emptyFc() : satelliteFeatures(list));
}

/** The satellites on the 3D stage, created the first time they are needed. */
function satellites(ctx: ExtraCtx) {
  const st = getState(ctx);
  if (!st.part) {
    st.part = new SatellitesLayer(ctx.map, { modeChanged: () => updateSatPositions(ctx) });
    ctx.stage.add(st.part);
  }
  return st.part;
}

export function satClick({ p, pt }: ClickCtx): ClickResult | null {
  return { type: 'sat', id: String(p.id), lng: pt[0], lat: pt[1] };
}

export const satsApi = {
  sat(ctx: ExtraCtx, id: string): Sat | null {
    const st = getState(ctx);
    return [...st.base, ...st.starlink].find((s) => s.id === id) ?? null;
  },
  /** Orbit and ground track of this satellite (null: none). */
  select(ctx: ExtraCtx, id: string | null) {
    const sat = id ? satsApi.sat(ctx, id) : null;
    ctx.setData('sat-track', sat ? groundTrack(sat) : emptyFc());
    if (getState(ctx).part) satellites(ctx).select(sat ? sat.id : null);
  },
};
