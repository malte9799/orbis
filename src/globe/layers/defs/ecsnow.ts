import { defineExtra } from '../types';

export default defineExtra({
  id: 'ecsnow',
  order: 320,
  section: 'ocean',
  cat: 'wetter',
  label: 'Schneeradar Kanada',
  hint: 'Radar nur für Schneefall, 1 km – Environment Canada',
  glyph: 'ice',
  icon: 'snow',
  color: '#81d4fa',
  region: 'CA',
  rasters: [
      {
        id: 'ecsnow',
        tiles: ['https://geo.weather.gc.ca/geomet?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=RADAR_1KM_RSNO&STYLES=&FORMAT=image/png&TRANSPARENT=true&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256'],
        attribution: 'Schneeradar Kanada: © <a href="https://eccc-msc.github.io/open-data/">Environment Canada</a> (Open Government Licence)',
        maxzoom: 9,
        opacity: 0.85,
        bounds: [-141, 41, -52, 70],
      },
  ],
  layers: ['ecsnow'],
});
