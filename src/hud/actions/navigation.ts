import type { ActFn, HudCore } from '../core';

export default (c: HudCore): Record<string, ActFn> => {
  const { closeOverlay, go, setSearch, ui, host, root } = c;
  return {
    go: (id) => go(id),
    gallery: () => {
      ui.gallery = !ui.gallery;
      setSearch(false);
    },
    edit: () => {
      ui.edit = true;
      ui.gallery = false;
    },
    close: () => {
      ui.rename = false;
      ui.edit = false;
      ui.add = false;
      ui.open = null;
      ui.pick = false;
    },
    search: () => setSearch(!ui.search),
    settings: () => host.openSettings(),
    basepick: () => {
      ui.basepick = !ui.basepick;
    },
    locate: () => host.locate(),
    route: () => host.route(),
    menu: () => {
      ui.menu = !ui.menu;
    },
    menuunfold: () => {
      ui.folded = false;
    },
    menuclose: () => {
      ui.menu = false;
    },
    sheettoggle: () => {
      if (ui.edit) {
        ui.edit = false;
        ui.add = false;
        ui.open = null;
        ui.pick = false;
      } else ui.edit = true;
    },
    sheetdone: () => closeOverlay(),
    rename: () => {
      ui.rename = true;
      queueMicrotask(() => {
        const i = root.querySelector<HTMLInputElement>('#hud-rn');
        i?.focus();
        i?.select();
      });
    },
  };
};
