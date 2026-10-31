import { defineKey } from '../types';

export default defineKey({
  id: 'ontario511',
  order: 60,
  group: 'transit',
  tip: 'tip',
  steps: [
    { t: '1', u: 'https://511on.ca' },
    { t: '2', u: 'https://511on.ca/about/faq' },
    { t: '3' },
  ],
  label: 'label',
  placeholder: 'placeholder',
});
