import { defineKey } from '../types';
import { builtInCamdir } from '../../api/camdircloud';
import { t as m } from '../../i18n';

export default defineKey({
  id: 'camdirWorker',
  order: 35,
  group: 'webcams',
  tip: () => (builtInCamdir() ? m('keys.camdirWorker.tipBuiltIn') : m('keys.camdirWorker.tip')),
  steps: [
    { t: '1', u: 'https://github.com/malte9799/orbis' },
    { t: '2' },
  ],
  optional: () => !!builtInCamdir(),
  label: 'label',
  placeholder: () => builtInCamdir() || m('keys.camdirWorker.placeholder'),
  type: 'url',
  httpsOnly: true,
});
