import { defineKey } from '../types';

export default defineKey({
  id: 'graphhopper',
  order: 220,
  group: 'routing',
  tip: 'tip',
  steps: [
    { t: '1', u: 'https://graphhopper.com/dashboard/#/register' },
    { t: '2', u: 'https://graphhopper.com/dashboard/#/api-keys' },
    { t: '3' },
  ],
  optional: true,
  label: 'label',
  placeholder: 'placeholder',
});
