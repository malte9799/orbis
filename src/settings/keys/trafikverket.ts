import { defineKey } from '../types';

export default defineKey({
  id: 'trafikverket',
  order: 60,
  group: 'snapshot',
  tip: 'tip',
  steps: [
    { t: '1', u: 'https://api.trafikinfo.trafikverket.se/Account/Register' },
    { t: '2', u: 'https://api.trafikinfo.trafikverket.se/' },
    { t: '3' },
  ],
  optional: true,
  label: 'label',
  placeholder: 'placeholder',
});
