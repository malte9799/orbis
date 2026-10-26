import { defineExtra } from '../types';

export default defineExtra({
  id: 'fmirain24',
  order: 330,
  section: 'ocean',
  cat: 'wetter',
  label: 'Regensumme 24 h Finnland',
  hint: 'Radar-Niederschlagssumme der letzten 24 Stunden – Finnish Meteorological Institute',
  glyph: 'flood',
  icon: 'drop',
  color: '#0277bd',
  region: 'FI',
  rasters: [
      {
        id: 'fmirain24',
        tiles: ['https://openwms.fmi.fi/geoserver/wms?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=Radar:suomi_rr24h_eureffin&STYLES=&FORMAT=image/png&TRANSPARENT=true&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256'],
        attribution: 'Regensumme: © <a href="https://en.ilmatieteenlaitos.fi/open-data">Finnish Meteorological Institute</a> (CC BY 4.0)',
        maxzoom: 9,
        opacity: 0.8,
        bounds: [18, 58, 33, 71],
      },
  ],
  layers: ['fmirain24'],
});
