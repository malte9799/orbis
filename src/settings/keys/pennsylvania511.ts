import { defineKey } from '../types';

export default defineKey({
  id: 'pennsylvania511',
  order: 77,
  group: 'snapshot',
  tip: 'tip',
  steps: [
    { t: '1', u: 'https://511pa.com' },
    { t: '2', u: 'https://511pa.com/developers/doc' },
    { t: '3' },
  ],
  optional: true,
  label: 'label',
  placeholder: 'placeholder',
});
