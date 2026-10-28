import { layers, namedFlavor } from '@protomaps/basemaps';
import type { LayerSpecification } from 'maplibre-gl';

// Protomaps basemaps (https://docs.protomaps.com/basemaps/): vector tiles from the Protomaps API
// (free key for non-commercial use, settings → keys) drawn with the styles of @protomaps/basemaps.
// The tile schema differs from OpenMapTiles, so this source lives next to `ofm` (which keeps
// serving roads, airports and 3D buildings) and only draws the visible base map.

export const PM_SOURCE = 'base-protomaps';
export const PM_TILES = (key: string) => `https://api.protomaps.com/tiles/v4/{z}/{x}/{y}.mvt?key=${encodeURIComponent(key)}`;
export const PM_ATTR =
  '<a href="https://protomaps.com" target="_blank">Protomaps</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>';

export type PmFlavor = 'dark' | 'light';
export const PM_SPRITE_ID = (f: PmFlavor) => `pm${f}`;
export const PM_SPRITE_URL = (f: PmFlavor) => `https://protomaps.github.io/basemaps-assets/sprites/v4/${f}`;

/** Layer id prefix of one flavour: `pm-<flavor>-`. */
export const pmPrefix = (f: PmFlavor) => `pm-${f}-`;

/**
 * Layers of one flavour, hidden. Ids are prefixed per flavour, icons point at the flavour's
 * own sprite (`pmdark:name`) and the Medium font (missing from our glyph server) becomes Regular.
 */
export function protomapsLayers(flavor: PmFlavor): LayerSpecification[] {
  const sprite = PM_SPRITE_ID(flavor);
  return layers(PM_SOURCE, namedFlavor(flavor), { lang: 'de' }).map((l) => {
    const out = JSON.parse(JSON.stringify(l).replaceAll('Noto Sans Medium', 'Noto Sans Regular')) as LayerSpecification;
    out.id = pmPrefix(flavor) + l.id;
    out.layout = { ...out.layout, visibility: 'none' };
    const icon = (out.layout as Record<string, unknown>)['icon-image'];
    if (icon !== undefined) {
      (out.layout as Record<string, unknown>)['icon-image'] =
        typeof icon === 'string'
          ? `${sprite}:${icon}`
          : ['let', 'pmi', icon, ['case', ['==', ['var', 'pmi'], ''], '', ['concat', `${sprite}:`, ['var', 'pmi']]]];
    }
    return out;
  });
}
