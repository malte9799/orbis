import { defineKey } from '../types';

export default defineKey({
  id: 'mapbox',
  order: 12,
  group: 'weather',
  tip: 'tip',
  steps: [
    { t: '1', u: 'https://account.mapbox.com/auth/signup/' },
    { t: '2', u: 'https://account.mapbox.com/access-tokens/' },
    { t: '3' },
  ],
  label: 'label',
  placeholder: 'placeholder',
});
