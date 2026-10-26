import { defineKey } from '../types';

export default defineKey({
  id: 'owm',
  order: 10,
  group: 'weather',
  tip: 'Zusätzliche hochauflösende Wetterkarten.',
  steps: [
    { t: '1. Account erstellen (kostenlos)', u: 'https://home.openweathermap.org/users/sign_up' },
    { t: '2. API-Key kopieren', u: 'https://home.openweathermap.org/api_keys' },
    { t: '3. Hier einfügen – der Key kann bis zu 1 Std. inaktiv bleiben' },
  ],
  label: 'OpenWeatherMap',
  placeholder: 'appid',
});
