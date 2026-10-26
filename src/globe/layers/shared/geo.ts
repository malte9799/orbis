import type { FeatureCollection } from 'geojson';

export const empty = (): FeatureCollection => ({ type: 'FeatureCollection', features: [] });
