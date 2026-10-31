import { defineKey } from '../types';

export default defineKey({
  id: 'ohgo',
  order: 78,
  group: 'snapshot',
  tip: 'tip',
  steps: [
    { t: '1', u: 'https://publicapi.ohgo.com/docs/registration' },
    { t: '2', u: 'https://publicapi.ohgo.com/docs/api-key' },
    { t: '3' },
  ],
  optional: true,
  label: 'label',
  placeholder: 'placeholder',
});
