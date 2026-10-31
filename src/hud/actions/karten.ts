import type { ActFn, HudCore } from '../core';
import { toast } from '../../util';
import { t } from '../../i18n';
import { blankKarte, clone, DEFAULT_PINNED, MAX_PINNED, newId } from '../karten';

export default (c: HudCore): Record<string, ActFn> => {
  const { captureView, dirty, go, persist, suggestName, view, ui, st, host, root } = c;
  return {
    revert: () => {
      delete st.drafts[c.cur];
      ui.open = null;
      c.fresh = new Set();
      persist();
      host.apply(view(c.cur));
      const k = view(c.cur);
      if (k.view) host.goTo(k.view);
    },
    overwrite: () => {
      const d = st.drafts[c.cur];
      const i = st.own.findIndex((k) => k.id === c.cur);
      if (!d || i < 0) return;
      st.own[i] = { ...clone(d), savedAt: Date.now() };
      delete st.drafts[c.cur];
      c.fresh = new Set();
      persist();
      toast(t('hud.toast.saved', { name: d.name }));
    },
    saveas: () => {
      const k = view(c.cur);
      c.form = { name: dirty(c.cur) ? suggestName(k) : `${k.name} (Kopie)`, icon: k.icon, color: k.color, place: !!k.view, pin: true };
      ui.save = true;
      ui.add = false;
    },
    cancel: () => {
      ui.save = false;
      c.form = null;
    },
    ficon: (_, v) => {
      if (c.form) c.form.icon = v;
    },
    fcol: (_, v) => {
      if (c.form) c.form.color = v;
    },
    fplace: () => {
      if (c.form) c.form.place = !c.form.place;
    },
    fpin: () => {
      if (c.form) c.form.pin = !c.form.pin;
    },
    dosave: () => {
      if (!c.form) return;
      const nameEl = root.querySelector<HTMLInputElement>('#hud-nm');
      if (nameEl) c.form.name = nameEl.value;
      const d = clone(view(c.cur));
      const id = newId();
      Object.assign(d, { id, name: c.form.name.trim() || t('hud.kname.new'), icon: c.form.icon, color: c.form.color, savedAt: Date.now() });
      delete d.std;
      delete d.menu;
      if (c.form.place) d.view = d.view ?? captureView();
      else delete d.view;
      const wantPin = c.form.pin && st.pinned.length < MAX_PINNED;
      st.own.push(d);
      if (wantPin) st.pinned.push(id);
      delete st.drafts[c.cur];
      c.cur = id;
      ui.save = false;
      ui.open = null;
      c.fresh = new Set();
      c.form = null;
      persist();
      host.apply(view(c.cur));
      toast(t('hud.toast.saved', { name: d.name }) + (wantPin ? t('hud.toast.pinned') : ''));
    },
    pin: (id) => {
      if (st.pinned.includes(id)) {
        if (st.pinned.length <= 1) return;
        st.pinned = st.pinned.filter((x) => x !== id);
      } else if (st.pinned.length >= MAX_PINNED) {
        toast(t('hud.toast.full'));
        return;
      } else st.pinned.push(id);
      persist();
    },
    del: (id) => {
      const k = st.own.find((x) => x.id === id);
      if (!k || !window.confirm(t('hud.confirm.delete', { name: k.name }))) return;
      st.own = st.own.filter((x) => x.id !== id);
      st.pinned = st.pinned.filter((x) => x !== id);
      if (!st.pinned.length) st.pinned = [...DEFAULT_PINNED];
      delete st.drafts[id];
      if (c.cur === id) {
        persist();
        go('wetter');
        return;
      }
      persist();
    },
    blank: () => {
      const k = blankKarte();
      st.own.push(k);
      ui.edit = true;
      ui.add = true;
      ui.q = '';
      go(k.id);
      ui.edit = true;
      ui.add = true;
    },
  };
};
