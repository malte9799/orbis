import { defineKey } from '../types';

export default defineKey({
  id: 'camdirToken',
  order: 36,
  group: 'webcams',
  optional: true,
  tip: 'tip',
  steps: [
    { t: '1' },
    { t: '2' },
  ],
  label: 'label',
  placeholder: 'placeholder',
});
