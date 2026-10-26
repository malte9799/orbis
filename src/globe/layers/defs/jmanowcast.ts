import { defineExtra } from '../types';
import { JMA_RADAR_TILES } from '../shared/tiles';

export default defineExtra({
  id: 'jmanowcast',
  order: 340,
  section: 'ocean',
  cat: 'wetter',
  label: 'Radar-Nowcast Japan',
  hint: 'Niederschlagsprognose für die nächste Stunde – Japan Meteorological Agency',
  glyph: 'storm',
  icon: 'radar',
  color: '#ad1457',
  region: 'JP',
  rasters: [
      {
        id: 'jmanowcast',
        tiles: [JMA_RADAR_TILES('20000101000000')],
        attribution: 'Radar-Nowcast Japan: © <a href="https://www.jma.go.jp/">Japan Meteorological Agency</a>',
        maxzoom: 10,
        opacity: 0.8,
        bounds: [118, 20, 150, 48],
      },
  ],
  layers: ['jmanowcast'],
});
