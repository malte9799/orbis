import { defineKey } from '../types';

export default defineKey({
  id: 'idaho511',
  order: 72,
  group: 'snapshot',
  tip: 'tip',
  steps: [
    { t: '1', u: 'https://511.idaho.gov' },
    { t: '2', u: 'https://511.idaho.gov/developers/doc' },
    { t: '3' },
  ],
  optional: true,
  label: 'label',
  placeholder: 'placeholder',
});
