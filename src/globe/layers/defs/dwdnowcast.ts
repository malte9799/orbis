import { defineExtra } from '../types';

export default defineExtra({
  id: 'dwdnowcast',
  order: 310,
  section: 'ocean',
  cat: 'wetter',
  label: 'Radar-Nowcast Deutschland',
  hint: 'Radar-Vorhersage für die nächsten 2 Stunden, 1 km – Deutscher Wetterdienst (WN-Produkt)',
  glyph: 'storm',
  icon: 'radar',
  color: '#7b1fa2',
  region: 'DE',
  rasters: [
      {
        id: 'dwdnowcast',
        tiles: ['https://maps.dwd.de/geoserver/dwd/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=dwd:Radar_wn-product_1x1km_ger&STYLES=&FORMAT=image/png&TRANSPARENT=true&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256'],
        attribution: 'Radar-Nowcast: © <a href="https://www.dwd.de/">DWD</a> (CC BY 4.0)',
        maxzoom: 9,
        opacity: 0.85,
        bounds: [1, 44, 20, 56],
      },
  ],
  layers: ['dwdnowcast'],
});
