import { defineKey } from '../types';

export default defineKey({
  id: 'alberta511',
  order: 70,
  group: 'transit',
  tip: 'tip',
  steps: [
    { t: '1', u: 'https://511.alberta.ca' },
    { t: '2', u: 'https://511.alberta.ca/developers/doc' },
    { t: '3' },
  ],
  label: 'label',
  placeholder: 'placeholder',
});
