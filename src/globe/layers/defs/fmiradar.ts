import { defineExtra } from '../types';

export default defineExtra({
  id: 'fmiradar',
  order: 280,
  section: 'ocean',
  cat: 'wetter',
  label: 'Radar Finnland',
  hint: 'Regenradar Finnland, 1 km, 5 min – Finnish Meteorological Institute (CC BY 4.0)',
  glyph: 'storm',
  icon: 'radar',
  color: '#1e88e5',
  region: 'FI',
  rasters: [
      {
        id: 'fmiradar',
        tiles: ['https://openwms.fmi.fi/geoserver/wms?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=Radar:suomi_dbz_eureffin&STYLES=&FORMAT=image/png&TRANSPARENT=true&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256'],
        attribution: 'Radar Finnland: © <a href="https://en.ilmatieteenlaitos.fi/open-data">Finnish Meteorological Institute</a> (CC BY 4.0)',
        maxzoom: 9,
        opacity: 0.8,
        bounds: [18, 58, 33, 71],
      },
  ],
  layers: ['fmiradar'],
});
