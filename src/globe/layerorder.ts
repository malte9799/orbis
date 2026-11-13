import type { LayerSpecification, Map as MlMap } from 'maplibre-gl';

/** the 3D buildings layer (style.ts); everything draped on the ground has to stay below it */
export const BUILDINGS_LAYER = 'buildings-3d';

const GROUND_TYPES = new Set(['line', 'fill', 'raster', 'hillshade', 'heatmap', 'background']);

/**
 * Where to insert a runtime layer. Ground-draped types (line, fill, raster, hillshade, heatmap,
 * background) must never end up above the 3D buildings: when `before` is missing, unknown or sits
 * above 'buildings-3d' in the style order, the buildings layer becomes the insertion point.
 * Symbols, circles, fill-extrusions and custom layers keep `before` as given.
 */
export function insertBefore(type: string, before: string | undefined, orderedIds: readonly string[]): string | undefined {
  if (!GROUND_TYPES.has(type)) return before;
  const b = orderedIds.indexOf(BUILDINGS_LAYER);
  if (b < 0) return before;
  if (before === undefined) return BUILDINGS_LAYER;
  const i = orderedIds.indexOf(before);
  return i < 0 || i > b ? BUILDINGS_LAYER : before;
}

/** map.addLayer with the ordering rule above; an unknown `before` counts as undefined */
export function addLayerOrdered(map: MlMap, layer: LayerSpecification, before?: string): void {
  const ids = map.getStyle().layers.map((l) => l.id);
  map.addLayer(layer, insertBefore(layer.type, before && ids.includes(before) ? before : undefined, ids));
}
