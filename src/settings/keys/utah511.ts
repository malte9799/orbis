import { defineKey } from '../types';

export default defineKey({
  id: 'utah511',
  order: 70,
  group: 'snapshot',
  tip: 'tip',
  steps: [
    { t: '1', u: 'https://udottraffic.utah.gov' },
    { t: '2', u: 'https://prod-ut.ibi511.com/developers/doc' },
    { t: '3' },
  ],
  optional: true,
  label: 'label',
  placeholder: 'placeholder',
});
