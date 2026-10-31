import { defineKey } from '../types';

export default defineKey({
  id: 'radarHost',
  order: 120,
  group: 'weather',
  tip: 'tip',
  steps: [
    { t: '1', u: 'https://librewxr.net/' },
    { t: '2' },
  ],
  optional: true,
  label: 'label',
  placeholder: 'placeholder',
  type: 'url',
  /** only https addresses are kept */
  httpsOnly: true,
});
