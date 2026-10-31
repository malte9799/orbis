import { defineKey } from '../types';

export default defineKey({
  id: 'ors',
  order: 210,
  group: 'routing',
  tip: 'tip',
  steps: [
    { t: '1', u: 'https://account.heigit.org/signup' },
    { t: '2', u: 'https://account.heigit.org/manage/key' },
    { t: '3' },
  ],
  optional: true,
  label: 'label',
  placeholder: 'placeholder',
});
