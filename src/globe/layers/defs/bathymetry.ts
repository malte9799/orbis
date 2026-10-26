import { defineExtra } from '../types';

export default defineExtra({
  id: 'bathymetry',
  order: 240,
  section: 'ocean',
  cat: 'meer',
  label: 'Meerestiefe',
  hint: 'Bathymetrie weltweit – GEBCO; Europa genauer – EMODnet',
  glyph: 'tsunami',
  icon: 'ocean',
  color: '#1565c0',
  rasters: [
      {
        id: 'gebco',
        tiles: ['https://wms.gebco.net/mapserv?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=GEBCO_LATEST&STYLES=&FORMAT=image/png&TRANSPARENT=true&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256'],
        attribution: 'Meerestiefe: <a href="https://www.gebco.net/">GEBCO</a> (nicht zur Navigation)',
        maxzoom: 10,
        opacity: 0.8,
      },
      {
        id: 'emodnet',
        tiles: ['https://tiles.emodnet-bathymetry.eu/2020/baselayer/web_mercator/{z}/{x}/{y}.png'],
        attribution: 'Europa: <a href="https://emodnet.ec.europa.eu/">EMODnet Bathymetry</a> (CC BY 4.0, nicht zur Navigation)',
        maxzoom: 11,
        opacity: 0.85,
        bounds: [-36, 15, 43, 74],
      },
  ],
  layers: ['emodnet', 'gebco'],
});
