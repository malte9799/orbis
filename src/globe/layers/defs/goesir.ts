import { defineExtra } from '../types';

// GOES-19/18 infrared (band 14) over North and Central America, every 5 minutes, ~2 km – NOAA
// nowCOAST. Complements the worldwide EUMETSAT infrared, which is only updated every 3 hours.
export default defineExtra({
  id: 'goesir',
  order: 104,
  section: 'earth',
  cat: 'wetter',
  label: 'Wolken Amerika (GOES, 5 min)',
  hint: 'Infrarot-Satellitenbild, alle 5 Minuten, ~2 km – NOAA GOES über nowCOAST',
  glyph: 'satellite',
  icon: 'cloud',
  color: '#90caf9',
  region: 'AM',
  rasters: [
    {
      id: 'goesir',
      tiles: ['https://nowcoast.noaa.gov/geoserver/observations/satellite/ows?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=goes_longwave_imagery&STYLES=&FORMAT=image/png&TRANSPARENT=true&CRS=EPSG:3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256'],
      attribution: 'Satellit: <a href="https://nowcoast.noaa.gov/">NOAA nowCOAST</a>, NESDIS GOES',
      maxzoom: 8,
      opacity: 0.75,
      bounds: [-179.5, 10.9, -50.7, 50.6],
    },
  ],
  layers: ['goesir'],
});
