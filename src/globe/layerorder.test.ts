import { describe, expect, it } from 'vitest';
import { insertBefore } from './layerorder';

const order = ['bg', 'water', 'roads', 'labels', 'buildings-3d', 'marker'];

describe('insertBefore', () => {
  it('puts ground layers below the buildings when before is undefined or marker', () => {
    expect(insertBefore('line', undefined, order)).toBe('buildings-3d');
    expect(insertBefore('line', 'marker', order)).toBe('buildings-3d');
    expect(insertBefore('heatmap', 'marker', order)).toBe('buildings-3d');
    expect(insertBefore('raster', 'buildings-3d', order)).toBe('buildings-3d');
  });
  it('keeps a before that is already below the buildings', () => {
    expect(insertBefore('fill', 'labels', order)).toBe('labels');
  });
  it('treats an unknown before as above', () => {
    expect(insertBefore('line', 'nope', order)).toBe('buildings-3d');
  });
  it('leaves symbols, circles and extrusions alone', () => {
    expect(insertBefore('symbol', 'marker', order)).toBe('marker');
    expect(insertBefore('circle', undefined, order)).toBeUndefined();
    expect(insertBefore('fill-extrusion', undefined, order)).toBeUndefined();
  });
  it('does nothing without a buildings layer', () => {
    expect(insertBefore('line', 'marker', ['a', 'marker'])).toBe('marker');
    expect(insertBefore('line', undefined, ['a'])).toBeUndefined();
  });
});
