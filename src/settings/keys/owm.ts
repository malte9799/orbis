import { defineKey } from '../types';

export default defineKey({
  id: 'owm',
  order: 10,
  section: 'keys',
  label: 'OpenWeatherMap',
  hint: 'zusätzliche hochauflösende Wetterkarten',
  placeholder: 'appid',
});
