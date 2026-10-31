import { defineKey } from '../types';

export default defineKey({
  id: 'firms',
  order: 20,
  group: 'snapshot',
  tip: 'tip',
  steps: [
    { t: '1', u: 'https://firms.modaps.eosdis.nasa.gov/api/map_key/' },
    { t: '2' },
    { t: '3' },
  ],
  optional: true,
  label: 'label',
  placeholder: 'placeholder',
});
