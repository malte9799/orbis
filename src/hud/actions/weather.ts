import type { ActFn, HudCore } from '../core';
import { type BaseId } from '../../globe/style';
import { WX_MENU } from '../catalog';
import { defaultBuildings3d, defaultTerrain3d } from '../karten';

export default (c: HudCore): Record<string, ActFn> => {
  const { afterEdit, captureView, edit, mainFam, view, ui, host } = c;
  const ACT: Record<string, ActFn> = {
    main: (id) => {
      const d = edit();
      const f = host.families().find((x) => x.id === id);
      d.main = f ? f.id : null;
      if (f) d.mainVar = f.variants[0][0];
      else delete d.mainVar;
      delete d.wind;
      delete d.isobars;
      ui.pick = false;
      afterEdit();
    },
    wxcat: (id) => {
      const it = WX_MENU.find((x) => x.id === id);
      const k0 = view(c.cur);
      const f = mainFam(k0);
      const curVar = f ? (k0.mainVar ?? f.variants[0][0]) : '';
      const stormFam = !!it?.subs.some((x) => f && x.main === f.id && x.mainVar === curVar);
      const boltOn = k0.layers.some((x) => x.id === 'lightning' && !x.hidden);
      // the active entry again switches it off (also "Blitze Live" inside Gewitter)
      if (!it || stormFam || (id === 'storm' && boltOn)) {
        ACT.main('', '', new Event('click'));
        if (id === 'storm' && boltOn) edit().layers = edit().layers.filter((x) => x.id !== 'lightning');
        afterEdit();
      } else ACT.wxsub(id, '0', new Event('click'));
    },
    wxsub: (id, v) => {
      const it = WX_MENU.find((x) => x.id === id);
      const sub = it?.subs[Number(v)];
      if (!sub || !it) return;
      const d = edit();
      if (sub.main === 'lightning') {
        // "Blitze Live": the extra layer takes over, no weather main layer on the Karte
        d.main = null;
        delete d.mainVar;
        delete d.wind;
        delete d.isobars;
        const l = d.layers.find((x) => x.id === 'lightning');
        if (!l) {
          // neuer Layer: der schrumpfende Einschlagskreis ("Kreis") und der Ton sind ab Werk aktiv
          d.layers.unshift({ id: 'lightning', filter: 'wave,sound' });
          c.fresh.add('lightning');
        } else delete l.hidden;
      } else {
        if (d.main !== sub.main) {
          delete d.wind;
          delete d.isobars;
        }
        d.main = sub.main;
        d.mainVar = sub.mainVar;
        // radio: another Gewitter row replaces "Blitze Live"
        d.layers = d.layers.filter((x) => x.id !== 'lightning');
      }
      afterEdit();
    },
    var: (_, v) => {
      edit().mainVar = v;
      afterEdit();
    },
    wopt: (_, v) => {
      const d = edit();
      if (v === 'wind') d.wind = d.wind === false ? true : false;
      else d.isobars = !d.isobars;
      if (!d.isobars) delete d.isobars;
      afterEdit();
    },
    base: (id) => {
      edit().base = id as BaseId;
      afterEdit();
    },
    morebases: () => {
      ui.moreBases = true;
    },
    tog: (_, v) => {
      const d = edit();
      if (v === 'labels') d.labels = !d.labels;
      else if (v === 'night') d.night = !d.night;
      else if (v === 'buildings3d') {
        // write the choice explicitly, so the base map no longer decides the default
        d.buildings3d = !(d.buildings3d ?? defaultBuildings3d(d.base));
      } else if (v === 'terrain3d') {
        d.terrain3d = !(d.terrain3d ?? defaultTerrain3d());
      } else if (v === 'wind') {
        d.wind = d.wind === false ? true : false;
      }
      afterEdit();
    },
    viewtog: () => {
      const d = edit();
      if (d.view) delete d.view;
      else d.view = captureView();
      afterEdit();
    },
  };
  return ACT;
};
