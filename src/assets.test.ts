import { describe, expect, it, vi } from 'vitest';
import { resolveAssetPath } from './assets';

const m = { 'models/iss.glb': 'models/iss.0123456789ab.glb' };

describe('resolveAssetPath', () => {
  it('maps known paths to the hashed key', () => {
    expect(resolveAssetPath('models/iss.glb', m)).toBe('models/iss.0123456789ab.glb');
    expect(resolveAssetPath('./models/iss.glb', m)).toBe('models/iss.0123456789ab.glb');
  });
  it('falls back to the plain path and warns once', () => {
    const warn = vi.fn();
    expect(resolveAssetPath('textures/x.jpg', m, warn)).toBe('textures/x.jpg');
    resolveAssetPath('textures/x.jpg', m, warn);
    expect(warn).toHaveBeenCalledTimes(1);
  });
  it('stays silent with an empty manifest', () => {
    const warn = vi.fn();
    expect(resolveAssetPath('a/b.glb', {}, warn)).toBe('a/b.glb');
    expect(warn).not.toHaveBeenCalled();
  });
});
