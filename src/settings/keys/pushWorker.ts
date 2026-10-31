import { defineKey } from '../types';
import { builtInPush } from '../../api/pushnotify';
import { t as m } from '../../i18n';

export default defineKey({
  id: 'pushWorker',
  order: 120,
  group: 'transit',
  tip: () => (builtInPush() ? m('keys.pushWorker.tipBuiltIn') : m('keys.pushWorker.tip')),
  steps: [
    { t: '1', u: 'https://github.com/malte9799/orbis' },
    { t: '2' },
  ],
  optional: () => !!builtInPush(),
  label: 'label',
  placeholder: () => builtInPush() || m('keys.pushWorker.placeholder'),
  type: 'url',
  httpsOnly: true,
});
