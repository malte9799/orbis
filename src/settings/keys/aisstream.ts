import { defineKey } from '../types';

export default defineKey({
  id: 'aisstream',
  order: 40,
  group: 'webcams',
  tip: 'tip',
  steps: [
    { t: '1', u: 'https://aisstream.io' },
    { t: '2', u: 'https://dashboard.aisstream.io' },
    { t: '3' },
  ],
  label: 'label',
  placeholder: 'placeholder',
});
