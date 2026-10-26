import { defineKey } from '../types';

export default defineKey({
  id: 'windy',
  order: 30,
  group: 'webcams',
  tip: 'Zehntausende Webcams weltweit.',
  steps: [
    { t: '1. Windy-Account erstellen (kostenlos)', u: 'https://www.windy.com/register' },
    { t: '2. „Webcams API“-Key anfordern', u: 'https://api.windy.com/keys' },
    { t: '3. Key hier einfügen' },
  ],
  label: 'Windy Webcams',
  placeholder: 'API-Key',
});
