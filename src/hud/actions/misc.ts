import type { ActFn, HudCore } from '../core';
import { toast } from '../../util';
import { t } from '../../i18n';

export default (c: HudCore): Record<string, ActFn> => {
  const { encodeKarte, view, ui } = c;
  return {
    evh: (_, v) => {
      ui.evHours = Number(v);
    },
    share: () => {
      const code = encodeKarte(view(c.cur));
      const url = `${location.origin}${location.pathname}#/karte?k=${code}`;
      navigator.clipboard?.writeText(url).then(
        () => toast(t('hud.toast.copied')),
        () => toast(t('hud.toast.copyFail'), 'error'),
      );
    },
  };
};
