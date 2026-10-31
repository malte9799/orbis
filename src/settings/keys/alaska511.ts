import { defineKey } from '../types';

export default defineKey({
  id: 'alaska511',
  order: 74,
  group: 'snapshot',
  tip: 'tip',
  steps: [
    { t: '1', u: 'https://511.alaska.gov' },
    { t: '2', u: 'https://511.alaska.gov/developers/doc' },
    { t: '3' },
  ],
  optional: true,
  label: 'label',
  placeholder: 'placeholder',
});
