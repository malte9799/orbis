import { defineKey } from '../types';

export default defineKey({
  id: 'nps',
  order: 50,
  group: 'snapshot',
  tip: 'tip',
  steps: [
    { t: '1', u: 'https://www.nps.gov/subjects/developer/get-started.htm' },
    { t: '2' },
  ],
  optional: true,
  label: 'label',
  placeholder: 'placeholder',
});
