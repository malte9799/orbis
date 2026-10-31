import { defineKey } from '../types';

export default defineKey({
  id: 'owm',
  order: 10,
  group: 'weather',
  tip: 'tip',
  steps: [
    { t: '1', u: 'https://home.openweathermap.org/users/sign_up' },
    { t: '2', u: 'https://home.openweathermap.org/api_keys' },
    { t: '3' },
  ],
  label: 'label',
  placeholder: 'placeholder',
});
