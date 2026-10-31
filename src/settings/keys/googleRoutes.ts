import { defineKey } from '../types';

export default defineKey({
  id: 'googleRoutes',
  order: 200,
  group: 'routing',
  tip: 'tip',
  steps: [
    { t: '1', u: 'https://console.cloud.google.com/projectcreate' },
    { t: '2', u: 'https://console.cloud.google.com/apis/library/routes.googleapis.com' },
    { t: '3', u: 'https://console.cloud.google.com/apis/credentials' },
    { t: '4' },
  ],
  optional: true,
  label: 'label',
  placeholder: 'placeholder',
});
