import { defineExtra } from '../types';
import { BGR_KOR250_TILES } from '../../../api/resources';

export default defineExtra({
  id: 'resources',
  order: 120,
  section: 'earth',
  cat: 'erde',
  label: 'Rohstoffvorkommen',
  hint: 'Öl, Gas, Kohle, Erze, Steine – weltweit (Wikidata), genauer ab Zoom 7 (USGS, BGR) und 10 (OpenStreetMap)',
  glyph: 'plant',
  icon: 'pick',
  color: '#8d6e63',
  rasters: [
      {
        id: 'kor250',
        tiles: [BGR_KOR250_TILES],
        attribution: 'Rohstoffe DE: © BGR, KOR250',
        maxzoom: 18,
        opacity: 0.8,
        minzoom: 6,
        bounds: [5.5, 47, 15.5, 55.2],
      },
  ],
  layers: ['kor250', 'resources', 'resources-label'],
  clickLayers: ['resources'],
});
