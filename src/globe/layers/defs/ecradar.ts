import { defineExtra } from '../types';

export default defineExtra({
  id: 'ecradar',
  order: 270,
  section: 'ocean',
  cat: 'wetter',
  label: 'Radar Kanada',
  hint: 'Regenradar Kanada, 1 km, ~6 min – Environment Canada',
  glyph: 'storm',
  icon: 'radar',
  color: '#e53935',
  region: 'CA',
  rasters: [
      {
        id: 'ecradar',
        tiles: ['https://geo.weather.gc.ca/geomet?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=RADAR_1KM_RRAI&STYLES=&FORMAT=image/png&TRANSPARENT=true&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256'],
        attribution: 'Radar Kanada: © <a href="https://eccc-msc.github.io/open-data/">Environment Canada</a> (Open Government Licence)',
        maxzoom: 9,
        opacity: 0.8,
        bounds: [-141, 41, -52, 70],
      },
  ],
  layers: ['ecradar'],
});
