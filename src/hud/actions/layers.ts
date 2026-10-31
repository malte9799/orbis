import type { ActFn, HudCore } from '../core';
import { FILTERS } from '../filters';
import { toast } from '../../util';
import { t } from '../../i18n';
import { tx } from '../../globe/layers';
import { catalogOf } from '../catalog';

export default (c: HudCore): Record<string, ActFn> => {
  const { afterEdit, edit, layerOf, ui } = c;
  return {
    eye: (id) => {
      const l = layerOf(id);
      if (!l) return;
      l.hidden = !l.hidden;
      if (!l.hidden) delete l.hidden;
      afterEdit();
    },
    open: (id) => {
      ui.open = ui.open === id ? null : id;
    },
    remove: (id) => {
      const d = edit();
      d.layers = d.layers.filter((l) => l.id !== id);
      ui.open = null;
      afterEdit();
    },
    filter: (id, v) => {
      const l = layerOf(id);
      const f = FILTERS[id];
      if (!l || !f) return;
      if (f.multi) {
        // extra tokens (vol-n from the volume slider) survive every chip toggle
        const toks = (l.filter ?? '').split(',').filter(Boolean);
        const names = new Set(f.options.map(([o]) => o));
        const set = new Set(toks.filter((t) => names.has(t)));
        if (set.has(v)) set.delete(v);
        else set.add(v);
        l.filter = [...toks.filter((t) => !names.has(t)), ...f.options.map(([o]) => o).filter((o) => set.has(o))].join(',') || undefined;
      } else l.filter = v || undefined;
      if (!l.filter) delete l.filter;
      afterEdit();
    },
    add: () => {
      ui.add = !ui.add;
      ui.q = '';
    },
    addlayer: (id) => {
      const d = edit();
      if (d.layers.some((l) => l.id === id)) return;
      // "Blitze Live" kommt mit Ton ab Werk
      d.layers.unshift(id === 'lightning' ? { id, filter: 'sound' } : { id });
      c.fresh.add(id);
      ui.open = null;
      afterEdit();
      toast(t('hud.toast.added', { label: catalogOf(id) ? tx(`layers.${id}.label`, catalogOf(id)!.label) : id }));
    },
    pick: () => {
      ui.pick = !ui.pick;
    },
  };
};
