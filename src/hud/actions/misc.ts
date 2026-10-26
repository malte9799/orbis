import type { ActFn, HudCore } from '../core';
import { toast } from '../../util';

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
        () => toast('Link zur Karte kopiert'),
        () => toast('Link konnte nicht kopiert werden.', 'error'),
      );
    },
  };
};
