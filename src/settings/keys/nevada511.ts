import { defineKey } from '../types';

export default defineKey({
  id: 'nevada511',
  order: 73,
  group: 'snapshot',
  tip: 'tip',
  steps: [
    { t: '1', u: 'https://nvroads.com' },
    { t: '2', u: 'https://nvroads.com/developers/doc' },
    { t: '3' },
  ],
  optional: true,
  label: 'label',
  placeholder: 'placeholder',
});
