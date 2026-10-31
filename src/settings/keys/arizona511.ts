import { defineKey } from '../types';

export default defineKey({
  id: 'arizona511',
  order: 71,
  group: 'snapshot',
  tip: 'tip',
  steps: [
    { t: '1', u: 'https://az511.com' },
    { t: '2', u: 'https://az511.com/developers/doc' },
    { t: '3' },
  ],
  optional: true,
  label: 'label',
  placeholder: 'placeholder',
});
