import type { LayerSpecification } from 'maplibre-gl';
import { FONT_BOLD } from '../../vector';

/** value labels next to the circles of the ocean layers */
export const waveLabel = (id: string, source: string): LayerSpecification => ({
  id,
  type: 'symbol',
  source,
  minzoom: 2,
  layout: { visibility: 'none', 'text-field': ['get', 'label'], 'text-font': FONT_BOLD, 'text-size': 11, 'text-allow-overlap': false, 'text-optional': true },
  paint: { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.75)', 'text-halo-width': 1.2 },
});
