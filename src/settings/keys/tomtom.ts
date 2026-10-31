import { defineKey } from '../types';

export default defineKey({
  id: 'tomtom',
  order: 70,
  group: 'transit',
  tip: 'tip',
  steps: [
    { t: '1', u: 'https://developer.tomtom.com/user/register' },
    { t: '2', u: 'https://developer.tomtom.com/user/me/apps' },
    { t: '3' },
  ],
  optional: true,
  label: 'label',
  placeholder: 'placeholder',
});
