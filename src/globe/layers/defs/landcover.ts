import { defineExtra } from '../types';

export default defineExtra({
  id: 'landcover',
  order: 190,
  section: 'earth',
  cat: 'erde',
  label: 'Landbedeckung',
  hint: 'Wald, Acker, Siedlung, Wasser (10 m) – ESA WorldCover',
  glyph: 'city',
  icon: 'map',
  color: '#4caf50',
  rasters: [
      {
        id: 'landcover',
        tiles: ['https://wmts.terrascope.be/?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=esa-worldcover-map-10m-2021-v2_map&STYLE=default&FORMAT=image/png&TILEMATRIXSET=EPSG:3857&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&TIME=2021-01-01'],
        attribution: 'Landbedeckung: © ESA WorldCover 2021 (CC BY 4.0)',
        maxzoom: 14,
        opacity: 0.75,
        minzoom: 6,
      },
  ],
  layers: ['landcover'],
});
