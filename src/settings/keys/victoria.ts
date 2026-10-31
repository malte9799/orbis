import { defineKey } from '../types';

export default defineKey({
  id: 'victoria',
  order: 80,
  group: 'transit',
  tip: 'tip',
  steps: [
    { t: '1', u: 'https://opendata.transport.vic.gov.au' },
    { t: '2' },
  ],
  label: 'label',
  placeholder: 'placeholder',
});
