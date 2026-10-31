import { defineKey } from '../types';

export default defineKey({
  id: 'windy',
  order: 30,
  group: 'webcams',
  tip: 'tip',
  steps: [
    { t: '1', u: 'https://www.windy.com/register' },
    { t: '2', u: 'https://api.windy.com/keys' },
    { t: '3' },
  ],
  label: 'label',
  placeholder: 'placeholder',
});
