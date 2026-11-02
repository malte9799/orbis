import type { ActFn, HudCore } from '../core';
import { radioMenu } from '../catalog';

export default (c: HudCore): Record<string, ActFn> => {
  const { afterEdit, edit, tmodeOf } = c;
  return {
    tcat: (id) => {
      const d = edit();
      const { cats: menu, ids } = radioMenu(d.menu);
      const on = tmodeOf(d) === id;
      d.layers = d.layers.filter((l) => !ids.has(l.id));
      d.tmode = on ? '' : id;
      if (!on) d.layers.unshift(...(menu.find((c) => c.id === id)?.defaults ?? []).map((l) => ({ id: l })));
      afterEdit();
    },
    ttog: (id) => {
      const d = edit();
      const ids = id.split(',');
      // all of a row's layers on → switch them off, otherwise switch the missing ones on
      if (ids.every((x) => d.layers.some((l) => l.id === x))) d.layers = d.layers.filter((l) => !ids.includes(l.id));
      else for (const x of ids) if (!d.layers.some((l) => l.id === x)) d.layers.unshift({ id: x });
      afterEdit();
    },
  };
};
