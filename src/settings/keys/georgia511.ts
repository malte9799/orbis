import { defineKey } from '../types';

export default defineKey({
  id: 'georgia511',
  order: 75,
  group: 'snapshot',
  tip: 'tip',
  steps: [
    { t: '1', u: 'https://511ga.org' },
    { t: '2', u: 'https://511ga.org/developers/doc' },
    { t: '3' },
  ],
  optional: true,
  label: 'label',
  placeholder: 'placeholder',
});
