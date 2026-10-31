import { defineKey } from '../types';
import { builtInProxy } from '../../api/proxy';
import { t as m } from '../../i18n';

export default defineKey({
  id: 'adsbProxy',
  order: 110,
  group: 'transit',
  tip: () => (builtInProxy() ? m('keys.adsbProxy.tipBuiltIn') : m('keys.adsbProxy.tip')),
  steps: [
    { t: '1', u: 'https://github.com/malte9799/orbis' },
    { t: '2', u: 'https://workers.cloudflare.com' },
    { t: '3' },
  ],
  optional: () => !!builtInProxy(),
  label: 'label',
  placeholder: () => builtInProxy() || m('keys.adsbProxy.placeholder'),
  type: 'url',
  /** only https addresses are kept */
  httpsOnly: true,
});
