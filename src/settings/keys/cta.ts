import { defineKey } from '../types';

export default defineKey({
  id: 'cta',
  order: 90,
  group: 'transit',
  tip: 'tip',
  steps: [
    { t: '1', u: 'https://www.transitchicago.com/developers/traintrackerapply/' },
    { t: '2' },
  ],
  label: 'label',
  placeholder: 'placeholder',
});
