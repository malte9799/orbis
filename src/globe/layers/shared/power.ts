import { loadOsmPower, loadPowerPlants, type PowerCat } from '../../../api/infra';
import { t as tT } from '../../../i18n';
import { isSuperseded } from '../../../api/overpass';
import type { ExtraCtx, ExtraId } from '../types';

/** which power-plant categories each extra shows – all extras share the same point layers */
export const POWER_CATS: Partial<Record<ExtraId, PowerCat[]>> = {
  wind: ['wind'],
  solar: ['solar'],
  water: ['hydro'],
  nuclear: ['nuclear'],
  coal: ['coal'],
  gas: ['gas'],
  oil: ['oil'],
  biomass: ['biomass'],
  plants: ['other'],
};
export const POWER_EXTRAS = Object.keys(POWER_CATS) as ExtraId[];

type St = { loaded: boolean; loading: Promise<void> | null; counts: Record<PowerCat, number>; osmKey: string };
const getState = (ctx: ExtraCtx) =>
  ctx.state<St>('power', () => ({ loaded: false, loading: null, counts: { wind: 0, solar: 0, hydro: 0, nuclear: 0, coal: 0, gas: 0, oil: 0, biomass: 0, other: 0 }, osmKey: '' }));

export function ensurePower(ctx: ExtraCtx) {
  const st = getState(ctx);
  if (!st.loaded && !st.loading) {
    for (const id of POWER_EXTRAS) if (ctx.isOn(id)) ctx.set(id, { loading: true });
    st.loading = loadPowerPlants()
      .then((fc) => {
        st.loaded = true;
        ctx.setData('power', fc);
        st.counts = { wind: 0, solar: 0, hydro: 0, nuclear: 0, coal: 0, gas: 0, oil: 0, biomass: 0, other: 0 };
        for (const f of fc.features) st.counts[f.properties!.cat as PowerCat]++;
      })
      .catch(() => ctx.toast(tT('layers.power.toast')))
      .finally(() => {
        st.loading = null;
        for (const id of POWER_EXTRAS) {
          ctx.set(id, { loading: false, count: st.loaded ? st.counts[POWER_CATS[id]![0]] : undefined });
        }
      });
  }
  loadOsmPowerNow(ctx);
}

export function loadOsmPowerNow(ctx: ExtraCtx) {
  const st = getState(ctx);
  const m = ctx.map;
  if (m.getZoom() < 10) return;
  const b = m.getBounds();
  // snap to a grid so small pans reuse the last result
  const snap = (v: number, f: (x: number) => number) => f(v * 20) / 20;
  const bounds = {
    west: snap(b.getWest(), Math.floor),
    south: snap(b.getSouth(), Math.floor),
    east: snap(b.getEast(), Math.ceil),
    north: snap(b.getNorth(), Math.ceil),
  };
  const key = Object.values(bounds).join(',');
  if (key === st.osmKey) return;
  st.osmKey = key;
  loadOsmPower(bounds)
    .then((fc) => {
      if (st.osmKey === key) ctx.setData('osm-power', fc);
    })
    .catch((e) => {
      if (isSuperseded(e) || st.osmKey !== key) return;
      console.warn('Overpass', e);
      st.osmKey = '';
    });
}

export function applyPowerFilter(ctx: ExtraCtx) {
  const cats = [...new Set(POWER_EXTRAS.filter((id) => ctx.isOn(id)).flatMap((id) => POWER_CATS[id]!))];
  ctx.map.setFilter('power', ['in', ['get', 'cat'], ['literal', cats]]);
  ctx.map.setFilter('osm-power', ['in', ['get', 'cat'], ['literal', cats]]);
}
