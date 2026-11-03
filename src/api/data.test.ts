import { describe, expect, it } from 'vitest';
import { mirrorJson, mirrorUrl } from './data';
import { nwsSlug } from './events';

describe('mirrorUrl', () => {
  it('is null without a base (mirrors off)', () => {
    expect(mirrorUrl('events/gdacs.json', undefined)).toBeNull();
    expect(mirrorUrl('events/gdacs.json', '')).toBeNull();
  });
  it('joins base and key with exactly one slash', () => {
    expect(mirrorUrl('events/gdacs.json', 'https://orbis-live.maltee.dev')).toBe('https://orbis-live.maltee.dev/events/gdacs.json');
    expect(mirrorUrl('/events/gdacs.json', 'https://orbis-live.maltee.dev/')).toBe('https://orbis-live.maltee.dev/events/gdacs.json');
  });
});

describe('nwsSlug', () => {
  it('matches the clock worker keys', () => {
    expect(nwsSlug('Severe Thunderstorm Warning')).toBe('severe-thunderstorm-warning');
    expect(nwsSlug('Tornado Watch')).toBe('tornado-watch');
  });
});

describe('mirrorJson without VITE_LIVE_BASE', () => {
  it('uses the live source only', async () => {
    expect(await mirrorJson('x.json', async () => 42)).toBe(42);
  });
});

describe('FIRMS compact format', () => {
  it('round-trips and reads the old FeatureCollection', async () => {
    const { packFirms, unpackFirms, firmsTimeToMinutes } = await import('./events');
    const fc = {
      type: 'FeatureCollection' as const,
      features: [
        { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [-116.07274, 58.53671] }, properties: { frp: 23.98, conf: '58', time: '2026-11-03 1728' } },
        { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [10, 20] }, properties: { frp: 1, conf: 'n', time: '2026-11-03 5' } },
      ],
    };
    const packed = packFirms(fc.features);
    expect(packed.rows[0].slice(0, 4)).toEqual([-116.073, 58.537, 24, '58']);
    const back = unpackFirms(packed);
    expect(back.features[0].properties).toEqual({ frp: 24, conf: '58', time: '2026-11-03 1728' });
    expect(back.features[1].properties.time).toBe('2026-11-03 0005');
    expect(firmsTimeToMinutes('2026-11-03 5')).toBe(firmsTimeToMinutes('2026-11-03 0005'));
    expect(unpackFirms(fc)).toBe(fc);
  });
});
