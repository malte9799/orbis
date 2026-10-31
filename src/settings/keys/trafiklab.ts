import { defineKey } from '../types';

export default defineKey({
  id: 'trafiklab',
  order: 100,
  group: 'transit',
  tip: 'tip',
  steps: [
    { t: '1', u: 'https://www.trafiklab.se/signup' },
    { t: '2', u: 'https://www.trafiklab.se/docs/getting-started/using-trafiklab' },
    { t: '3' },
  ],
  label: 'label',
  placeholder: 'placeholder',
});
