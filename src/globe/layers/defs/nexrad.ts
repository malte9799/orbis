import { defineExtra } from '../types';

export default defineExtra({
  id: 'nexrad',
  order: 260,
  section: 'ocean',
  cat: 'wetter',
  label: 'Radar USA (NEXRAD)',
  hint: 'Regenradar Mosaik der USA, ~5 min – NOAA via Iowa Environmental Mesonet',
  glyph: 'storm',
  icon: 'radar',
  color: '#ef5350',
  region: 'USA',
  rasters: [
      {
        id: 'nexrad',
        tiles: ['https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png'],
        attribution: 'Radar USA: NOAA NEXRAD via <a href="https://mesonet.agron.iastate.edu/">Iowa Environmental Mesonet</a>',
        maxzoom: 9,
        opacity: 0.8,
        bounds: [-130, 20, -60, 52],
      },
  ],
  layers: ['nexrad'],
});
