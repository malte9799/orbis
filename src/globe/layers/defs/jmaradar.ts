import { defineExtra } from '../types';
import { loadJmaRadar } from '../shared/jma';
import { JMA_RADAR_TILES } from '../shared/tiles';

export default defineExtra({
  id: 'jmaradar',
  order: 300,
  section: 'ocean',
  cat: 'wetter',
  label: 'Radar Japan',
  hint: 'Niederschlagsradar Japan, 5 min – Japan Meteorological Agency',
  glyph: 'storm',
  icon: 'radar',
  color: '#c62828',
  region: 'JP',
  rasters: [
      {
        id: 'jmaradar',
        tiles: [JMA_RADAR_TILES('20000101000000')],
        attribution: 'Radar Japan: © <a href="https://www.jma.go.jp/">Japan Meteorological Agency</a>',
        maxzoom: 10,
        opacity: 0.8,
        bounds: [118, 20, 150, 48],
      },
  ],
  enable(ctx) {
    ctx.loadOnce('jmaradar', 5 * 60000, () => loadJmaRadar(ctx));
  },
  layers: ['jmaradar'],
});
