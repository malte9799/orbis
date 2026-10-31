import { defineKey } from '../types';

export default defineKey({
  id: 'maptiler',
  order: 14,
  group: 'weather',
  tip: 'tip',
  steps: [
    { t: '1', u: 'https://cloud.maptiler.com/auth/widget?mode=signup' },
    { t: '2', u: 'https://cloud.maptiler.com/account/keys/' },
    { t: '3' },
  ],
  label: 'label',
  placeholder: 'placeholder',
});
