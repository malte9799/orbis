import { defineExtra } from '../types';

export default defineExtra({
  id: 'noaaradar',
  order: 290,
  section: 'ocean',
  cat: 'wetter',
  label: 'Radar Alaska, Hawaii, Karibik, Guam',
  hint: 'Regenradar Alaska, Hawaii, Puerto Rico und Guam – NOAA MRMS',
  glyph: 'storm',
  icon: 'radar',
  color: '#d84315',
  region: 'USA',
  layers: ['noaa-ak', 'noaa-hi', 'noaa-pr', 'noaa-gu'],
});
