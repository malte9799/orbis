import { defineKey } from '../types';

export default defineKey({
  id: 'qldtraffic',
  order: 79,
  group: 'snapshot',
  tip: 'tip',
  steps: [
    { t: '1', u: 'https://qldtraffic.qld.gov.au/more/Developers-and-Data/' },
    { t: '2', u: 'https://qldtraffic.qld.gov.au/more/Developers-and-Data/' },
    { t: '3' },
  ],
  optional: true,
  label: 'label',
  placeholder: 'placeholder',
});
