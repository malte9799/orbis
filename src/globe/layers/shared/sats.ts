import { groundTrack, loadSatellites, loadSatGroup, satelliteFeatures, satPopupInfo, type Sat } from '../../../api/tracking';
import { t as tT } from '../../../i18n';
import { cardHtml } from '../../popup';
import type { ClickResult } from '../../extras';
import type { ClickCtx, ExtraCtx } from '../types';

type St = { base: Sat[]; starlink: Sat[]; baseLoading: Promise<void> | null; starlinkLoading: Promise<void> | null };
export const getState = (ctx: ExtraCtx) => ctx.state<St>('sats', () => ({ base: [], starlink: [], baseLoading: null, starlinkLoading: null }));

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
        ctx.set('sats', { loading: false, note: tT('layers.sats.noteFail') });
        ctx.toast(tT('layers.sats.toastFail'));
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
      .catch(() => ctx.set('starlink', { loading: false, note: tT('layers.sats.noteFail') }))
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
  ctx.setData('sats', satelliteFeatures(list));
}

export function satClick({ ctx, p, pt }: ClickCtx): ClickResult | null {
  const st = getState(ctx);
  const sat = [...st.base, ...st.starlink].find((s) => s.id === p.id);
  if (!sat) return null;
  const info = satPopupInfo(sat);
  ctx.setData('sat-track', groundTrack(sat));
  return {
    type: 'html',
    html: cardHtml({ glyph: 'satellite', color: '#b388ff', title: info.title, subtitle: info.subtitle, description: info.details, source: 'CelesTrak', url: info.url }),
    lng: pt[0],
    lat: pt[1],
  };
}
