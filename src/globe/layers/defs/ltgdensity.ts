import { defineExtra } from '../types';

// NOAA nowCOAST: strike density of the last 15 minutes on an ~8 km grid, derived from Vaisala
// NLDN/GLD360 (a NOAA product that may be redistributed, unlike the raw detections). Covers the
// Americas, the Pacific and the western Atlantic.
export default defineExtra({
  id: 'ltgdensity',
  order: 102,
  section: 'earth',
  cat: 'wetter',
  label: 'Blitzdichte Amerika (NOAA)',
  hint: 'Blitze pro km² der letzten 15 min, ~8 km Raster – Amerika und Pazifik, NOAA nowCOAST',
  glyph: 'bolt',
  icon: 'bolt',
  color: '#ffd54f',
  region: 'AM',
  rasters: [
    {
      id: 'ltgdensity',
      tiles: ['https://nowcoast.noaa.gov/geoserver/observations/lightning_detection/ows?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=ldn_lightning_strike_density&STYLES=&FORMAT=image/png&TRANSPARENT=true&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256'],
      attribution: 'Blitzdichte: <a href="https://nowcoast.noaa.gov/">NOAA nowCOAST</a> (Vaisala NLDN/GLD360)',
      maxzoom: 8,
      opacity: 0.85,
      bounds: [-180, -25, 180, 80],
    },
  ],
  layers: ['ltgdensity'],
});
