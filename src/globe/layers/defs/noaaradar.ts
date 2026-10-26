import { defineExtra } from '../types';
import { noaaCredit, noaaWms } from '../shared/tiles';

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
  rasters: [
      {
        id: 'noaa-ak',
        tiles: [noaaWms('alaska')],
        attribution: noaaCredit,
        maxzoom: 9,
        opacity: 0.8,
        bounds: [-170, 51, -129, 72],
      },
      {
        id: 'noaa-hi',
        tiles: [noaaWms('hawaii')],
        attribution: noaaCredit,
        maxzoom: 9,
        opacity: 0.8,
        bounds: [-164, 17, -153, 24],
      },
      {
        id: 'noaa-pr',
        tiles: [noaaWms('carib')],
        attribution: noaaCredit,
        maxzoom: 9,
        opacity: 0.8,
        bounds: [-70, 15, -62, 20],
      },
      {
        id: 'noaa-gu',
        tiles: [noaaWms('guam')],
        attribution: noaaCredit,
        maxzoom: 9,
        opacity: 0.8,
        bounds: [142, 11, 148, 16],
      },
  ],
  layers: ['noaa-ak', 'noaa-hi', 'noaa-pr', 'noaa-gu'],
});
